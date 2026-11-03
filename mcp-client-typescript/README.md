# An LLM-Powered Chatbot MCP Client written in TypeScript

An interactive chatbot MCP client: it launches an MCP server over stdio, lists its tools, and hands them to Claude, which can call them while answering your questions.

This example accompanies the [Build an MCP client](https://modelcontextprotocol.io/docs/develop/build-client) tutorial.

## Prerequisites

- Node.js 24+
- npm
- An [Anthropic API key](https://console.anthropic.com/) (optional — see below)

## Setup

Install dependencies and build, then put your API key in a `.env` file (or export `ANTHROPIC_API_KEY` in your shell):

```bash
npm install
npm run build
cp .env.example .env
# then edit .env and add your key
```

## Run the client

Pass the path to a server script — `.js` servers are launched with `node`, `.py` servers with `python` (or `python3`, depending on the platform):

```bash
node build/index.js ../weather-server-typescript/build/index.js
```

(Build the server first — see its README.)

Type a question (for example, "What's the weather in Sacramento?") and Claude answers using the server's tools. Type `quit` to exit.

Without an `ANTHROPIC_API_KEY`, the client still connects and prints the server's tools and prompts. The prompt commands below work without a key; questions to Claude need one.

## Prompts

If the server offers [prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts), the client lists them on connect and adds three commands:

| Command | What it does |
|---|---|
| `/prompts` | List the server's prompts and their arguments |
| `/prompt <name> [arg=value ...]` | Get the prompt from the server, show its messages, and send them to Claude. It asks for any required argument you leave out. Quote values with spaces: `when="this weekend"`. |
| `/complete <name> <arg> [typed]` | Ask the server to autocomplete an argument, such as `/complete state-briefing state c` |

When a prompt links a resource instead of embedding it, the client reads the resource itself before sending the messages. Back-to-back messages from the same role are merged, because Claude expects turns to alternate.

## Structured content

The SDK validates every result against the tool's declared `outputSchema`, so the spec's client-side SHOULD needs no code here.

The two channels go to different readers: `content` is forwarded to the model, while `structuredContent` is used as data — when a tool returns an array, the client counts its items rather than re-reading the prose. See [Structured Content](https://modelcontextprotocol.io/specification/draft/server/tools#structured-content).

`versionNegotiation: { mode: 'auto' }` probes `server/discover` and falls back to the `2025-11-25` handshake; the SDK's default is `'legacy'`. See the [SDK documentation](https://ts.sdk.modelcontextprotocol.io/v2/).
