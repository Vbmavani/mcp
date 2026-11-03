# 10. Every question I asked

These are my actual questions from the sessions, in order, with typos fixed and requests to build things shortened. Use them as a checklist: if you can answer one without opening the linked chapter, you've got it.

## 1 November

| Time (UTC) | Question | Answered in |
|---|---|---|
| 11:00 | I want to learn MCP in detail: each and every step, why it is, how it started, why we need it. | [Ch 1](01-why-mcp.md), [Ch 2](02-who-does-what.md) |
| 12:23 | jsonrpc — what's this? | [Ch 3](03-messages.md#json-rpc-in-one-minute) |
| 12:25 | How is the ID created? In a real use case, can't it be the same from different clients? | [Ch 3](03-messages.md#request-ids) |
| 12:26 | So the client basically sends a REST API call? | [Ch 3](03-messages.md#is-it-just-a-rest-call) |
| 12:27 | The ID comes from the client, so it's the MCP company's responsibility, not Claude's? | [Ch 3](03-messages.md#request-ids) |
| 12:28 | Take Jira and Claude, with ticket CRUD. What's the responsibility of what, from scratch to auth to everything? | [Ch 2](02-who-does-what.md#the-jira-example-end-to-end) |
| 12:30 | How does Claude know what client to create? Is the Jira client stored in Claude forever, or fetched every time? | [Ch 2](02-who-does-what.md#is-a-jira-client-stored-in-claude-forever) |
| 12:32 | So the tool list is either fresh or cached, and the client is just Claude making a call? | [Ch 2](02-who-does-what.md#is-a-jira-client-stored-in-claude-forever) |
| 12:33 | So the MCP client is just the way to call the MCP server, where the actual REST call happens? | [Ch 2](02-who-does-what.md#so-the-client-is-just-how-claude-calls-the-server-and-the-server-makes-the-real-rest-call) |
| 12:34 | Is this client code already in Claude? Then why fetch tools every time? | [Ch 2](02-who-does-what.md) |
| 12:35 | Give me an example of what lives in the MCP client and the MCP server. | [Ch 2](02-who-does-what.md) |
| 12:49 | How do notifications work, and why? | [Ch 3](03-messages.md#notifications) |
| 12:51 | How does `resultType` (`complete`, `input_required`, `task`) work? | [Ch 3](03-messages.md#resulttype) |
| 12:52 | Harness keeps asking me to confirm deploys. Can my client always answer "yes" without showing it? | [Ch 3](03-messages.md#requeststate-a-sealed-ticket) |
| 13:12 | How is `requestState` created? Can't I send it directly and skip the first call? | [Ch 3](03-messages.md#requeststate-a-sealed-ticket) |
| 13:14 | How is it created on the client side? If the client has a key, it can be faked. | [Ch 3](03-messages.md#requeststate-a-sealed-ticket) |
| 13:14 | What does "elicitation" mean in English? What does "arbitrary" mean? | [Ch 4](04-server-features.md#elicitation-the-server-asks-the-user), [Ch 7](07-security.md) |
| 13:17 | All big MCP servers just have tools, not a model, right? | [Ch 2](02-who-does-what.md#mcp-servers-dont-have-a-model-right) |
| 13:19 | How do I see all of GitHub's MCP tools? | [Ch 8](08-hands-on-lab.md#step-4-see-the-tools-yourself) |
| 13:25 | Is "Needs approval" in Claude the same as `input_required`, or is it Claude's own thing? | [Ch 2](02-who-does-what.md#needs-approval-is-not-mcp) |
| 15:30 | Does the token stay the same over time, or get changed or deactivated? | [Ch 6](06-auth.md#tokens-over-time) |
| 15:31 | Is the token saved on the server? Explain creating a Jira ticket step by step. | [Ch 6](06-auth.md) |
| 15:32 | I call `create_issue` after 5 days. Is my access token still valid? | [Ch 6](06-auth.md#tokens-over-time) |
| 15:33 | Is the refresh token saved in Claude Code's database? What about claude.ai? | [Ch 6](06-auth.md#where-tokens-are-stored) |
| 15:34 | Are access and refresh tokens stored for each MCP? And how do API keys work? | [Ch 6](06-auth.md#where-tokens-are-stored) |
| 15:35 | How many types of login does MCP have? | [Ch 6](06-auth.md#the-kinds-of-login) |
| 15:58 | Tell me about MCP 1.0 and 2.0. Will there be a 3.0? | [Ch 1](01-why-mcp.md#there-is-no-mcp-20) |
| 16:01 | Tell me the story of JSON-RPC: how it was invented and why 2.0 was needed. | [Ch 1](01-why-mcp.md#side-story-json-rpc-and-why-it-needed-a-20) |
| 16:03 | Compare MCP and JSON-RPC 2.0. Did both need new versions for the same reason? | [Ch 1](01-why-mcp.md#side-story-json-rpc-and-why-it-needed-a-20) |
| 16:10 | Which repos should I go through, in what order, and what should I get from each? | [Ch 8](08-hands-on-lab.md#step-1-get-the-right-repos) |
| 16:51 | Explain how the quickstart works, everything. | [Ch 8](08-hands-on-lab.md#step-2-understand-the-two-files) |
| 16:57 | If I run the server and connect it to Claude, I don't need the client, right? | [Ch 8](08-hands-on-lab.md#step-2-understand-the-two-files) |
| 17:06 | How do I integrate it into Claude, and with which scope? | [Ch 8](08-hands-on-lab.md#step-3-build-and-connect) |
| 17:08 | How can I see its tools myself, from the terminal? | [Ch 8](08-hands-on-lab.md#step-4-see-the-tools-yourself) |
| 17:12 | Why isn't it in `claude_desktop_config.json`? | [Ch 8](08-hands-on-lab.md#step-3-build-and-connect) |
| 17:22 | Add API-based authentication, checked on every call. Can I test it from Postman? | [Ch 8](08-hands-on-lab.md#step-5-add-api-key-auth-test-in-postman) |
| 17:36 | What do Prompts and Resources mean? | [Ch 4](04-server-features.md#tools-resources-prompts) |
| 18:40 | How is `subscriptions/listen` called? Add continuous listening (SSE) and tell me how to test it. | [Ch 8](08-hands-on-lab.md#step-6-resources-and-live-subscriptions) |

## 2 November

| Time (UTC) | Question | Answered in |
|---|---|---|
| 13:34 | Nothing is showing in Postman's Resources tab. | [Ch 4](04-server-features.md#resources) |
| 13:39 | Why can't I see pushes in Postman? Postman is an MCP client, and if I stop it, the server should stop too. | [Ch 5](05-transports.md#subscriptions) |
| 14:02 | How does the subscription work? Is it REST? How is it different from WebSocket? | [Ch 5](05-transports.md#rest-vs-sse-vs-websocket) |
| 14:17 | WebSocket can't handle millions of connections but REST can. Does SSE have the same problem? | [Ch 5](05-transports.md#websocket-cant-handle-millions-of-connections-but-rest-can-does-sse-have-the-same-problem) |
| 14:20 | Why did MCP go with SSE? Do Jira, GitHub or LogRocket support subscriptions? Is it useful in production? What's it called in GraphQL? | [Ch 5](05-transports.md#why-mcp-chose-sse) |
| 14:21 | Does GraphQL use WebSocket or SSE? | [Ch 5](05-transports.md#graphqls-version) |
| 14:22 | Is it easy to set up compared with plain HTTP or GraphQL? | [Ch 5](05-transports.md#setup-effort-easiest-to-hardest) |
| 14:31 | Research 15 big companies and the MCP tools they provide. | [Ch 9](09-ecosystem-and-future.md#what-big-companies-ship-november-2026) |
| 22:45 | What is MCP? (a one-paragraph version) | [Ch 1](01-why-mcp.md) |
| 22:58 | I want to try 10 MCP servers myself. | [Ch 9](09-ecosystem-and-future.md#ten-servers-to-try-no-account-needed) |
| 23:02 | I want to try the newer features, like loading an HTML component in Claude. What else? | [Ch 4](04-server-features.md#mcp-apps-interactive-ui-inside-the-chat) |
| 23:07 | What level of transport is stdio? I know HTTP, but how does stdio work? | [Ch 5](05-transports.md#stdio-a-pipe-not-a-network) |
| 23:10 | Give me, one by one, the uses of stdio. | [Ch 5](05-transports.md#stdio-a-pipe-not-a-network) |
| 23:11 | If I run Playwright MCP locally, does it use stdio? | [Ch 5](05-transports.md#stdio-a-pipe-not-a-network) |
| 23:17 | What happens when I change the widget's dropdown in Claude Desktop? How does auth work for its calls? | [Ch 4](04-server-features.md#mcp-apps-interactive-ui-inside-the-chat) |
| 23:23 | What security problems are there? Can a man-in-the-middle attack happen through Harness? | [Ch 7](07-security.md) |
| 23:27 | Tell me all the components of MCP. | [MCP-COMPONENTS.md](../../MCP-COMPONENTS.md) |

## 3 November

| Time (UTC) | Question | Answered in |
|---|---|---|
| 00:46 | Elicitation forms come through `input_required`, and Claude shows them as HTML forms? | [Ch 4](04-server-features.md#elicitation-the-server-asks-the-user) |
| 00:47 | What modes are there? | [Ch 4](04-server-features.md#elicitation-the-server-asks-the-user) |
| 00:48 | Implement URL mode that sends the user to facebook.com/login. | [Ch 8](08-hands-on-lab.md#step-9-url-mode-elicitation) |
| 00:57 | What are capabilities, and what values can they have? | [Ch 3](03-messages.md#capabilities) |
| 01:01 | So the server reads the client's capabilities and responds based on them? | [Ch 3](03-messages.md#capabilities) |
| 01:19 | What does `server/discover` return? | [Ch 3](03-messages.md#serverdiscover) |
| 01:26 | Make one big object of all of MCP, with a dropdown for every possible value. | [Master object page](https://vbmavani.github.io/mcp/) |
| 02:00 | What's LogRocket MCP's rate limit, and how does a client know? | [Ch 9](09-ecosystem-and-future.md), [Ch 7](07-security.md) |
| 02:01 | Tell me about long-running jobs with a handle, with a real use case. | [Ch 4](04-server-features.md#tasks-long-running-jobs) |
| 02:04 | Give me a way to share skills via MCP. | [Ch 4](04-server-features.md#skills-over-mcp) |
| 02:05 | What are prompts, alongside tools and resources? Is it an AI prompt? | [Ch 4](04-server-features.md#prompts) |
| 13:09 | I want to deploy this weather MCP online and use it from another laptop. | [Ch 8](08-hands-on-lab.md#step-10-deploy-to-render) |
| 13:12 | Which Render service type does MCP fall under? | [Ch 8](08-hands-on-lab.md#step-10-deploy-to-render) |
| 13:25 | claude.ai says "Couldn't register with Weather's sign-in service". | [Ch 6](06-auth.md#how-the-deployed-weather-server-does-it-static-api-key) |
| 13:30 | How do I trigger the rich UI? It's not working. | [Ch 8](08-hands-on-lab.md#mcp-app-gotchas) |
| 13:42 | What's the maximum number of tools in an MCP server? | [Ch 9](09-ecosystem-and-future.md#how-many-tools-is-too-many) |
| 13:54 | Add 100 random tools… then 1,000, 9,990, 10,000. | [Ch 8](08-hands-on-lab.md#step-11-stress-test-how-many-tools) |
| 14:37 | How is auth working on the deployed server? | [Ch 6](06-auth.md#how-the-deployed-weather-server-does-it-static-api-key) |
| 14:39 | And if it used OAuth? | [Ch 6](06-auth.md#the-full-oauth-flow) |
| 22:43 | Is there data on how many companies adopt MCP per month? | [Ch 9](09-ecosystem-and-future.md#adoption-in-numbers) |
| 23:04 | Has anything like this happened in the past, like a standard launched by one company? | [Ch 9](09-ecosystem-and-future.md#has-this-happened-before) |
| 23:07 | How many repos should I go through to learn MCP? | [Ch 9](09-ecosystem-and-future.md#which-repos-to-read) |
