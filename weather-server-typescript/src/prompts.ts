import { completable, type McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

// Each prompt shows a different option the MCP prompts feature offers:
//   weather-help       no arguments, fixed text
//   plan-outdoor-day   required and optional arguments, with autocomplete
//   state-briefing     live data embedded in the prompt as a resource
//   alert-summary      several messages, including an example answer, and
//                      a resource link the client fetches itself

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
  "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
  "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY",
];

const ACTIVITIES = [
  "hiking", "cycling", "running", "picnic", "beach", "camping", "fishing",
  "golf",
];

const WHEN = ["today", "tonight", "tomorrow", "this weekend"];

// Suggest the values that start with what the user has typed so far
function startingWith(values: string[], typed: string, upper = false): string[] {
  const prefix = upper ? typed.toUpperCase() : typed.toLowerCase();
  return values.filter((value) => value.startsWith(prefix));
}

const stateArg = completable(
  z.string().describe("Two-letter US state code, such as CA or NY"),
  (typed) => startingWith(US_STATES, typed, true),
);

export interface PromptDeps {
  fetchAlerts: (stateCode: string) => Promise<unknown[] | null>;
  alertsUri: (stateCode: string) => string;
}

export function registerPrompts(server: McpServer, deps: PromptDeps): void {
  // Option 1: no arguments. The server returns the same text every time.
  server.registerPrompt(
    "weather-help",
    {
      title: "What can this weather server do?",
      description: "Explain the weather server's tools and give example questions",
    },
    () => ({
      description: "Introduce the weather server",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Explain in a short list what you can do with the weather tools you have.",
              "Cover forecasts (US locations only, by latitude and longitude) and active alerts (by two-letter state code).",
              "Then suggest three example questions I could ask.",
            ].join(" "),
          },
        },
      ],
    }),
  );

  // Option 2: arguments. `city` is required; `activity` and `when` are
  // optional and offer autocomplete through completion/complete.
  server.registerPrompt(
    "plan-outdoor-day",
    {
      title: "Plan an outdoor day",
      description: "Find the best time for an outdoor activity in a US city",
      argsSchema: z.object({
        city: z.string().describe("US city and state, such as Austin, TX"),
        // completable goes inside .optional(): the SDK looks for it there.
        activity: completable(
          z.string().describe("What you want to do, such as hiking"),
          (typed) => startingWith(ACTIVITIES, typed),
        ).optional(),
        when: completable(
          z.string().describe("When, such as tomorrow or this weekend"),
          (typed) => startingWith(WHEN, typed),
        ).optional(),
      }),
    },
    ({ city, activity, when }) => {
      const what = activity ?? "spending time outdoors";
      const period = when ?? "the next few days";
      return {
        description: `Plan ${what} in ${city}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `I want to go ${what} in ${city} ${period === "the next few days" ? "in the next few days" : period}.`,
                `Use the latitude and longitude of ${city} to get the forecast, and check active alerts for its state.`,
                "Recommend the best time window, say what to bring, and warn me about any alert that affects the plan.",
                "If the weather makes it a bad idea, say so plainly and suggest an alternative.",
              ].join(" "),
            },
          },
        ],
      };
    },
  );

  // Option 3: live data. The server fetches current alerts while building
  // the prompt and embeds them, so the model sees them without a tool call.
  server.registerPrompt(
    "state-briefing",
    {
      title: "Weather briefing for a state",
      description: "Brief me on a state's active alerts, using data fetched now",
      argsSchema: z.object({ state: stateArg }),
    },
    async ({ state }) => {
      const stateCode = state.toUpperCase();
      const alerts = await deps.fetchAlerts(stateCode);
      const fetchedAt = new Date().toISOString();

      const ask =
        alerts === null
          ? `Live alert data for ${stateCode} could not be fetched. Tell me that, and suggest I try again later.`
          : [
              `Here are the active weather alerts for ${stateCode}, fetched at ${fetchedAt}.`,
              "Give me a briefing: the overall picture in one sentence, then the alerts that matter most, most severe first.",
              "Do not call any tools; use only the data attached.",
            ].join(" ");

      return {
        description: `Live briefing for ${stateCode}`,
        messages: [
          { role: "user", content: { type: "text", text: ask } },
          ...(alerts === null
            ? []
            : [
                {
                  role: "user" as const,
                  content: {
                    type: "resource" as const,
                    resource: {
                      uri: deps.alertsUri(stateCode),
                      mimeType: "application/json",
                      text: JSON.stringify(alerts),
                    },
                  },
                },
              ]),
        ],
      };
    },
  );

  // Option 4: several messages. An example exchange shows the model the
  // answer format, and the real request carries a resource link instead of
  // the data itself, so the client decides whether to fetch it.
  server.registerPrompt(
    "alert-summary",
    {
      title: "Summarize alerts in a fixed format",
      description: "Summarize a state's alerts as a short table, using an example answer as a guide",
      argsSchema: z.object({ state: stateArg }),
    },
    ({ state }) => {
      const stateCode = state.toUpperCase();
      return {
        description: `Alert summary for ${stateCode}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Summarize the active weather alerts for WA.",
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: [
                "**WA: 2 active alerts**",
                "",
                "| Severity | Event | Area |",
                "|---|---|---|",
                "| Severe | Winter Storm Warning | Cascades |",
                "| Minor | Wind Advisory | Puget Sound |",
                "",
                "Main risk: heavy snow in the mountain passes.",
              ].join("\n"),
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Now summarize the active weather alerts for ${stateCode} in exactly that format. The alert data is linked below. If there are none, say "No active alerts" and stop.`,
            },
          },
          {
            role: "user",
            content: {
              type: "resource_link",
              uri: deps.alertsUri(stateCode),
              name: `${stateCode} weather alerts`,
              mimeType: "application/json",
            },
          },
        ],
      };
    },
  );
}
