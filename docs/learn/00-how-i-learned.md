# 0. How I learned it

I came to MCP right after spending a month learning Claude skills. The plan was to reuse what worked there: get the map first, build something throwaway, ask "why" until I could explain it back, then break it on purpose.

## The three days

| When | What I did | Where it's covered |
|---|---|---|
| **1 Nov, morning** | Asked for MCP "in detail, each and every step: why it is, how it started, why we need it". Got the big picture: the M×N problem, history, layers, host/client/server. | [Ch 1](01-why-mcp.md), [Ch 2](02-who-does-what.md) |
| **1 Nov, midday** | Went down every rabbit hole: what JSON-RPC is, who creates request IDs, is it just REST, who owns what in a Jira example, notifications, `resultType`, `requestState`. | [Ch 2](02-who-does-what.md), [Ch 3](03-messages.md) |
| **1 Nov, afternoon** | OAuth: how long tokens last, where they're stored, API keys, how many login types exist. Then versions: is there an "MCP 2.0"? (No.) The story of JSON-RPC. | [Ch 6](06-auth.md), [Ch 1](01-why-mcp.md) |
| **1 Nov, evening** | Cloned the official repos, ran the TypeScript weather server, connected it to Claude Code and Claude Desktop, called it from Postman, added API-key auth and a live `subscriptions/listen` stream. | [Ch 8](08-hands-on-lab.md) |
| **2 Nov** | Why subscriptions don't show in Postman, how SSE differs from REST and WebSocket, whether it scales, GraphQL's version. Researched 16 big companies' MCP servers. Moved the code into this repo. Learned stdio, then security. | [Ch 5](05-transports.md), [Ch 7](07-security.md), [Ch 9](09-ecosystem-and-future.md) |
| **2–3 Nov, night** | Built an MCP App (an interactive alerts widget inside Claude), URL-mode elicitation, capabilities, `server/discover`, Tasks, Skills over MCP, prompts. Built the [master object page](https://vbmavani.github.io/mcp/). | [Ch 4](04-server-features.md), [Ch 3](03-messages.md) |
| **3 Nov** | Deployed the server to Render with API keys, connected it from another Claude account, fixed the widget twice, stress-tested 10,000 tools, then walked through how the auth and OAuth flows actually work. Looked at adoption numbers and how MCP compares with past standards. | [Ch 8](08-hands-on-lab.md), [Ch 6](06-auth.md), [Ch 9](09-ecosystem-and-future.md) |

## The method that worked

1. **Ask for the whole map first.** One long answer covering why, history, parts and layers. You won't understand it all, but every later question has somewhere to land.
2. **Chase every word you don't know.** "jsonrpc what's this?", "what does arbitrary mean?", "what's elicitation in English?" Small questions are cheap and they unblock big ones.
3. **Always ask "who does this?"** Most of my confusion was about responsibility: does Claude create the ID or the server? Is approval part of MCP or part of the app? A table of who-does-what fixed it every time.
4. **Use one concrete example everywhere.** I used *"Claude creating a Jira ticket"* for architecture, auth and errors. It's much easier than abstract roles.
5. **Build the smallest real thing, then poke it.** The weather server is tiny. Connecting it to three different clients (Claude Code, Claude Desktop, Postman) taught me more than reading the spec.
6. **When something doesn't work, find out which side is wrong.** Postman not showing pushes, Claude Code declining URL prompts, a widget showing stale data: each one taught a real concept (protocol versions, client capabilities, caching).
7. **Break it on purpose.** I pushed the server to 10,000 tools to see what fails. The answer (2.9 MB tool lists, ~11 s fetch, no paging) made pagination and progressive discovery obvious.
8. **Write it down and publish it.** The [components guide](../../MCP-COMPONENTS.md), the [master object](https://vbmavani.github.io/mcp/) and these chapters all came from saying "now put that in the repo".

## If you're starting today

- **Read in this order:** the spec's concepts → one SDK's quickstart → run the [Inspector](https://github.com/modelcontextprotocol/inspector) against it → read 2–3 reference servers. Details in [Ch 9](09-ecosystem-and-future.md#which-repos-to-read).
- **Skip old tutorials.** If a tutorial starts with an `initialize` handshake or uses `server.tool()`, it predates the 2026-07-28 spec and the v2 SDKs.
- **Your goal:** build a small server, connect it to Claude, and explain out loud what happens when a tool is called. If you can do that, you understand MCP.
- **Time:** the concepts took about a day of questions. The hands-on part took about two more.
