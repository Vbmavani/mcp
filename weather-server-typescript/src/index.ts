import { serve } from "@hono/node-server";
import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import {
  createMcpHandler,
  inputRequired,
  inputResponse,
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import * as z from "zod/v4";
import { ALERTS_VIEW_URI, alertsViewHtml } from "./alerts-view.js";
import { registerPrompts } from "./prompts.js";

const NWS_API_BASE = process.env.NWS_API_BASE ?? "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

// Helper function for making NWS API requests
async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}

interface AlertFeature {
  properties: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    description?: string;
    instruction?: string;
  };
}

interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  detailedForecast?: string;
}

interface AlertsResponse {
  features: AlertFeature[];
}

interface PointsResponse {
  properties: {
    forecast?: string;
  };
}

interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[];
  };
}

/**
 * The output schema of `get-alerts`: a top-level array, not an object, which
 * revision 2026-07-28 is the first to allow. The SDK projects it down to the
 * old `{ result: [...] }` wrapper for 2025-11-25 clients.
 */
const alertsOutputSchema = z.array(
  z.object({
    event: z.string().describe("The kind of weather event"),
    area: z.string().describe("The area the alert covers"),
    severity: z.string().describe("How severe the event is"),
    description: z.string().describe("What is happening"),
    instructions: z.string().describe("What people in the area should do"),
  }),
);

/** The output schema of `get-forecast`: the object case. */
const forecastOutputSchema = z.object({
  latitude: z.number().describe("Latitude the forecast is for"),
  longitude: z.number().describe("Longitude the forecast is for"),
  periods: z
    .array(
      z.object({
        name: z.string(),
        temperature: z.number().nullable(),
        temperature_unit: z.string(),
        wind_speed: z.string(),
        wind_direction: z.string(),
        detailed_forecast: z.string(),
      }),
    )
    .describe("The forecast periods, soonest first"),
});

type Alert = z.infer<typeof alertsOutputSchema>[number];
type Forecast = z.infer<typeof forecastOutputSchema>;

// Format alert data for the model to read
function formatAlert(alert: Alert): string {
  return [
    `Event: ${alert.event}`,
    `Area: ${alert.area}`,
    `Severity: ${alert.severity}`,
    `Description: ${alert.description}`,
    `Instructions: ${alert.instructions}`,
    "---",
  ].join("\n");
}

function formatPeriod(period: Forecast["periods"][number]): string {
  return [
    `${period.name}:`,
    period.temperature === null
      ? "Temperature: Unknown"
      : `Temperature: ${period.temperature}°${period.temperature_unit}`,
    `Wind: ${period.wind_speed} ${period.wind_direction}`,
    period.detailed_forecast,
    "---",
  ].join("\n");
}

// Fetch a state's active alerts, or null when NWS can't be reached
async function fetchAlerts(stateCode: string): Promise<Alert[] | null> {
  const alertsUrl = `${NWS_API_BASE}/alerts/active/area/${stateCode}`;
  const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

  if (!alertsData) {
    return null;
  }

  // `??` catches the nulls NWS sends for these fields; it does not omit
  // them, so a key-missing default would not fire.
  return (alertsData.features ?? []).map((feature) => ({
    event: feature.properties.event ?? "Unknown",
    area: feature.properties.areaDesc ?? "Unknown",
    severity: feature.properties.severity ?? "Unknown",
    description: feature.properties.description ?? "No description available",
    instructions:
      feature.properties.instruction ?? "No specific instructions provided",
  }));
}

// States whose alerts are polled and listed as resources
const WATCH_STATES = (process.env.WATCH_STATES ?? "FL,CA,NY")
  .toUpperCase()
  .split(",");

function alertsUri(stateCode: string): string {
  return `weather://alerts/${stateCode}`;
}

// Poll watched states and publish an update when their alerts change
// Rotating resources step through their states on a timer, for testing pushes
const ROTATE_DEFAULT_URI = `weather://rotate/${WATCH_STATES.join("-")}`;
const rotatingUris = new Set<string>([ROTATE_DEFAULT_URI]);
let rotationTick = 0;

