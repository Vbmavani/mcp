# 5. Transports, streams and subscriptions

> **What I asked:** "Stdio transport: what is this level of transport? I know HTTP/1, but how does stdio work?" · "Give me one by one what stdio is used for." · "If I run Playwright MCP locally, does it use stdio?" · "How is the subscription working? Is it REST? How is it different from WebSocket?" · "Can SSE handle millions like REST, or does it have WebSocket's problem?" · "Why did MCP go with SSE? Do GitHub or LogRocket even support subscriptions?" · "Does GraphQL use WebSocket or SSE?" · "Is it easy to set up?"

## The two transports

| | stdio | Streamable HTTP |
|---|---|---|
| Runs | On your machine, as a child process | Anywhere on a network, at a URL |
| Users | One | Many |
| Login | Credentials from environment variables | OAuth 2.1 (or a custom API key) |
| Lifetime | Starts and stops with the client | Runs on its own |
| Config looks like | `"command": "npx", "args": [...]` | `"url": "https://…/mcp"` |

**Quick test: `command` in the config means stdio; `url` means HTTP.** (HTTP+SSE, the older remote transport, is deprecated.)

## stdio: a pipe, not a network

Stdio doesn't use the network at all. It's a **pipe between two programs on the same computer**, provided by the operating system.

| Layer | Over a network | stdio |
|---|---|---|
| Your messages | JSON-RPC | JSON-RPC |
| Framing | HTTP headers, `Content-Length` | One message per line, ended by `\n` |
| Byte delivery | TCP | OS pipe, in kernel memory |
| Addressing | IP + port | None: the processes are connected directly |

Every program gets three channels: `stdin` (0), `stdout` (1) and `stderr` (2). You already use them: `ls | grep mcp`.

```
Client (Claude Code)                    Server (node build/index.js)
  writes ──────── pipe ────────►  stdin    reads requests
  reads  ◄─────── pipe ─────────  stdout   writes responses
  logs   ◄─────── pipe ─────────  stderr   writes logs
```

1. The client **starts the server as a child process**.
2. It writes one line of JSON + `\n` to the server's stdin.
3. The server writes one line back to stdout. The client matches it by `id`.
4. To shut down, the client closes stdin.

> **Why `console.log` breaks a stdio server:** stdout *is* the message channel, so `starting...` gets parsed as a broken JSON message. Log to stderr (`console.error`).

> **"So I don't run the server myself?"** Right, for stdio. If you start it in a terminal, it just waits for input on *that* terminal and Claude can't reach it. You tell the client *how to start it*, and the client launches its own copy.

**What stdio is used for:** anything that happens on *your* machine, for *you*: reading/writing files, running commands, local Git, a local database, driving a browser (Playwright, Puppeteer), talking to desktop apps, calling an API with your own key, and developing your own server. **Use HTTP instead** when many people share a server, it must run in the cloud, or users log in with their own accounts.

**Playwright MCP** uses stdio with the standard config (`npx @playwright/mcp@latest`). Give it `--port 8931` and it runs as an HTTP server instead. The browser runs on your machine either way.

## Streamable HTTP

Every message is a POST to one endpoint (e.g. `/mcp`). The reply is either one JSON body or a **Server-Sent Events (SSE)** stream: `Content-Type: text/event-stream` with `event: message` / `data: {...}` lines. If you've seen `event: message` in Postman's MCP responses, that's SSE.

## Subscriptions

A subscription is **plain HTTP that stays open**. Not REST, not WebSocket.

```
Client                                         Server
  │── POST /mcp  subscriptions/listen ───────────▶│  "tell me about weather://alerts/FL"
  │◀── 200, text/event-stream ────────────────────│  response starts, never ends
  │◀── event: acknowledged ───────────────────────│
  │◀── event: notifications/resources/updated ────│  push #1
  │── POST /mcp  resources/read ─────────────────▶│  separate normal request for the new data
  │◀── 200 { state: "FL", alerts: [...] } ────────│
  │── closes the stream ─────────────────────────▶│  pushes stop
```

