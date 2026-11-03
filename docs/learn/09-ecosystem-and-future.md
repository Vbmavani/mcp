# 9. Ecosystem and the future

> **What I asked:** "Find 15 big companies and the MCP tools they provide." · "I want to try 10 MCPs by myself." · "How many tools can one MCP have?" · "What's the rate limit for LogRocket's MCP?" · "Is there data on how many companies adopt MCP per month?" · "Has anything like this happened before?" · "How many repos should I go through to learn MCP?"

## What big companies ship (November 2026)

I researched 16 well-known companies' official MCP servers. Default tool counts:

| Company | Default tools | Notes |
|---|---|---|
| Vercel | 248 | Full catalog; no published default set |
| Notion | 69 | Many need a paid plan |
| GitHub | 45 | 92 with every toolset on |
| Figma | 32 | Up to 41 |
| Supabase | 32 | Up to 37 |
| HubSpot | 32 | |
| Asana | 31 | |
| PayPal | 30 | Its open-source code has 47 |
| Atlassian | 25 visible | 257 total, reached through a discover-and-run tool |
| Slack | 21 | |
| Stripe | 15 | |
| Linear | 15 | |
| Sentry | 13 | Up to 78 through its catalog |
| LogRocket | 9 | All read-only; OAuth or project API key |
| Shopify | 5 | Developer server, runs locally |
| Cloudflare | 4 | Main server only; it runs 18 servers |

Patterns: almost all offer a **hosted remote server** with **OAuth**; many let you turn on groups of tools ("toolsets") to keep the list small; and the biggest catalogs (Atlassian, Sentry) hide most tools behind a *discover* tool instead of listing them all. Counts change often, so check each server's docs.

**Rate limits:** LogRocket doesn't publish one, and MCP has no field for announcing limits. Clients find out on hitting them (`429` + `Retry-After`, a JSON-RPC error, or `isError: true`).

## Ten servers to try (no account needed)

| Server | What it does | Try asking |
|---|---|---|
| **Everything** | Demo server with every MCP feature | "List the tools from everything and run echo" |
| **Filesystem** | Read, write, search files in a chosen folder | "What files are in my Downloads folder?" |
| **Memory** | A small knowledge graph across chats | "Remember my backend repo is called api" |
| **Fetch** | Downloads a page as readable text | "Fetch example.com and summarize it" |
| **Time** | Current time and time-zone conversion | "What time is it in Tokyo at 9am New York?" |
| **Git** | Local repo status, log, diffs | "Show the last 5 commits" |
| **Sequential Thinking** | Breaks a problem into numbered steps | "Plan a database migration step by step" |
| **Playwright** | Drives a real browser | "Open example.com and take a screenshot" |
| **Context7** | Up-to-date library docs | "How do I use React's useActionState? Use context7" |
| **Weather** (this repo) | US forecasts and alerts | "Any alerts in Florida?" |

## How many tools is too many?

**The spec sets no maximum.** Limits come from clients and models:

- Some clients cap total tools (Cursor was ~40; VS Code Copilot 128 per request; OpenAI's API 128 per request).
- Claude Code has no small fixed cap: when tools would take too much context, it defers them and loads each one when needed.
- **Every tool costs context** (name + description + schema on every message), and **similar tools confuse the model**.

**Aim for ~5–20 clearly different tools per server.** Merge similar ones (`manage_user` with an `action` input instead of three tools). Split a server that grows past ~30. My 10,000-tool stress test ([Ch 8](08-hands-on-lab.md#step-11-stress-test-how-many-tools)) shows why: a 2.9 MB tool list.

## Adoption in numbers

There's **no public count of companies adopting MCP per month**. The best public signal is the official MCP Registry, where organisations that prove domain ownership publish under names like `com.company`. Counting first appearances by month (an upper bound) gave, for **October 2026**:

| Metric | Value |
|---|---|
| Official SDK downloads that month (npm + PyPI) | ~559 million |
| New domain-verified organisations in the registry | 7,757 (95 when it opened in Sep 2025) |
| Organisations in the registry, total | ~17,900 |
| Servers in the registry | ~53,900 (~16,300 added that month) |
| GitHub repos tagged `mcp-server` | ~40,600 |
| TypeScript SDK monthly downloads | 103K (Dec 2024) → 267M (Oct 2026) |

## Has this happened before?

Yes, MCP fits a familiar pattern: a standard removes integration work, spreads fast, its directory fills with junk, then the field consolidates.

- **Early web (1993–96):** websites grew ~10× a year, about the pace of the MCP Registry.
- **LSP (2016):** the closest *design* match, solving N editors × M languages. MCP's designers cite it.
- **App Store (2008–09):** the closest *registry* match, including spam and near-duplicates.
- **SOAP/UDDI (early 2000s):** the warning. A public registry that nobody used.

**Standards one company created, then handed to a neutral body:**

| Standard | Creator | Launch → first big rival adopts | Launch → neutral foundation | Outcome |
|---|---|---|---|---|
| **MCP** | Anthropic, Nov 2024 | **~4 months** (OpenAI) | **~13 months** (Linux Foundation) | Still growing |
| Kubernetes | Google, 2014 | ~12 months | ~13 months (CNCF) | Became the default |
| Docker | 2013 | ~19 months | ~27 months (OCI) | Format won, company shrank |
| JavaScript | Netscape, 1995 | ~15 months | ~25 months (Ecma) | Became the default |
| GraphQL | Facebook, 2015 | ~12 months | ~38 months | Widely used niche |
| AMP | Google, 2015 | Never truly adopted | ~44 months | Faded |

MCP has hit each milestone faster than any of them. The open question is whether it gets through consolidation the way Kubernetes did.

## Where it's heading

From the official roadmap and the maintainers' working groups:

1. **Enterprise security:** better sign-in, audit trails, agent identity, server cards in the registry.
2. **Stateless scale:** the 2026-07-28 spec already removed sessions; more work on running behind load balancers.
3. **Async work:** Tasks, subscriptions and progress under one lifecycle; push delivery (webhooks).
4. **Big tool catalogs:** progressive discovery instead of loading every tool up front.
5. **One transport model:** HTTP over stdio.

## Which repos to read

About **5 repos** plus **2–3 real-world servers**. Most of the 40,000+ MCP repos are variations on the same pattern.

| Step | Repo | What you learn | Time |
|---|---|---|---|
| 1 | [modelcontextprotocol/modelcontextprotocol](https://github.com/modelcontextprotocol/modelcontextprotocol) | Spec and docs. Read the "Learn" pages; skim the spec. | 1 day |
| 2 | [typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) or [python-sdk](https://github.com/modelcontextprotocol/python-sdk) | Build the quickstart server | 1–2 days |
| 3 | [inspector](https://github.com/modelcontextprotocol/inspector) | See every message. Use it; don't read it. | 1 hour |
| 4 | [servers](https://github.com/modelcontextprotocol/servers) | Read **filesystem**, **memory** and **everything** | 2–3 days |
| 5 | [PrefectHQ/fastmcp](https://github.com/PrefectHQ/fastmcp) | The popular higher-level Python framework (Python only) | 1 day |
| + | [github/github-mcp-server](https://github.com/github/github-mcp-server) and one more production server | How real servers handle auth, toolsets and scale | — |

**Next:** [10. Every question I asked →](10-question-log.md)
