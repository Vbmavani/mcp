# 3. Messages: JSON-RPC and friends

> **What I asked:** "jsonrpc — what's this?" · "How is the ID created? Can two clients use the same one?" · "So the client basically sends a REST call?" · "Is the ID Claude's responsibility or the MCP company's?" · "How do notifications work?" · "How does `resultType` work?" · "How is `requestState` created? Can't I just send it directly?" · "What are capabilities?" · "What does `server/discover` return?"

## JSON-RPC in one minute

JSON-RPC is a tiny message format for asking another program to run a function. It's like ordering in a restaurant: your order gets a number, and the food comes back with that number.

```json
{ "jsonrpc": "2.0", "id": 1, "method": "add", "params": { "a": 2, "b": 3 } }
{ "jsonrpc": "2.0", "id": 1, "result": 5 }
```

| Message | Has `id`? | Gets a reply? |
|---|---|---|
| **Request** | Yes | Yes: a `result` or an `error` with the same `id` |
| **Response** | Same as the request | — |
| **Notification** | No | No. A one-way "this happened". |

MCP defines the method names (`tools/list`, `tools/call`, …). **JSON-RPC is the envelope; MCP is what goes inside.**

## Request IDs

- **Who creates them?** Whoever sends the request, which in current MCP is the **client**. The server just copies the ID into its reply. The model never sees IDs.
- **How?** Usually a counter (1, 2, 3…) per connection. Systems with many workers often use UUIDs. SDKs do it for you.
- **Can two clients use the same ID?** Yes, and it's fine. Each reply goes back on the connection the request came from (its own stdio pipe or its own HTTP POST), so IDs only need to be unique per sender.
- **Rules:** a string or integer, never `null`, never reused by the same sender, and a retry gets a new ID.

| Question | Answered by |
|---|---|
| Which reply matches which request? | JSON-RPC `id` |
| Which connection does the reply go to? | The transport |
| Who is this user? | The OAuth token, never the `id` |

> **Trap for server builders:** don't key a cache by `id` alone, or Client A and Client B's `id: 1` collide. For anything that must be globally unique, have the server create its own ID (like `taskId`).

## "Is it just a REST call?"

**Not quite.** Over HTTP the client sends an HTTP POST, but it isn't REST. HTTP is the transport; REST is one *style* of API on top of it.

```http
POST /mcp
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: get_weather

{ "jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": { "name": "get_weather", "arguments": { "location": "Pune" } } }
```

| | REST | MCP over HTTP |
|---|---|---|
| URLs | Many (`/users/5`) | One (`/mcp`) |
| Verbs | GET, POST, PUT, DELETE | Only POST |
| Where the action is | URL + verb | `method` in the body (copied to the `Mcp-Method` header) |
| Response | One JSON reply | One JSON reply, or a stream of events |
| Discovery | Human docs | `tools/list`, readable by programs and models |

Over stdio there's no HTTP at all: the same JSON is written as one line to the server's stdin.

## Every request describes itself (`_meta`)

The 2026-07-28 spec removed the `initialize` handshake and sessions. Instead, **every request carries what the server needs to know**, so any copy of the server behind a load balancer can answer it:

```json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list",
  "params": { "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientInfo": { "name": "lab", "version": "0.1" },
    "io.modelcontextprotocol/clientCapabilities": {}
  } } }
```

## Notifications

A notification isn't a third kind of reply. It's a separate one-way message, so the client doesn't have to keep polling.

| Notification | Sent by | Example |
|---|---|---|
| `notifications/progress` | Server | "Exported 40 of 100 tickets" |
| `notifications/tools/list_changed` | Server | Jira added `assign_ticket`, so refetch the tool list |
| `notifications/resources/updated` | Server | A watched resource changed, so read it again |
| `notifications/cancelled` | Client | "Stop request 7" |

**How they arrive over HTTP:** the server can't call the client, so the client keeps a response stream open. Either the reply to a single request becomes a stream (progress, then the final result), or the client opens one long-lived `subscriptions/listen` stream for change events. Notifications only say *something changed*; the client then fetches the new data. More in [Ch 5](05-transports.md#subscriptions).

