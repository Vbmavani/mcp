# 2. Who does what

> **What I asked:** "Let's take Jira and Claude. What's the responsibility of what, from scratch to auth to everything?" · "Is the Jira client stored in Claude forever, or fetched every time?" · "So the MCP client is just the way to call the MCP server, where the actual REST call happens?" · "If the client code is already there, why fetch tools every time?" · "MCP servers only have tools, not a model, right?"

## The three participants (plus the model)

| Part | Example | Job |
|---|---|---|
| **Host** | Claude Desktop, Claude Code, ChatGPT, Cursor | Runs the model, shows the UI, gets your consent, runs the agent loop |
| **Client** | A connector *inside* the host | Holds one connection to one server and sends the MCP messages |
| **Server** | Jira's, GitHub's, or your weather server | Offers tools, data and prompts; does the real work |
| **Model** | Claude | Picks which tool to call and with what arguments. That's all. |

Two things that are easy to get wrong:

- **The model never talks to MCP servers.** The model *asks* for a tool. The host checks the request (and may ask you), and the client sends the message. That's why a host can block a call.
- **Each server gets its own client.** Servers are isolated: they can't see each other or the whole conversation.

```
You ⇄ Host ⇄ Model API          (the host asks the model what to do)
        ⇅
      Client ⇄ MCP server ⇄ Jira REST API   (the client runs the tool)
```

## One tool call, step by step

1. The host connects to the server.
2. It calls `tools/list`.
3. It passes the tool descriptions to the model.
4. The model asks for a tool.
5. The host applies its rules and asks you if needed.
6. The client sends `tools/call`, and the server does the work.
7. The result goes back to the model.
8. The model answers, or asks for another tool.

**Only steps 1, 2 and 6 are MCP.** Steps 3, 4 and 7 use the model provider's API. Repeating this loop is what makes something an *agent*.

## The Jira example, end to end

Assume Atlassian runs a remote Jira MCP server and you use it from the Claude app (tool names simplified).

| Part | Example | Responsible for |
|---|---|---|
| User | You | Connecting Jira, logging in, approving actions |
| Host + client | Claude app (Anthropic) | UI, consent, agent loop, sending MCP messages, storing tokens securely |
| Model | Claude | Choosing tools and arguments, writing the answer |
| MCP server | Jira MCP server (Atlassian) | Defining tools, validating input, checking permissions, calling Jira |
| Authorization server | Atlassian login | Logging you in, showing consent, issuing tokens |
| Backend | Jira API + database | Doing the real CRUD |

| Phase | What happens |
|---|---|
| **Before anyone uses it** | Atlassian builds `create_ticket`, `get_ticket`, … with descriptions and schemas, deploys at a URL, sets up OAuth. Anthropic builds the generic MCP client into Claude. |
| **Connect and log in** | You add the connector → client calls without a token → server says `401` + where to log in → you log in at Atlassian → client stores the token. ([Ch 6](06-auth.md)) |
| **Discover tools** | Client calls `tools/list` with the token; host converts the tools into the format the model API expects. |
| **"Create a bug for the login crash"** | Model asks for `create_ticket` → host asks you → client sends `tools/call` with the token → server validates, calls Jira → result returns → model says "Created BUG-123". |

## "Is a Jira client stored in Claude forever?"

**No. There's no Jira-specific client.** The MCP client is generic code already built into the app, and the same code works for Jira, GitHub or anything else. That's the point of a standard. Connecting Jira only saves *settings*:

| Saved item | Lasts |
|---|---|
| MCP client code | Until the app updates |
| Server URL | Until you remove the connector |
| Client ID | Long-lived, tied to that authorization server |
| Access token | Short (minutes to hours) |
| Refresh token, if issued | Longer (days to months) |
| Tool list | Cached for `ttlMs`, or until the server says it changed |

Think of a browser: it knows how to load *any* website (client code), but it still has to fetch a site to see what's on it (tool list), and it keeps a bookmark (URL) and a session cookie (token).

**Why the tool list isn't built in:** thousands of servers exist, tools change without an app update, and a server can show different tools to different users based on their permissions.

**When the list is refetched:** when the cache passes `ttlMs`, when the server sends `notifications/tools/list_changed`, or when the app restarts.

## "So the client is just how Claude calls the server, and the server makes the real REST call?"

**Yes, that's a good mental model.**

```
Claude app (MCP client)  --MCP-->  Jira MCP server  --REST-->  Jira API
```

Two refinements:
- The server doesn't *always* call REST. A tool might query a database, read a file, or run a command.
- The server is more than a pass-through. It describes its tools to the model, validates input, checks permissions, and shapes results so the model can use them.

What lives where:

| Thing | Client | Server |
|---|---|---|
| Server URL and your token | ✓ | |
| JSON-RPC request IDs | Creates them | Copies them back |
| Tool definitions | Cached copy | ✓ Original |
| Asking you for approval | ✓ | |
| Token validation and permissions | | ✓ |
| Jira REST URLs and credentials | | ✓ |

You only write client code if you're building **your own AI app**. As a user, you just add the connection.

## "MCP servers don't have a model, right?"

**Right, mostly.** GitHub's, Slack's, Google Drive's servers list tools, receive calls, call the real API and return results. All the thinking happens in the host's model. A server *may* call its own model internally (say, an `ask_docs` tool), but that's optional and invisible to the protocol.

## "Needs approval" is not MCP

When Claude shows ✓ Always allow / ✋ Needs approval / ⊘ Blocked for a connector's tools, that's **the host's own feature**. The server doesn't know about it, and the check happens before any MCP message is sent. That's different from a server asking for input mid-call (`input_required`, [Ch 3](03-messages.md#resulttype)).

```
Model asks for a tool
       ↓
Host checks its permission setting   ← "Needs approval" lives here
       ↓
tools/call goes to the server
       ↓
Server may reply input_required      ← the server's rule
```

**Next:** [3. Messages →](03-messages.md)