function rotateAlerts(publish: (uri: string) => void): void {
  const seconds = Number(
    process.env.ROTATE_SECONDS ?? process.env.POLL_SECONDS ?? 60,
  );

  setInterval(() => {
    rotationTick++;
    for (const uri of rotatingUris) {
      publish(uri);
    }
  }, seconds * 1000);
  console.error(`Rotating ${[...rotatingUris].join(", ")} every ${seconds}s`);
}

function watchAlerts(publish: (uri: string) => void): void {
  const states = WATCH_STATES;
  const seconds = Number(process.env.POLL_SECONDS ?? 60);
  const seen = new Map<string, string>();

  const poll = async () => {
    for (const state of states) {
      const alerts = await fetchAlerts(state);
      if (!alerts) continue;

      const snapshot = JSON.stringify(alerts);
      if (seen.has(state) && seen.get(state) !== snapshot) {
        console.error(`Alerts changed for ${state}`);
        publish(alertsUri(state));
      }
      seen.set(state, snapshot);
    }
  };

  void poll();
  setInterval(() => void poll(), seconds * 1000);
  console.error(`Watching ${states.join(", ")} every ${seconds}s`);
}

function buildServer(subscribable = false): McpServer {
  const server = new McpServer(
    {
      name: "weather",
      version: "1.0.0",
    },
    subscribable
      ? { capabilities: { resources: { subscribe: true } } }
      : undefined,
  );

  server.registerResource(
    "rotating-alerts",
    new ResourceTemplate("weather://rotate/{states}", {
      list: async () => ({
        resources: [
          {
            uri: ROTATE_DEFAULT_URI,
            name: `Rotating alerts (${WATCH_STATES.join(" → ")})`,
            mimeType: "application/json",
          },
        ],
      }),
    }),
    {
      description:
        "Alerts that switch to the next state in a dash-separated list on every tick",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const states = String(variables.states).toUpperCase().split("-");
      const state = states[rotationTick % states.length];
      rotatingUris.add(uri.href);

      const alerts = await fetchAlerts(state);
      if (!alerts) {
        throw new Error(`Failed to retrieve alerts data for ${state}`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              state,
              tick: rotationTick,
              alertCount: alerts.length,
              alerts,
            }),
          },
        ],
      };
    },
  );

  server.registerResource(
    "state-alerts",
    new ResourceTemplate("weather://alerts/{state}", {
      list: async () => ({
        resources: WATCH_STATES.map((state) => ({
          uri: alertsUri(state),
          name: `${state} weather alerts`,
          mimeType: "application/json",
        })),
      }),
    }),
    {
      description: "Active weather alerts for a two-letter state code",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const stateCode = String(variables.state).toUpperCase();
      const alerts = await fetchAlerts(stateCode);

      if (!alerts) {
        throw new Error(`Failed to retrieve alerts data for ${stateCode}`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(alerts),
          },
        ],
      };
    },
  );

  // The view hosts render for get-alerts: a state picker that re-calls the
  // tool through the host and tells the model what the user switched to.
  registerAppResource(
    server,
    "Weather alerts view",
    ALERTS_VIEW_URI,
    { description: "Interactive list of a state's active weather alerts" },
    async () => ({
      contents: [
        {
          uri: ALERTS_VIEW_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: alertsViewHtml(),
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "get-alerts",
    {
      title: "Get Weather Alerts",
      description: "Get weather alerts for a state",
      inputSchema: z.object({
        state: z
          .string()
          .length(2)
          .describe("Two-letter state code (e.g. CA, NY)"),
      }),
      outputSchema: alertsOutputSchema,
      _meta: { ui: { resourceUri: ALERTS_VIEW_URI } },
    },
    async ({ state }) => {
      const stateCode = state.toUpperCase();
      // An empty result is an empty array, not an error.
      const alerts = await fetchAlerts(stateCode);

      if (!alerts) {
        throw new Error(`Failed to retrieve alerts data for ${stateCode}`);
      }

      const text =
        alerts.length === 0
          ? `No active alerts for ${stateCode}`
          : `Active alerts for ${stateCode}:\n\n${alerts.map(formatAlert).join("\n")}`;

      return { content: [{ type: "text", text }], structuredContent: alerts };
    },
  );

  server.registerTool(
    "get-forecast",
    {
      title: "Get Weather Forecast",
      description: "Get weather forecast for a location",
      inputSchema: z.object({
        latitude: z
          .number()
          .min(-90)
          .max(90)
          .describe("Latitude of the location"),
        longitude: z
          .number()
          .min(-180)
          .max(180)
          .describe("Longitude of the location"),
      }),
      outputSchema: forecastOutputSchema,
    },
    async ({ latitude, longitude }) => {
      // Get grid point data
      const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
      const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

      if (!pointsData) {
        throw new Error(
          `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
        );
      }

      const forecastUrl = pointsData.properties?.forecast;
      if (!forecastUrl) {
        throw new Error("Failed to get forecast URL from grid point data");
      }

      // Get forecast data
      const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
      if (!forecastData) {
        throw new Error("Failed to retrieve forecast data");
      }

      const rawPeriods = forecastData.properties?.periods ?? [];
      if (rawPeriods.length === 0) {
        throw new Error("No forecast periods available");
      }

      const forecast: Forecast = {
        latitude,
        longitude,
        // Only show the next 5 periods.
        periods: rawPeriods.slice(0, 5).map((period) => ({
          name: period.name ?? "Unknown",
          temperature: period.temperature ?? null,
          temperature_unit: period.temperatureUnit ?? "F",
          wind_speed: period.windSpeed ?? "Unknown",
          wind_direction: period.windDirection ?? "Unknown",
          detailed_forecast: period.detailedForecast ?? "No forecast available",
        })),
      };

      const text = `Forecast for ${latitude}, ${longitude}:\n\n${forecast.periods
        .map(formatPeriod)
        .join("\n")}`;

      return { content: [{ type: "text", text }], structuredContent: forecast };
    },
  );

  // URL-mode elicitation demo: asks the client to open a page in the browser.
  // The page never reports back, so any answer ends the call.
  server.registerTool(
    "open-facebook-login",
    {
      title: "Open Facebook Login",
      description: "Ask the client to open the Facebook login page in a browser",
    },
    async (ctx) => {
      const answer = inputResponse(ctx.mcpReq.inputResponses, "login");

      if (answer.kind === "missing") {
        return inputRequired({
          inputRequests: {
            login: inputRequired.elicitUrl({
              message: "Open the Facebook login page in your browser?",
              url: "https://www.facebook.com/login",
            }),
          },
        });
      }

      const text =
        answer.kind === "elicit" && answer.action === "accept"
          ? "Opened https://www.facebook.com/login in the browser."
          : "The user did not open the page.";
      return { content: [{ type: "text", text }] };
    },
  );

  registerPrompts(server, { fetchAlerts, alertsUri });

  return server;
}

const onerror = (error: Error) => {
  console.error("Weather MCP Server error:", error);
};

// One factory serves both protocol eras.
if (process.argv.includes("--http")) {
  const port = Number(process.env.PORT ?? 3333);
  // subscriptions/listen exists only on modern (2026-07-28) connections.
  const handler = createMcpHandler((ctx) => buildServer(ctx.era === "modern"), {
    onerror,
  });
  // Localhost host and origin validation is on by default.
  const app = createMcpHonoApp();
  app.all("/mcp", (c) => handler.fetch(c.req.raw));
  serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => {
    console.error(`Weather MCP Server running on http://127.0.0.1:${port}/mcp`);
    watchAlerts((uri) => handler.notify.resourceUpdated(uri));
    rotateAlerts((uri) => handler.notify.resourceUpdated(uri));
  });
} else {
  serveStdio(() => buildServer(), { onerror });
  console.error("Weather MCP Server running on stdio");
}
