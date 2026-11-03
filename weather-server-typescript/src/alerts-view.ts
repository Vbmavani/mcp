import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
  "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
  "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY", "PR",
];

// The view runs in a sandboxed iframe that can't fetch scripts, so the
// ext-apps client is inlined. Its bundle ends in a single `export{...}`,
// which becomes a global so a plain module script can load it.
function appBundle(): string {
  const require = createRequire(import.meta.url);
  const source = readFileSync(
    require.resolve("@modelcontextprotocol/ext-apps/app-with-deps"),
    "utf8",
  );
  const match = source.match(/export\s*\{([^}]*)\}\s*;?\s*$/);
  if (!match) {
    throw new Error("Unexpected ext-apps bundle shape: no trailing export");
  }

  const entries = match[1].split(",").map((entry) => {
    const [local, exported = local] = entry.trim().split(/\s+as\s+/);
    return `${JSON.stringify(exported)}:${local}`;
  });

  return (
    source.slice(0, match.index) +
    `globalThis.McpApps={${entries.join(",")}};`
  ).replaceAll("</script", "<\\/script");
}

const VIEW_SCRIPT = String.raw`
const { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } =
  globalThis.McpApps;

const select = document.getElementById("state");
const title = document.getElementById("title");
const count = document.getElementById("count");
const list = document.getElementById("alerts");

const app = new App({ name: "weather-alerts", version: "1.0.0" });

function applyHostContext(ctx) {
  if (ctx?.theme) applyDocumentTheme(ctx.theme);
  if (ctx?.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx?.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

function alertsFrom(result) {
  const alerts = result?.structuredContent?.alerts;
  return Array.isArray(alerts) ? alerts : [];
}

function errorFrom(result) {
  if (!result?.isError) return null;
  const text = result.content?.find((block) => block.type === "text")?.text;
  return text ?? "The weather service returned an error.";
}

function showState(state) {
  select.value = state;
  title.textContent = "Active alerts: " + state;
}

function render(result) {
  list.replaceChildren();
  const error = errorFrom(result);
  if (error) {
    count.textContent = error;
    return [];
  }

  const alerts = alertsFrom(result);
  count.textContent =
    alerts.length === 0
      ? "No active alerts"
      : alerts.length + " active alert" + (alerts.length === 1 ? "" : "s");

  for (const alert of alerts) {
    const item = document.createElement("li");
    const head = document.createElement("div");
    const event = document.createElement("strong");
    const severity = document.createElement("span");
    const area = document.createElement("p");
    event.textContent = alert.event;
    severity.textContent = alert.severity;
    severity.className = "severity " + alert.severity.toLowerCase();
    area.textContent = alert.area;
    head.append(event, " ", severity);
    item.append(head, area);
    list.append(item);
  }
  return alerts;
}

// Tell the model what the user switched to, since it can't see the view.
async function shareState(state, alerts) {
  const summary =
    alerts.length === 0
      ? "It now shows no active alerts."
      : "It now shows " + alerts.length + " active alert(s):\n" +
        alerts.map((a) => "- " + a.event + " (" + a.severity + ") — " + a.area).join("\n");
  try {
    await app.updateModelContext({
      content: [
        {
          type: "text",
          text: "The user switched the weather alerts widget to " + state + ". " + summary,
        },
      ],
      structuredContent: { state, alerts },
    });
  } catch (error) {
    console.warn("Host did not accept the context update:", error);
  }
}

app.ontoolinput = ({ arguments: args }) => {
  if (typeof args?.state === "string") showState(args.state.toUpperCase());
};
app.ontoolresult = (result) => render(result);
app.onhostcontextchanged = applyHostContext;

select.addEventListener("change", async () => {
  const state = select.value;
  showState(state);
  count.textContent = "Loading…";
  list.replaceChildren();
  select.disabled = true;
  try {
    const result = await app.callServerTool({
      name: "get-alerts",
      arguments: { state },
    });
    const alerts = render(result);
    if (!result.isError) await shareState(state, alerts);
  } catch (error) {
    count.textContent = "Couldn't load alerts: " + (error?.message ?? error);
  } finally {
    select.disabled = false;
  }
});

await app.connect();
applyHostContext(app.getHostContext());
`;

const STYLES = `
  :root {
    color-scheme: light dark;
    --bg: var(--color-background-primary, light-dark(#fff, #1f1f1e));
    --card: var(--color-background-secondary, light-dark(#f6f6f4, #2a2a28));
    --border: var(--color-border-primary, light-dark(#e2e2de, #3a3a37));
    --text: var(--color-text-primary, light-dark(#1f1f1e, #ececea));
    --muted: var(--color-text-secondary, light-dark(#6b6b66, #a3a39d));
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 16px;
    background: var(--bg);
    color: var(--text);
    font: 14px/1.4 var(--font-sans, system-ui, sans-serif);
  }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  h1 { margin: 0; font-size: 18px; }
  select {
    font: inherit; padding: 6px 8px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--card); color: var(--text);
  }
  #count { margin: 12px 0 8px; color: var(--muted); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  li { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--card); }
  li p { margin: 4px 0 0; color: var(--muted); }
  .severity { font-size: 12px; font-weight: 600; color: var(--muted); }
  .severity.extreme { color: light-dark(#b42318, #ff8a80); }
  .severity.severe { color: light-dark(#b54708, #ffb74d); }
  .severity.moderate { color: light-dark(#a15c07, #ffd54f); }
`;

let cachedHtml: string | undefined;

export function alertsViewHtml(): string {
  cachedHtml ??= `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Weather alerts</title>
<style>${STYLES}</style>
</head>
<body>
<header>
  <h1 id="title">Active alerts</h1>
  <select id="state" aria-label="State">
    ${STATES.map((s) => `<option value="${s}">${s}</option>`).join("")}
  </select>
</header>
<p id="count">Loading…</p>
<ul id="alerts"></ul>
<script type="module">${appBundle()}</script>
<script type="module">${VIEW_SCRIPT}</script>
</body>
</html>`;
  return cachedHtml;
}

// Hosts such as Claude cache views by URI, so a changed view needs a new URI.
// The hash changes whenever the HTML does, so hosts always load the current view.
export const ALERTS_VIEW_URI = `ui://weather/alerts-${createHash("sha256")
  .update(alertsViewHtml())
  .digest("hex")
  .slice(0, 12)}.html`;
