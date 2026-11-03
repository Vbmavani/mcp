# A Simple MCP Weather Server written in TypeScript

A minimal MCP server that exposes US weather data from the [National Weather Service API](https://www.weather.gov/documentation/services-web-api) as two tools:

- `get-forecast` – get the forecast for a location (takes `latitude` and `longitude`)
- `get-alerts` – get active weather alerts for a US state (takes a two-letter state code)

This example accompanies the [Build an MCP server](https://modelcontextprotocol.io/docs/develop/build-server) tutorial.

## Prerequisites

- Node.js 24+
- npm

## Build and run

```bash
npm install
npm run build
node build/index.js
```

The server communicates over stdio, so running it directly just waits for a client on stdin. To see it in action, launch it from one of the client examples in this repository, for example:

```bash
cd ../mcp-client-typescript
npm install && npm run build
node build/index.js ../weather-server-typescript/build/index.js
```

## Deploy online (Render)

The server also runs over HTTP: `node build/index.js --http`. Locally it listens on `127.0.0.1:3333` with no API key. On a host, set these environment variables on the host, never in the code:

| Variable | Value |
|---|---|
| `HOST` | `0.0.0.0`, so the host can reach the server |
| `MCP_API_KEYS` | Comma-separated API keys. Required when `HOST` isn't `127.0.0.1`. |
| `ALLOWED_HOSTS` | Your public hostname. Optional on Render, which sets `RENDER_EXTERNAL_HOSTNAME`. |

On Render, create a **Web Service** from this repo with:

| Setting | Value |
|---|---|
| Root Directory | `weather-server-typescript` |
| Build Command | `npm install && npm run build` |
| Start Command | `node build/index.js --http` |

Clients send a key as `Authorization: Bearer <key>`. For Claude Code:

```bash
claude mcp add --transport http weather https://<your-service>.onrender.com/mcp --header "Authorization: Bearer <key>"
```

## Structured content

Both tools declare an `outputSchema` and return `structuredContent`. Both return objects: `get-forecast` returns `{ latitude, longitude, periods }`, and `get-alerts` returns `{ state, alerts }`. Revision `2026-07-28` also allows a top-level array, but MCP Apps hosts such as Claude reject array `structuredContent`, and `get-alerts` has an App view.

## Alerts widget

`get-alerts` ships an [MCP App](https://github.com/modelcontextprotocol/ext-apps) view, `ui://weather/alerts.html` (see `src/alerts-view.ts`). Hosts that support MCP Apps, such as Claude Desktop, render it in a sandboxed iframe next to the tool result.

- **State picker.** Changing the state calls `get-alerts` again through the host (`tools/call` over `postMessage`). The view never holds credentials: the host forwards the call over its own connection to this server.
- **Model context.** After a switch, the view sends `ui/update-model-context` with the new state and its alerts, so the model knows what the user is looking at. Hosts that don't support it ignore the update and the view keeps working.

The view is a single self-contained HTML page: the `@modelcontextprotocol/ext-apps` client bundle is inlined when the resource is first read, so there is no separate frontend build.