- **Always on?** Only while the client holds the stream open. (In the Inspector it shows as *pending* the whole time.)
- **Benefit:** one request, and you hear back immediately when something changes, instead of asking "anything new?" every few seconds.
- **Pushes only say "it changed"**, so the client always reads the resource afterwards.
- You can subscribe to resource updates and to `toolsListChanged`, which is how a client can keep its cached tool list fresh.

> **Why Postman never got pushes:** Postman's MCP client spoke the older 2025-11-25 protocol and never opened a listen stream. It only sent one-off `tools/call` and `resources/read`. A small Node listener on the 2026-07-28 protocol received pushes fine. When a client doesn't do something, check its protocol version first.

## REST vs SSE vs WebSocket

| | REST | SSE | WebSocket |
|---|---|---|---|
| Connection | Opens and closes per request | One long HTTP response | One upgraded, long-lived socket |
| Direction | Client asks | Server → client (client sends normal POSTs) | Both ways |
| Built on | HTTP | HTTP | Its own protocol after an HTTP upgrade |
| Proxies, auth, load balancers | Just work | Mostly just work | Each hop must allow the upgrade |
| Reconnect | — | Built into browsers (`EventSource`) | You write it |
| Typical use | CRUD APIs | Live feeds, notifications, MCP | Chat, games, collaborative editing |

### "WebSocket can't handle millions of connections, but REST can. Does SSE have the same problem?"

**SSE has the same cost as WebSocket**, because the cost comes from the *open connection*, not the protocol. Each idle connection holds a socket, a file descriptor, some memory and TLS state.

But the premise needs correcting:
- **WebSocket isn't unusually expensive.** Event-driven servers (Node, Go, Erlang) can hold hundreds of thousands to millions of mostly idle connections per machine. WhatsApp's well-known example was ~2 million on one Erlang server around 2012. "WebSockets don't scale" comes from old thread-per-connection servers.
- **"Millions with REST" means millions of *requests per second*, not millions of clients connected at once.** And REST can't push, so to get updates every client must poll:

| A million clients wanting updates | Cost |
|---|---|
| Poll every 5 s over REST | ~200,000 requests/second, each with headers, auth and often a DB query, even when nothing changed |
| SSE or WebSocket | A million mostly idle connections, and traffic only when something changes |

The hard parts at scale are the same for SSE and WebSocket: fanning out updates across many servers (often Redis pub/sub), and surviving mass reconnects after a deploy.

### Why MCP chose SSE

It's plain HTTP: the same POST endpoint, auth headers, proxies and load balancers keep working, and most MCP traffic is request/response anyway. WebSocket would need a second protocol path through every hop.

### Is it used in production?

I checked rather than guessed: **GitHub's MCP server explicitly rejects `subscriptions/listen` and runs stateless.** Atlassian and LogRocket don't document subscription support. For big multi-tenant servers, tool lists are cached with `ttlMs` and refreshed on reconnect, and the roadmap is moving toward webhooks/push delivery for events. Subscriptions shine for single-user or small-team servers where data really does change (like live weather alerts).

### GraphQL's version

GraphQL calls it a **Subscription** (next to Query and Mutation). The spec doesn't choose a transport. **WebSocket (`graphql-ws`) is the usual default** (Apollo, Hasura, AppSync). **SSE (`graphql-sse`)** is less common (GraphQL Yoga), picked for the same plain-HTTP reasons as MCP. One difference: GraphQL usually pushes the new data; MCP only says "changed".

### Setup effort, easiest to hardest

| Option | Why |
|---|---|
| REST | Request in, response out |
| **SSE** | Still plain HTTP: set `text/event-stream`, keep the response open, write `data:` lines |
| WebSocket | A WebSocket library, your own reconnects, heartbeats and message format, and proxy upgrades |
| GraphQL subscriptions | Everything WebSocket needs, plus a GraphQL schema, resolvers and usually Redis pub/sub |

```js
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  const timer = setInterval(() => res.write(`data: ${Date.now()}\n\n`), 5000);
  req.on("close", () => clearInterval(timer));
});
```

SSE gotchas in production: proxies like Nginx buffer by default (`X-Accel-Buffering: no`), and HTTP/1.1 browsers allow ~6 connections per domain (HTTP/2 removes that).

**Next:** [6. Auth →](06-auth.md)
