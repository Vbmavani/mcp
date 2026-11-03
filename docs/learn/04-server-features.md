# 4. What a server offers

> **What I asked:** "So what do Prompts or Resources mean?" · "What's the use of prompts? Is it the AI prompt or something else?" · "What does elicitation mean in English?" · "Is the elicitation form only HTML inputs?" · "What modes are there?" · "Tell me about long-running jobs with a handle." · "Give me a way to share skills via MCP." · "I want to try the feature that loads an entire HTML component in Claude."

## Tools, resources, prompts

The difference is **who decides when each one is used**.

| Feature | Who decides | What it is | You see it as | Weather example |
|---|---|---|---|---|
| **Tools** | The **model** | Actions that run code | "Claude wants to use `create_issue`" | `get-alerts`, `get-forecast` |
| **Resources** | The **app** (or you via the app) | Read-only data at a URI | An `@` menu or attachment picker | `weather://alerts/FL` |
| **Prompts** | **You** | Saved instruction templates | Slash commands | `/plan-outdoor-day city=Austin` |

### Tools

A tool has a `name`, a `description`, an `inputSchema`, and optionally an `outputSchema`. **The model reads the description to decide when to use it**, so write it as carefully as the code. Tool annotations like `readOnlyHint` are only hints; a server can lie.

### Resources

Content with an address: a file, a schema, a log. Reading one only fetches data. **Resource templates** describe patterns like `weather://alerts/{state}`.

> In the lab, Postman's Resources tab was empty until the server listed each resource by name (`weather://alerts/FL`, `/CA`, `/NY`). Some clients only show listed resources, not templates.

### Prompts

**Yes, an MCP prompt is an AI prompt**: text that gets sent to the model. The difference is that **the server writes it** and **you choose when to use it**. It doesn't run anything.

Why they exist: the server's author knows the best way to use their tools, prompts are reusable across a team, they can include live data, and they show up as slash commands so you can discover what the server supports.

1. Client calls `prompts/list` and shows them as slash commands.
2. You pick `/investigate_bug` and fill in `page: /checkout`.
3. Client calls `prompts/get` with your answers.
4. Server builds the text, possibly fetching live data.
5. Server returns messages, and the client puts them into the conversation.

[PR #5](https://github.com/Vbmavani/mcp/pull/5) (still open) adds four example prompts to the weather server, each showing a different option. Check out its `feat/prompts-demo` branch to try them:

| Prompt | Shows |
|---|---|
| `weather-help` | No arguments |
| `plan-outdoor-day` | Required + optional arguments, with autocomplete |
| `state-briefing` | Live data fetched into the prompt |
| `alert-summary` | Several messages plus a resource link |

## Elicitation: the server asks the user

*Elicit* means "to draw out". In MCP, the server asks the user for something mid-call, through `resultType: input_required` ([Ch 3](03-messages.md#resulttype)).

| Mode | What happens | Data passes through the client? | Use it for |
|---|---|---|---|
| **`form`** | Server sends a JSON Schema; client draws a form | **Yes**, and it can reach the model | A city, a yes/no, picking an option |
| **`url`** | Server sends a link; user finishes on the server's own page | **No**, it goes browser → server | OAuth sign-in, API keys, payments |

**Form mode isn't HTML.** It's a flat JSON Schema, and the client draws it however it likes (native widgets, terminal prompts):

| Type | Typical UI |
|---|---|
| `string` (with `format`: email, uri, date) | Text box or date picker |
| `number` / `integer` | Number input |
| `boolean` | Checkbox |
| `string` + `enum` | Dropdown or radio buttons |
| `array` of enum items | Multi-select |

No nested objects, no file uploads, no custom layout. **Never collect passwords, API keys or payment details in form mode.**

**URL mode** reply only carries `accept`, `decline` or `cancel`, never the data. I built an `open-facebook-login` demo tool: the first call returns a URL request for `facebook.com/login`; after the user accepts, the retry returns `complete`. It worked end to end in **MCP Inspector**, but Claude Code at the time silently declined URL requests. That's a client limitation, not a server bug. A real login would point the URL at your own OAuth endpoint, not straight at Facebook.

## Tasks: long-running jobs

A normal tool call is a phone call: you wait on the line. A **task** is dropping off laundry: you get a ticket now and come back later. It survives disconnects, laptop sleep and app restarts.

**Example: "Deploy the app to staging" (15 minutes)**

1. Client calls `deploy` and declares the Tasks extension in its capabilities.
2. Server starts the job, saves it, and replies at once:
   ```json
   { "resultType": "task",
     "task": { "taskId": "task_8f2c", "status": "working",
               "pollIntervalMs": 10000, "ttlMs": 86400000 } }
   ```
3. Client polls `tasks/get` → `"working", "Building image (2 of 5)"`.
4. Staging needs sign-off, so the task pauses at `input_required` with a question.
5. You approve; the client sends the answer; the task continues.
6. `tasks/get` eventually returns `completed` with the result.

Other good fits: big exports, data migrations, video rendering, test suites, anything that would time out a normal request.

## Skills over MCP

The `io.modelcontextprotocol/skills` extension lets a server share skills (a folder with a `SKILL.md` and optional files) with any client.

| Method | Purpose |
|---|---|
| `skills/list` | Every skill's frontmatter plus a file manifest with SHA-256 digests |
| `skills/get` | One skill by URI |
| `resources/read` | The actual files, at `skill://` URIs |

The host shows the model only names and descriptions (cheap on context), loads `SKILL.md` when a skill is relevant, and fetches extra files only if needed. Digests let it cache files and spot changes. Without the extension, a server can still expose skills as plain resources or as prompts.

## MCP Apps: interactive UI inside the chat

This is the "entire HTML component in Claude" feature. It's an official **extension**, not core spec.

1. The server registers a resource like `ui://weather/alerts.html` holding a full HTML page (type `text/html;profile=mcp-app`).
2. A tool links to it with `_meta.ui.resourceUri`.
3. When the model calls that tool, the host loads the page in a **sandboxed iframe** and passes it the tool's `structuredContent`.
4. The page can call tools on the same server again (a dropdown, a refresh button) **without the model in the loop**.

```
Widget (sandboxed iframe) ──postMessage: tools/call──► Host ──MCP + your token──► Server
Widget ◄──────────── result ────────────────────────── Host ◄─────────────────── Server
   └─ redraws itself
```

- **The widget never holds credentials.** The host makes the call using its existing connection.
- **The model doesn't see what the widget does** unless the widget sends an update to the conversation. Ours does: after a state change it tells Claude the new state and alerts.
- **The model doesn't know a tool has a UI.** It only sees the name and description, so it may claim "this tool has no UI". To trigger the widget, ask for the thing the tool does ("Show weather alerts for CA using the weather connector").

Lessons from building ours ([Ch 8](08-hands-on-lab.md#mcp-app-gotchas)): Claude needs `structuredContent` to be an **object**, not a bare array, and Claude **caches widgets by URI**, so put a content hash in the URI.

**Next:** [5. Transports, streams and subscriptions →](05-transports.md)
