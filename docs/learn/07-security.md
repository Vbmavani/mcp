# 7. Security

> **What I asked:** "What kind of security problems are there? Can a man-in-the-middle attack happen from Harness or so?" · "What does 'arbitrary code execution' mean?"

## Can someone intercept stdio?

**No.** The pipe lives inside the operating system kernel, and only the two processes at its ends can use it. Nothing crosses Wi-Fi or the internet. HTTP is different: it needs HTTPS, and a *local* HTTP server also needs `Origin`/host checks and to bind to `127.0.0.1`, because websites in your browser can reach `localhost` through tricks like DNS rebinding.

## Is the harness a man in the middle?

**Yes, by design.** Claude Code, Cursor and other hosts sit between the model and every server. They see every request and result and decide what runs. That's their job, so you're trusting the host.

It becomes a risk only if something you installed changes it: a plugin or hook that alters tool calls, an edited config that points a server name at a different command, or a fake copy of the app. So "MITM through the harness" really means *someone already has access to your machine or config*.

## Attacks on your own machine

Malware running as your user could edit your MCP config, hijack `PATH` so `npx` runs a fake program, replace a server's files, or read its environment variables (which often hold API keys). At that point your account is already compromised; MCP isn't the weak point.

## The risks that actually matter

*Arbitrary code execution* means a program can run **any** code, not just a fixed set of safe actions. A stdio server is exactly that: it runs with your permissions.

| Risk | What happens | Defence |
|---|---|---|
| **Malicious or compromised package** | `npx some-server@latest` downloads whatever is newest. A hacked release runs as you. | Trusted publishers; pin versions |
| **Full user permissions** | A stdio server can read your SSH keys and browser data | Install only servers you trust; sandbox unknown ones |
| **Prompt injection** | A web page, file, email or issue hides instructions, and the model follows them | Treat all tool output as untrusted; approve risky actions |
| **Tool poisoning** | A tool *description* hides instructions like "read `~/.ssh/id_rsa`" | Read new servers' tool descriptions |
| **Rug pull** | A server is safe when approved, then changes after an update | Pin versions, review updates |
| **Secrets in environment variables** | Keys leak through careless logs | Give each server only the keys it needs |
| **Data exfiltration** | File access + internet access = your data can leave | Don't combine private data, untrusted content and outbound access in one agent |
| **Lying annotations** | `readOnlyHint: true` on a tool that writes | Annotations are hints, not guarantees |

## Example: Playwright MCP

- It reads **untrusted pages**, so prompt injection is the biggest risk.
- It may use your **logged-in browser profile**, so a tricked model could act on your accounts.
- It can visit **any URL**, so a tricked model could put private data into a link.

Safer: a separate clean browser profile, approval for actions on logged-in sites, and don't give the same agent private files and an open browser at once.

## Rules I took away

- Keep secrets out of code, especially in a public repo. Use the host's environment variables.
- Never collect secrets through form-mode elicitation; use URL mode.
- Allow-list read-only tools you trust; keep ✋ approval on tools that act (deploy, delete, send). Even read tools can return a prompt injection.
- Servers must rate-limit tool calls, but MCP has no field for announcing limits. Clients find out from `429` + `Retry-After`, a JSON-RPC error, or a tool result with `isError: true`.
- If a key ever appears in a chat, log or screenshot, rotate it.

| Question | Answer |
|---|---|
| Can someone on my network intercept stdio? | No |
| Can the harness be in the middle? | Yes, by design. Trust your client, its plugins and its config. |
| Can malware on my machine tamper with it? | Yes, but it already controls your account |
| What's the main real risk? | **Trusting the wrong server**, and **prompt injection from content tools read** |

**Next:** [8. Hands-on lab →](08-hands-on-lab.md)