## `resultType`

Every result tells the client what to do next:

| `resultType` | Finished? | Client's next step |
|---|---|---|
| `complete` | Yes | Use the result |
| `input_required` | No, it's waiting for you | Ask the user, then resend the request (new ID) with the answers and `requestState` |
| `task` | No, it's running | Poll `tasks/get` with the `taskId` ([Ch 4](04-server-features.md#tasks-long-running-jobs)) |

```text
Client --tools/call delete_ticket (id 1)--> Server
Client <--input_required: "Delete it?"----- Server   (this request is over)
          the app asks you; you say yes
Client --tools/call delete_ticket (id 2) + answer + requestState--> Server
Client <--complete: "Deleted ENG-123"------ Server
```

This is called a **multi-round-trip request (MRTR)**. Nothing waits on the server between the two calls.

A failed request (unknown tool, malformed JSON) comes back as a JSON-RPC `error` and has no `resultType`. A tool that *ran* but failed (bad date, API down) returns a normal result with `isError: true`, so the model can read the message and try again.

### `requestState`: a sealed ticket

> "Can't I just skip the first call and send `inputResponses` + `requestState` directly?"

**No, as long as the server checks it.** Only the server can make a valid `requestState`:

1. During request 1, the server writes down what it needs to remember: user, tool, a hash of the arguments, the question, an expiry.
2. It **seals** that with a secret key that never leaves the server (AEAD encryption). The result looks like random text.
3. The client stores it and sends it back unchanged. It can't read or forge it.

| You send | Result |
|---|---|
| No `requestState` | The server asks the question |
| Made-up or edited state | Fails the seal check |
| Another user's state | User doesn't match |
| Real state, different arguments | Hash doesn't match |
| Expired state | Rejected |

It's like a coat-check ticket: you can carry it and hand it back, but you can't make one without the venue's stamp. **Limit:** it proves the *server* asked the question, not that a *human* answered it. A dishonest client can still auto-accept, which is why high-risk actions should use URL-mode elicitation ([Ch 4](04-server-features.md#elicitation-the-server-asks-the-user)).

> **"Can I make my client always answer 'yes' to Harness's deploy confirmation?"** In your own client, yes: check `inputRequests` and reply `accept`. It breaks the spec's rule that users must be able to review form answers, and it removes a real safety check. Better: change the approval rule in Harness for dev environments, or allow just that tool in Claude's permissions.

## Capabilities

Each side says which optional features it supports. The other side must not use anything that isn't listed.

**Server** (in the `server/discover` result):

```json
"capabilities": {
  "tools":       { "listChanged": true },
  "resources":   { "listChanged": true, "subscribe": true },
  "prompts":     { "listChanged": true },
  "completions": {},
  "extensions":  { "io.modelcontextprotocol/tasks": {} }
}
```

**Client** (in `_meta` on every request):

```json
"io.modelcontextprotocol/clientCapabilities": {
  "elicitation": { "form": {}, "url": {} },
  "extensions":  { "io.modelcontextprotocol/tasks": {} }
}
```

The server reads the client's capabilities and picks a response it can handle. If the client didn't declare `elicitation.url`, the server must not send a URL prompt. It should fall back (for example, return plain text with the link) or reply `MissingRequiredClientCapability` (`-32021`). Capabilities are self-reported, so use them to choose a format, never for security.

## `server/discover`

"Who are you, which versions do you speak, and what can you do?" in one request. Servers **must** implement it; clients may skip it.

```json
{ "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": { "tools": {}, "resources": {} },
  "_meta": { "io.modelcontextprotocol/serverInfo": { "name": "weather", "version": "1.0.0" } },
  "instructions": "This server provides weather utilities.",
  "ttlMs": 3600000,
  "cacheScope": "public" }
```

`ttlMs` says how long the answer may be reused (`0` = don't). `cacheScope` is `public` (shared caches OK) or `private`.

**Next:** [4. What a server offers →](04-server-features.md)
