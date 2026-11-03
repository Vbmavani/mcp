# Learn MCP the way I did

This is a cleaned-up record of how I learned the **Model Context Protocol (MCP)** in about three days (1–3 November 2026), working with Claude. It keeps the questions I actually asked, in the order I asked them, and the answers that made things click. The code I built along the way is the weather server and client in this repo.

Read it in order if you're new. Each chapter starts with the questions that led to it, so you can see *why* each topic came up, not just what it is.

**Read it online:** [vbmavani.github.io/mcp/learn](https://vbmavani.github.io/mcp/learn/)

## Chapters

| # | Chapter | You'll be able to... |
|---|---|---|
| 0 | [How I learned it](00-how-i-learned.md) | Follow the same path: the order, the method, and what to skip |
| 1 | [Why MCP exists](01-why-mcp.md) | Explain the M×N problem, where MCP came from, and how it's versioned |
| 2 | [Who does what](02-who-does-what.md) | Say what the host, client, server and model each do, using Jira as the example |
| 3 | [Messages: JSON-RPC and friends](03-messages.md) | Read any MCP message: IDs, `_meta`, `resultType`, notifications, capabilities |
| 4 | [What a server offers](04-server-features.md) | Choose between tools, resources and prompts, and know elicitation, Tasks, Skills and MCP Apps |
| 5 | [Transports, streams and subscriptions](05-transports.md) | Pick stdio or HTTP, and compare SSE, WebSocket and REST polling |
| 6 | [Auth: OAuth, tokens and API keys](06-auth.md) | Walk through a full OAuth login and know where tokens live |
| 7 | [Security](07-security.md) | Name the real risks: prompt injection, tool poisoning, untrusted servers |
| 8 | [Hands-on lab: build, connect, deploy](08-hands-on-lab.md) | Run the weather server, connect it to Claude, deploy it, and avoid the traps I hit |
| 9 | [Ecosystem and the future](09-ecosystem-and-future.md) | Know which servers to try, how many tools is too many, and where MCP is heading |
| 10 | [Every question I asked](10-question-log.md) | Skim the raw questions, with links to where each is answered |

## Related pages in this repo

- [MCP master object](https://vbmavani.github.io/mcp/): every part of the spec as one object, with a dropdown for every allowed value.
- [MCP-COMPONENTS.md](../../MCP-COMPONENTS.md): every component, grouped by role.
- [weather-server-typescript](../../weather-server-typescript/) and [mcp-client-typescript](../../mcp-client-typescript/): the code built in the lab.

## A note on accuracy

Everything here was checked against the **2026-07-28** spec at the time. MCP changes quickly, and many tutorials online still teach the older `initialize` handshake that this revision removed. When something here disagrees with the [official docs](https://modelcontextprotocol.io), trust the docs.
