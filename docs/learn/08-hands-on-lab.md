# 8. Hands-on lab: build, connect, deploy

> **What I asked:** "Which repos should I go through, and what should I get from each?" · "If I run the server and connect it to Claude, I don't need the client, right?" · "How do I integrate it into Claude?" · "Why isn't it in `claude_desktop_config.json`?" · "How can I see its tools from the terminal?" · "Add API-based auth, checked on every call. Can I test from Postman?" · "Add continuous listening and tell me how to test it." · "Deploy this weather MCP online so I can use it from another laptop." · "Add 100 random tools… make it 10,000."

This chapter is the build log, in order, with the traps I hit. The code is in [`weather-server-typescript/`](../../weather-server-typescript/) and [`mcp-client-typescript/`](../../mcp-client-typescript/). They started as the official [quickstart](https://github.com/modelcontextprotocol/quickstart-resources) examples.

## Step 1: Get the right repos

| Order | Repo | Get this from it | Done when you can… |
|---|---|---|---|
| 1 | `quickstart-resources` | The basic flow: connect, list tools, call one | Explain the weather example end to end and add a tool |
| 2 | `modelcontextprotocol` (spec + docs) | The vocabulary: roles, tools vs resources vs prompts | Say when you'd use each |
| 3 | `servers` | How real servers are designed (`memory`, `filesystem`, then `everything`) | Sketch a server for your own use case |
| 4 | `typescript-sdk` | What the SDK does for you | Follow one tool call through it |
| Alongside | `inspector` | The real messages on the wire | Call a tool and read the request and response |

Don't read the SDK front to back (it has ~750 files). Follow something you've already used into it.

## Step 2: Understand the two files

**The server** ([`src/index.ts`](../../weather-server-typescript/src/index.ts)):
1. `makeNWSRequest` calls the US National Weather Service. Ordinary code, nothing MCP.
2. zod schemas describe each tool's output, so types and runtime checks can't drift.
3. `registerTool` adds each tool with a **name + description** (what the model reads), an `inputSchema`, an `outputSchema`, and a handler.

**The client** ([`index.ts`](../../mcp-client-typescript/index.ts)) is a tiny host: it starts the server, lists tools, sends them to Claude's API, runs the tools Claude asks for, and loops. **You don't need it to use Claude**: Claude Desktop and Claude Code already are MCP clients.

## Step 3: Build and connect

```bash
cd weather-server-typescript && npm install && npm run build
```

It needs **Node 24+**.

**Claude Code (stdio, Claude starts the server):**

```bash
claude mcp add --scope user weather -- node /ABSOLUTE/PATH/TO/weather-server-typescript/build/index.js
```

**Claude Code (HTTP, you start the server):**

```bash
node build/index.js --http
```

```bash
claude mcp add --scope user --transport http weather http://127.0.0.1:3333/mcp
```

Scopes: `user` = all your projects, `local` (default) = only the folder you ran it in, `project` = shared with teammates via `.mcp.json`. Then **start a new session**: existing sessions don't pick up new servers. Check with `claude mcp list`.

**Claude Desktop** has its own file, `claude_desktop_config.json`. `claude mcp add` never touches it.

```json
{ "mcpServers": {
    "weather": { "command": "/full/path/to/node", "args": ["/ABSOLUTE/PATH/TO/weather-server-typescript/build/index.js"] }
} }
```

> **Trap:** Claude Desktop keeps the config in memory and writes it back when it quits, so an edit made while it's open can be wiped. **Quit with Cmd+Q, edit, reopen.** Then check Settings → Developer.

> **Trap:** commands in a terminal tab that's sitting in your home folder will `npm install` into the wrong project. Run `pwd` and check `package.json`'s `name` first.

> **Trap:** Claude Desktop custom connectors need a public HTTPS URL; `localhost` URLs work in Claude Code only (its client runs on your machine).

## Step 4: See the tools yourself

- In Claude Code: `/mcp` → `weather` → view tools.
- Inspector UI: `npx @modelcontextprotocol/inspector`, choose Streamable HTTP, paste the URL, **Connect**, then **Tools → List Tools**.
- Inspector CLI: `npx @modelcontextprotocol/inspector --cli <url> --transport http --method tools/list`

The National Weather Service only covers the US. Ask "Any weather alerts in CA?" and Claude picks the tool itself.

## Step 5: Add API-key auth, test in Postman

Clients send `Authorization: Bearer <key>` on **every** POST to `/mcp`, so the check covers listing and every call. A missing or wrong key gets `401` before any tool code runs. The SDK has `requireBearerAuth` for this; the deployed version compares keys with `timingSafeEqual`. Keys live in environment variables, never in code.

Postman's **desktop app** has a built-in MCP request type (**New → MCP**, type HTTP, paste the URL). Its Tools tab worked straight away.

## Step 6: Resources and live subscriptions

I added resources `weather://alerts/{FL,CA,NY}` and a background job that checks the NWS (`POLL_SECONDS`, default 60) and pushes `notifications/resources/updated` to anyone with an open `subscriptions/listen` stream.

```bash
node scripts/test-listen.mjs
```

```bash
node scripts/listen.mjs FL
```

The first uses a fake weather service to force changes (3 checks pass). The second listens to real Florida alerts.

> **What I learned when Postman showed nothing:** Postman's MCP client used the older 2025-11-25 protocol and never opened a listen stream. Pushes only go to clients that subscribe. MCP Inspector showed the stream as *pending*, with pushes arriving. Also: my server polled even with nobody listening; a better design starts polling on the first subscriber.

Then the "why" questions about SSE, WebSocket and scale took over ([Ch 5](05-transports.md)).

## Step 7: Move it into this repo

The code moved into `Vbmavani/mcp`. `main` is protected (PRs only, including for the owner, no force pushes). GitHub only allows branch protection on private repos with a paid plan, so the repo went public.

## Step 8: Build an MCP App (alerts widget)

`get-alerts` links to a UI resource with `_meta.ui.resourceUri`. The page has a state dropdown; changing it calls `get-alerts` again through the host and redraws. After a change, it sends `ui/update-model-context`, so Claude knows what you're looking at. Code: [`src/alerts-view.ts`](../../weather-server-typescript/src/alerts-view.ts).

### MCP App gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Widget errored on load | `structuredContent` was a bare array. The spec allows it, but Claude's MCP Apps need an object. | Return `{ state, alerts }` |
| Widget showed "No active alerts" while text showed 30 | Claude **caches widgets by URI** and kept the old version | Put a content hash in the URI: `ui://weather/alerts-<hash>.html` |
| Claude said "this tool has no UI" | The model only sees name + description, not `_meta` | Ask for the action: "Use the weather connector's get-alerts tool for FL" |
| "get-alerts isn't available in this session" | The tool's output changed while the chat was open | Start a new chat, or disconnect and reconnect the connector |
| Text only in the terminal | Not every client renders MCP Apps | Use Claude Desktop / claude.ai chat |

## Step 9: URL-mode elicitation

`open-facebook-login` returns `input_required` with a URL request; the retry with `accept` returns `complete`. It worked end to end in MCP Inspector ("Open in Browser", then "I've completed it"). Claude Code declined URL requests on its own at the time, a client limitation. ([Ch 4](04-server-features.md#elicitation-the-server-asks-the-user))

> **Trap:** "the tool doesn't exist" turned out to be an **old server process still on port 3333**. Check what's listening before debugging the code:
> ```bash
> lsof -a -p $(lsof -t -iTCP:3333 -sTCP:LISTEN) -d cwd -Fn | tail -1
> ```

## Step 10: Deploy to Render

The server is a long-running process (it polls and holds streams), so serverless hosts (Vercel, Cloudflare Workers) don't fit. Render's free **Web Service** does (it sleeps after ~15 idle minutes; the first request then takes up to a minute).

Code changes needed: listen on `0.0.0.0` when deployed, allow the public hostname in the host check, and require an API key.

| Render field | Value |
|---|---|
| Root directory | `weather-server-typescript` |
| Build command | `npm install && npm run build` |
| Start command | `node build/index.js --http` |
| Env: `HOST` | `0.0.0.0` |
| Env: `MCP_API_KEYS` | Comma-separated keys (set on Render only) |

Render also has its own hosted MCP server (`https://mcp.render.com/mcp`, API-key auth). I used it from Claude to create the service, set environment variables, trigger deploys and read logs. It can't delete services or create free-tier services, so create the service in the dashboard first.

**Connect from another machine:**

```bash
claude mcp add --transport http weather https://<your-service>.onrender.com/mcp --header "Authorization: Bearer <key>"
```

**From claude.ai:** Settings → Connectors → Add custom connector → URL, **Authentication: No sign-in**, then **Add header** `Authorization` = `Bearer <key>`. ([Why "Sign in" fails here](06-auth.md#how-the-deployed-weather-server-does-it-static-api-key).)

A clean habit from this step: each change goes on a branch, deploys to a **preview service**, gets checked, and only reaches `main` by PR.

## Step 11: Stress test: how many tools?

I added `tool_1 … tool_N`, controlled by an environment variable on a separate test service, so changing N needed no code change.

| Tools | `tools/list` size | Fetch time | Server memory |
|---|---|---|---|
| 103 | ~31 KB | quick | — |
| 1,003 | ~290 KB | quick | — |
| 9,993 | ~2.9 MB | ~11 s | ~220 MB of 512 MB |
| 10,003 | ~2.9 MB | ~11 s | similar |

The server coped. The questions are on the client side: does it cap how many tools it loads, does connecting time out, and can the model still find the 3 real tools among 10,000 near-identical ones? The protocol's answers are **pagination** (`nextCursor`) and, on the roadmap, **progressive discovery**. Then I deleted the branch and redeployed `main`.

**Next:** [9. Ecosystem and the future →](09-ecosystem-and-future.md)
