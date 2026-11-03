import Anthropic from "@anthropic-ai/sdk";

import {
  Client,
  type Prompt,
  type PromptMessage,
} from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import readline from "readline/promises";

import dotenv from "dotenv";

dotenv.config({ quiet: true }); // load environment variables from .env

const ANTHROPIC_MODEL = "claude-sonnet-5";
// Sonnet 5 thinks adaptively unless told otherwise, and max_tokens caps thinking
// plus the reply, so leave room for both.
const MAX_TOKENS = 10000;
const MAX_TOOL_TURNS = 10;

class MCPClient {
  private mcp: Client;
  private _anthropic: Anthropic | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: Anthropic.Tool[] = [];
  private prompts: Prompt[] = [];

  constructor() {
    // 'auto' probes server/discover, falling back to the 2025-11-25 handshake.
    // The SDK's default is 'legacy'.
    this.mcp = new Client(
      { name: "mcp-client-cli", version: "1.0.0" },
      { versionNegotiation: { mode: "auto" } },
    );
  }

  private get anthropic(): Anthropic {
    // Lazy-initialize Anthropic client when needed
    return this._anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async connectToServer(serverScriptPath: string) {
    /**
     * Connect to an MCP server
     *
     * @param serverScriptPath - Path to the server script (.py or .js)
     */
    try {
      // Determine script type and appropriate command
      const isJs = serverScriptPath.endsWith(".js");
      const isPy = serverScriptPath.endsWith(".py");
      if (!isJs && !isPy) {
        throw new Error("Server script must be a .js or .py file");
      }
      const command = isPy
        ? process.platform === "win32"
          ? "python"
          : "python3"
        : process.execPath;

      // Initialize transport and connect to server
      this.transport = new StdioClientTransport({
        command,
        args: [serverScriptPath],
      });
      await this.mcp.connect(this.transport);

      // List available tools
      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        };
      });
      console.log(
        "Connected to server with tools:",
        this.tools.map(({ name }) => name),
      );

