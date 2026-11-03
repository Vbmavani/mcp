# MCP components

Every component of the Model Context Protocol, grouped by role, based on the current spec ([2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)).

## 1. Participants

| Component | What it is |
|---|---|
| **Host** | The AI app you use, such as Claude Code or Cursor. It runs the model, shows the UI, and asks for your approval. |
| **Client** | A connector inside the host. Each client talks to exactly one server. |
| **Server** | A program that offers tools, data, or prompts. It can run locally or remotely. |

## 2. Base protocol (the message layer)

| Component | What it does |
|---|---|
| **JSON-RPC 2.0** | The message format: requests, responses, and notifications |
| **`_meta`** | Carries the protocol version, client info, and client capabilities on every request |
| **Capabilities** | Each side says which features it supports |
| **`server/discover`** | Returns the server's versions, capabilities, and identity |
| **`resultType`** | Marks a result as `complete`, `input_required`, or `task` |
| **Versioning** | Date-based versions, such as `2026-07-28` |
| **Error codes** | Standard JSON-RPC codes plus MCP's own, such as `HeaderMismatch` |

## 3. Server features

| Component | Who controls it | Purpose |
|---|---|---|
| **Tools** | The model | Actions, such as creating an issue or running a query |
| **Resources** | The application | Data to read, such as files or schemas, named by URI |
| **Resource templates** | The application | Resource patterns, such as `notes://{id}` |
| **Prompts** | The user | Saved templates, often shown as slash commands |

Supporting pieces of these features:

- **Tool definition fields:** `inputSchema`, `outputSchema`, and annotations such as `readOnlyHint`
- **Content types:** text, image, audio, resource links, and embedded resources
- **Structured content:** typed JSON results

## 4. Client features

| Component | Status | Purpose |
|---|---|---|
| **Elicitation** | Active | Ask the user for input, through a form or a URL |
| **Sampling** | Deprecated | Ask the client's model to generate text |
| **Roots** | Deprecated | Tell the server which folders it may use |

## 5. Patterns and utilities

| Component | Purpose |
|---|---|
| **Multi Round-Trip Requests (MRTR)** | Lets a server ask for input mid-request without holding the request open |
| **Subscriptions** (`subscriptions/listen`) | Notifies the client when tools, prompts, or resources change |
| **Progress** | Reports progress on long requests |
| **Cancellation** | Stops a request that's in progress |
| **Pagination** | Splits long lists into pages using cursors |
| **Completion** | Suggests values for prompt and resource arguments |
| **Caching** | `ttlMs` and `cacheScope` say how long results can be reused |
| **Logging** | Deprecated. Use stderr or OpenTelemetry instead. |

## 6. Transports

| Component | Used for |
|---|---|
| **stdio** | Local servers, started as a child process |
| **Streamable HTTP** | Remote servers, reached at a URL |
| **HTTP+SSE** | Deprecated older remote transport |

## 7. Authorization (HTTP only)

| Component | Purpose |
|---|---|
| **OAuth 2.1** | The base login framework |
| **Protected Resource Metadata** | Tells the client which authorization server to use |
| **Authorization server** | Logs the user in and issues tokens |
| **Client ID Metadata Documents** | The preferred way for a client to identify itself |
| **PKCE** | Stops stolen authorization codes being used |
| **Resource indicators** | Ties a token to one specific MCP server |
| **Scopes and step-up** | Grants minimal permissions and adds more only when needed |

## 8. Extensions (optional)

| Component | Purpose |
|---|---|
| **Tasks** | Long-running jobs with a handle you can check later |
| **MCP Apps** | Interactive UI, such as charts or forms, shown inside a chat |
| **Skills over MCP** | Structured instructions for agent workflows |
| **Auth extensions** | Client credentials and enterprise-managed authorization |

## 9. Ecosystem

| Component | Purpose |
|---|---|
| **SDKs** | Official libraries: TypeScript, Python, Go, and C# are the top tier |
| **MCP Inspector** | A tool for testing a server by hand |
| **MCP Registry** | A public catalog of server metadata |
| **Spec Enhancement Proposals (SEPs)** | The process for proposing changes to MCP |
| **Agentic AI Foundation** | The Linux Foundation fund that now governs MCP |

## How they fit together

```
Host (your AI app)
 └── Client ──[transport: stdio or HTTP + auth]──► Server
                │                                   ├── Tools
                │  JSON-RPC messages with _meta      ├── Resources
                │  and patterns (MRTR, progress...)  └── Prompts
                │
                └── Client features: elicitation
Extensions (Tasks, Apps...) add optional features on top.
```

To learn them in order, start with the participants, then the three server features, then the transports. Leave the patterns, auth, and extensions until you're building something real.
