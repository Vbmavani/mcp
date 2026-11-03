# 1. Why MCP exists

> **What I asked:** "I want to learn MCP in detail: each and every step, why it is, how it started, why we need that." · "Tell me more about MCP 1.0 and 2.0. Will there be a 3.0?" · "Tell me the story of JSON-RPC: how it was invented and why 2.0 was needed."

## The problem

A language model only reads and writes text. On its own it can't open your files, check your calendar, or create a Jira ticket.

1. **Copy and paste.** At first, people pasted data into the chat by hand.
2. **Function calling.** The model could ask for a function to run, and your code ran it. But every app wrote its own tools, so a GitHub tool built for one app didn't work in another.
3. **The M×N problem.** 5 AI apps × 20 systems = 100 custom integrations.
4. **MCP.** Each app implements the *client* side once, and each system implements the *server* side once. 100 integrations become 25 (M+N).

**MCP is an open protocol that standardizes how AI apps discover and use outside tools, data and prompts.** It's often called "USB-C for AI". It isn't a model or a framework, and it doesn't replace your APIs: a server usually wraps an API you already have.

## Where it came from

MCP was inspired by the **Language Server Protocol (LSP)**, which solved the same M×N problem for code editors (N editors × M languages). Both use JSON-RPC messages.

| Date | Event | Why it mattered |
|---|---|---|
| Nov 2024 | Anthropic launches MCP (David Soria Parra and Justin Spahr-Summers) | Mostly local servers |
| Mar 2025 | OAuth and Streamable HTTP added; OpenAI adopts MCP | Remote servers become practical; MCP becomes a shared standard |
| Jun 2025 | Security changes, elicitation, structured output | Fixes problems found in remote use |
| Sep 2025 | Public registry preview | A catalog for finding servers |
| Nov 2025 | Client ID Metadata Documents, experimental Tasks, formal governance | Enterprise use and long-running jobs |
| Dec 2025 | Donated to the Agentic AI Foundation (Linux Foundation) | No single company controls it |
| Jul 2026 | Stateless core (spec `2026-07-28`) | Scales across many servers behind a load balancer |

MCP started local and simple. Remote use, security and scale reshaped it.

## "Which body is this, and why isn't it controlled by a company?"

Since December 2025, MCP is governed by the **Agentic AI Foundation**, a fund under the Linux Foundation. Anthropic created it, but handing it to a neutral body is what made rivals (OpenAI, Google, Microsoft) comfortable building on it. Kubernetes followed the same path ([Ch 9](09-ecosystem-and-future.md#has-this-happened-before)). Changes go through **Spec Enhancement Proposals (SEPs)**.

## There is no "MCP 2.0"

This confused me for a while. **The protocol has no 1.0, 2.0 or 3.0.** Those numbers belong to the SDKs.

| | Protocol (the spec) | SDK (the library) |
|---|---|---|
| **Defines** | The rules for messages | The code you install |
| **Version format** | A date, e.g. `2026-07-28` | A number, e.g. `2.3.0` |
| **Changes when** | Backward-incompatible changes are made | The library is released |

The mix-up is understandable: Python SDK 2.0.0 shipped on 28 July 2026, the same day as the new spec.

**Python SDK 1.x vs 2.x** (at the time of writing):

| | 1.x | 2.x |
|---|---|---|
| Status | Maintenance only | Current |
| Server class | `FastMCP` | `MCPServer` |
| Protocol | Older handshake-based revisions | `2026-07-28`, and can still serve older revisions |
| Asking the user for input | Server sends a request mid-call | `Resolve` / `Elicit`, using multi-round-trip requests |

Use 2.x for new projects. If you aren't ready to migrate, pin `mcp>=1.28,<2`, because a plain `pip install mcp` now gets 2.x. In TypeScript, `@modelcontextprotocol/server` (v2) replaced the older `@modelcontextprotocol/sdk` package for servers, and `server.tool()` became `registerTool()`.

**Will there be a 3.0?** The protocol will most likely get a new *date*, not a number. An SDK 3.0 is possible if a future release needs breaking API changes.

## What's still missing (from the official roadmap)

- **Async work:** Tasks, subscriptions and progress don't share one lifecycle yet.
- **Two transport designs:** many HTTP features don't work over stdio.
- **Agent identity:** login assumes a person with a browser.
- **Confusing tool results:** `content` vs `structuredContent`.
- **Large tool lists:** clients often load the whole catalog up front.

Planned: push delivery (webhooks), HTTP over stdio, ETag caching, better agent identity, a redesigned `tools/call` result and progressive tool discovery. These are intentions, not promises.

## Side story: JSON-RPC and why it needed a 2.0

MCP's messages are JSON-RPC, so its history explains a lot.

- **~2000:** web pages had to reload to get new data. Developers wanted browser JavaScript to just *call a function on the server* (a remote procedure call). XML-RPC and SOAP existed but were heavy.
- **~2005, JSON-RPC 1.0:** send the call as small JSON: `{"method": "add", "params": [2, 3], "id": 1}`. The `id` matches each answer to its question.
- **Real use exposed gaps:** no version field, positional params only, no standard error format, both `result` and `error` in every reply, notifications marked awkwardly with `"id": null`.
- **2010, JSON-RPC 2.0:** added `"jsonrpc": "2.0"`, named params, standard error codes, exactly one of `result`/`error`, and notifications as messages with no `id`. It hasn't changed since.

> **"Do MCP and JSON-RPC change for the same reason?"** Partly. Both started small and changed when real use exposed gaps. But JSON-RPC does one narrow job that's finished, so it stopped changing. MCP sits next to AI apps, security and enterprise needs, which keep moving, so it keeps changing too. **JSON-RPC is the envelope; MCP is the letter inside it.**

**Next:** [2. Who does what →](02-who-does-what.md)