      // Prompts are optional; only list them if the server offers them.
      if (this.mcp.getServerCapabilities()?.prompts) {
        this.prompts = (await this.mcp.listPrompts()).prompts;
        console.log(
          "Server prompts:",
          this.prompts.map(({ name }) => name),
        );
      }
    } catch (e) {
      console.log("Failed to connect to MCP server: ", e);
      throw e;
    }
  }

  async processQuery(query: string) {
    /**
     * Process a query using Claude and available tools
     *
     * @param query - The user's input query
     * @returns Processed response as a string
     */
    return this.runConversation([{ role: "user", content: query }]);
  }

  async runConversation(messages: Anthropic.MessageParam[]) {
    /**
     * Send messages to Claude and run any tools it asks for
     *
     * @param messages - The conversation so far, ending with the user's turn
     * @returns Processed response as a string
     */
    let response = await this.anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      messages,
      tools: this.tools,
    });

    const finalText: string[] = [];

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const toolUses: Anthropic.ToolUseBlock[] = [];

      for (const block of response.content) {
        if (block.type === "text") {
          finalText.push(block.text);
        } else if (block.type === "tool_use") {
          toolUses.push(block);
        }
      }

      if (toolUses.length === 0) {
        return finalText.join("\n");
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        const toolArgs = toolUse.input as { [x: string]: unknown } | undefined;
        finalText.push(
          `[Calling tool ${toolUse.name} with args ${JSON.stringify(toolArgs)}]`,
        );
        // callTool validates the result against the declared schema.
        const result = await this.mcp.callTool({
          name: toolUse.name,
          arguments: toolArgs,
        });

        // structuredContent is data the application can use directly.
        if (Array.isArray(result.structuredContent)) {
          finalText.push(
            `[${toolUse.name} returned ${result.structuredContent.length} items]`,
          );
        }

        // content is a list of block types; forward only the text ones. MCP
        // and Anthropic block shapes differ, so other kinds need converting.
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n"),
          is_error: result.isError === true,
        });
      }

      messages.push({
        role: "assistant",
        content: response.content as unknown as Anthropic.ContentBlockParam[],
      });
      messages.push({ role: "user", content: toolResults });

      response = await this.anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        messages,
        tools: this.tools,
      });
    }

    // The turn cap was hit. Keep the last response's text. If it asked for
    // more tools, say they were not run.
    let wantsTools = false;
    for (const block of response.content) {
      if (block.type === "text") {
        finalText.push(block.text);
      } else if (block.type === "tool_use") {
        wantsTools = true;
      }
    }
    if (wantsTools) {
      finalText.push(`[Stopped after ${MAX_TOOL_TURNS} tool-use turns]`);
    }
    return finalText.join("\n");
  }

  listPrompts() {
    if (this.prompts.length === 0) {
      console.log("\nThis server offers no prompts.");
      return;
    }
    for (const prompt of this.prompts) {
      console.log(`\n/${prompt.name} - ${prompt.description ?? prompt.title ?? ""}`);
      for (const arg of prompt.arguments ?? []) {
        const required = arg.required ? "required" : "optional";
        console.log(`    ${arg.name} (${required}): ${arg.description ?? ""}`);
      }
    }
  }

  async completeArgument(promptName: string, argName: string, typed: string) {
    // The server suggests values for a prompt argument from what was typed.
    const result = await this.mcp.complete({
      ref: { type: "ref/prompt", name: promptName },
      argument: { name: argName, value: typed },
    });
    const values = result.completion.values;
    console.log(values.length ? `\n${values.join(", ")}` : "\nNo suggestions.");
  }

  async promptContentText(content: PromptMessage["content"]): Promise<string> {
    // Turn one block of prompt content into text Claude can read.
    switch (content.type) {
      case "text":
        return content.text;
      case "resource": {
        // Embedded: the server already put the data in the prompt.
        const r = content.resource;
        return `Attached ${r.uri}:\n${"text" in r ? r.text : "[binary data omitted]"}`;
      }
      case "resource_link": {
        // Linked: the client fetches the data itself.
        const { contents } = await this.mcp.readResource({ uri: content.uri });
        const body = contents
          .map((c) => ("text" in c ? c.text : "[binary data omitted]"))
          .join("\n");
        return `Attached ${content.uri}:\n${body}`;
      }
      default:
        return `[${content.type} content omitted]`;
    }
  }

  async runPrompt(
    promptName: string,
    args: Record<string, string>,
    rl: readline.Interface,
    signal: AbortSignal,
  ) {
    /**
     * Get a prompt from the server and send its messages to Claude
     */
    const prompt = this.prompts.find(({ name }) => name === promptName);
    if (!prompt) {
      console.log(`\nNo prompt named ${promptName}. Type /prompts to list them.`);
      return;
    }

    // Ask for any required argument that wasn't given on the command line.
    for (const arg of prompt.arguments ?? []) {
      if (arg.required && !args[arg.name]) {
        args[arg.name] = await rl.question(
          `${arg.name} (${arg.description ?? "required"}): `,
          { signal },
        );
      }
    }

    const result = await this.mcp.getPrompt({ name: promptName, arguments: args });

    // Merge back-to-back messages from the same role: Claude expects turns
    // to alternate.
    const messages: Anthropic.MessageParam[] = [];
    console.log("\nMessages from the server's prompt:");
    for (const message of result.messages) {
      const text = await this.promptContentText(message.content);
      console.log(`  [${message.role}] ${text.length > 200 ? text.slice(0, 200) + "…" : text}`);
      const last = messages.at(-1);
      if (last?.role === message.role) {
        last.content = `${last.content}\n\n${text}`;
      } else {
        messages.push({ role: message.role, content: text });
      }
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.log("\nSet ANTHROPIC_API_KEY to send these messages to Claude.");
      return;
    }
    console.log("\n" + (await this.runConversation(messages)));
  }

  async chatLoop() {
    /**
     * Run an interactive chat loop
     */
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    // rl.question() doesn't reject on stdin EOF on its own; wire its close
    // event to an AbortSignal so EOF (Ctrl-D) and SIGINT both unblock it.
    const ac = new AbortController();
    const onClose = () => ac.abort();
    rl.on("close", onClose);
    const onSigint = () => rl.close();
    process.once("SIGINT", onSigint);

    try {
      console.log("\nMCP Client Started!");
      console.log("Type your queries or 'quit' to exit.");
      console.log("Prompt commands:");
      console.log("  /prompts                          list the server's prompts");
      console.log("  /prompt <name> [arg=value ...]    run a prompt");
      console.log("  /complete <name> <arg> [typed]    autocomplete an argument");

      while (true) {
        let message: string;
        try {
          message = await rl.question("\nQuery: ", { signal: ac.signal });
        } catch {
          break;
        }

        if (message.toLowerCase() === "quit") break;

        try {
          // Split on spaces, keeping key="quoted values" together.
          const words =
            message.match(/[^\s=]+="[^"]*"|\S+/g)?.map((w) => w.replace(/"/g, "")) ?? [];
          const [command, name, ...rest] = words;

          if (command === "/prompts") {
            this.listPrompts();
          } else if (command === "/complete" && name && rest[0]) {
            await this.completeArgument(name, rest[0], rest[1] ?? "");
          } else if (command === "/prompt" && name) {
            const args = Object.fromEntries(
              rest
                .filter((w) => w.includes("="))
                .map((w) => [w.slice(0, w.indexOf("=")), w.slice(w.indexOf("=") + 1)]),
            );
            await this.runPrompt(name, args, rl, ac.signal);
          } else if (!process.env.ANTHROPIC_API_KEY) {
            console.log("\nSet ANTHROPIC_API_KEY to ask Claude. Prompt commands work without it.");
          } else {
            const response = await this.processQuery(message);
            console.log("\n" + response);
          }
        } catch (e) {
          console.log(`\nError: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } finally {
      process.off("SIGINT", onSigint);
      rl.off("close", onClose);
      rl.close();
    }
  }

  async cleanup() {
    /**
     * Clean up resources
     */
    await this.mcp.close();
  }
}

async function main() {
  if (process.argv.length < 3) {
    console.log("Usage: node build/index.js <path_to_server_script>");
    return;
  }
  const mcpClient = new MCPClient();
  try {
    await mcpClient.connectToServer(process.argv[2]);

    // Check if we have a valid API key to continue
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.log(
        "\nNo ANTHROPIC_API_KEY found. To query these tools with Claude, set your API key:"
      );
      console.log("  export ANTHROPIC_API_KEY=your-api-key-here");
      console.log("You can still try the prompt commands.");
    }

    await mcpClient.chatLoop();
  } catch (e) {
    console.error("Error:", e);
    await mcpClient.cleanup();
    process.exit(1);
  } finally {
    await mcpClient.cleanup();
    process.exit(0);
  }
}

main();
