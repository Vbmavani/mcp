# 6. Auth: OAuth, tokens and API keys

> **What I asked:** "Does the token stay the same over time, or get deactivated?" · "Is the token saved on the server the first time? Explain step by step for creating a Jira ticket." · "I call `create_issue` after 5 days. Is my access token still valid?" · "Is the refresh token saved in Claude Code's database? What about claude.ai?" · "Are tokens stored per MCP?" · "Some use an API key. How does that work?" · "How many kinds of login does MCP have?" · "How is auth working on my deployed server?" · "And if it used OAuth?"

## The short version

- MCP officially defines **one** login method for remote servers: **OAuth 2.1**. Authorization is optional.
- **Tokens live on the client side** (the host), not on the MCP server. The client sends the token on every request; the server only checks it.
- **Stdio servers don't use OAuth.** They get credentials from environment variables, and the pipe itself is private.

## The roles

| Role | Jira example | Job |
|---|---|---|
| **Client** | Claude app | Asks for access, holds the tokens |
| **Resource server** | Jira MCP server | Checks tokens, then runs tools |
| **Authorization server** | Atlassian login (or Auth0, WorkOS, Clerk) | Logs you in, issues tokens |

## The full OAuth flow

```
Claude                MCP server             Login service            You (browser)
  │ 1. /mcp, no token    │                        │                        │
  │─────────────────────►│                        │                        │
  │ 401 + metadata URL   │                        │                        │
  │◄─────────────────────│                        │                        │
  │ 2. which login service?                       │                        │
  │─────────────────────►│ "login.example.com"    │                        │
  │ 3. how do I log in there? ───────────────────►│                        │
  │ 4. identify Claude (CIMD / DCR / your own) ──►│                        │
  │ 5. open login page ───────────────────────────────────────────────────►│
  │                                               │◄── 6. log in, Allow ───│
  │ 7. code comes back ◄───────────────────────────────────────────────────│
  │ 8. code + PKCE secret → token ───────────────►│                        │
  │◄────────────────────────────── access token ──│                        │
  │ 9. /mcp + Bearer token ─►│ checks token      │                        │
```

1. **First call fails** with `401` and `WWW-Authenticate: Bearer resource_metadata="https://…/.well-known/oauth-protected-resource"`.
2. **Find the login service** from that metadata (`authorization_servers`).
3. **Read the login service's metadata**: login page, token endpoint, features.
4. **Identify the client.** Preferred: **Client ID Metadata Document (CIMD)**, where Claude's client ID is a URL Anthropic hosts. Alternatives: Dynamic Client Registration (deprecated) or a client ID you register yourself.
5. **Open the login page** with `client_id`, `redirect_uri`, a **PKCE** `code_challenge`, `resource` (which MCP server the token is for), `scope` and `state`.
6. **You log in on the login service's page.** Claude never sees your password.
7. **A short-lived code comes back**, with `iss`. Claude checks `iss` matches, blocking fake login services.
8. **Swap code + PKCE secret for tokens.** A stolen code is useless without the secret.
9. **Every request carries `Authorization: Bearer …`.** The server checks:

| Check | Why |
|---|---|
| Signature | The login service really issued it |
| Audience | It names *this* server, so a token for another service is rejected |
| Expiry | Old tokens stop working |
| Scope | Only what you approved |

10. **Refresh** silently when the access token expires.
11. **Step-up:** if a tool needs more access, the server replies `403 insufficient_scope` and Claude asks you to approve just that.

## Tokens over time

| Token | Purpose | Typical lifetime |
|---|---|---|
| **Access token** | Sent on every request | Minutes to hours |
| **Refresh token** | Gets a new access token without logging in | Days to months (only if issued) |

**"I call `create_issue` after 5 days. Is my token valid?"** Probably not, and you won't notice. The client sees it's expired (or gets a `401`), sends the refresh token to the **authorization server** (never to the MCP server), gets a new access token (often a new refresh token too: *rotation*), and retries. You only log in again if the refresh token expired, was revoked, or was never issued.

Tokens also stop early if you disconnect, an admin removes access, a leak is suspected, or your password policy changes.

## Where tokens are stored

| | Claude Code | claude.ai |
|---|---|---|
| MCP client runs on | Your computer | Anthropic's servers |
| Tokens stored | Locally: macOS Keychain, or a protected credentials file on Linux/Windows | Anthropic's backend, tied to your account |
| Calls come from | Your machine | Anthropic's servers |
| Consequence | Can reach `localhost` servers | The server must be reachable from the internet |

Tokens are stored **per server** (and per user). Each token is issued for one specific server, so a Jira token won't work on GitHub, and one leak only exposes one service.

> **If a third party runs the MCP server in front of Jira**, it can't forward your MCP token to Jira (that's *token passthrough*, which the spec forbids). It gets its own Jira token through a separate approval and stores it against your account.

## The kinds of login

| # | Type | Status | Typical use |
|---|---|---|---|
| 1 | **OAuth user login** | Core spec | Claude connecting to your Jira |
| 2 | **OAuth client credentials** | Official extension | A background job with no user |
| 3 | **Enterprise-managed authorization** | Official extension | Company SSO decides which servers staff can use |
| 4 | **API key in a header** | Custom, not in the spec | Simple remote servers |
| 5 | **Environment variables** | Recommended for stdio | A local server with your key |
| 6 | **No login** | Allowed | Local tools, public data |

URL-mode elicitation isn't a seventh type. It's how a server gets *your access to another service*, not how you log in to the server itself.

**OAuth vs API key:**

| | OAuth | API key |
|---|---|---|
| Setup | Browser login | Paste a key |
| Lifetime | Short, then refreshed | Until someone revokes it |
| Server knows | Which user | "Someone with a valid key" |
| Revoking | One user's token | Removing the key cuts off everyone using it |
| Good for | Multi-user apps with private data | Personal tools, public data |

## How the deployed weather server does it (static API key)

```
Claude ──HTTPS──► Render ──► weather server
                              ├─ 1. Host check: is it for our hostname?        no → 403
                              ├─ 2. Key check: is the Bearer key allowed?      no → 401
                              └─ 3. MCP handler: tools/list, tools/call, …     → 200
```

- Allowed keys come only from the `MCP_API_KEYS` environment variable on Render. **No key is in the code**, because the repo is public.
- The comparison uses `timingSafeEqual`, so response time can't leak the key one character at a time.
- Every request proves itself; there's no session.
- The host check (from the SDK) blocks DNS-rebinding tricks.

> **Why claude.ai said "Couldn't register with Weather's sign-in service":** the server replied `401` + `WWW-Authenticate: Bearer`, which in MCP means "I use OAuth". Claude went looking for an OAuth service that didn't exist. Fix: in the custom connector choose **No sign-in** and add a request header `Authorization: Bearer <key>`. That's the "URL plus API key separately" setup many servers use.

> **The widget never sees the key.** When the alerts widget changes state, it asks Claude via `postMessage`, and Claude makes the call with the stored header.

**Next:** [7. Security →](07-security.md)
