import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

const WORDS = ["amber", "breeze", "cedar", "drift", "ember", "frost", "glow", "harbor", "isle", "jade"];

/**
 * Registers tool_1..tool_N for testing how many tools a host can handle.
 * N comes from STRESS_TOOLS; unset or 0 registers none.
 */
export function registerStressTools(server: McpServer): void {
  const count = Number(process.env.STRESS_TOOLS ?? 0);
  if (!Number.isInteger(count) || count <= 0) return;

  for (let i = 1; i <= count; i++) {
    server.registerTool(
      `tool_${i}`,
      {
        description: `Test tool ${i}. Returns a random word and number. Only for tool-count testing.`,
        inputSchema: z.object({
          note: z.string().optional().describe("Any text; it is echoed back"),
        }),
      },
      async ({ note }) => {
        const word = WORDS[Math.floor(Math.random() * WORDS.length)];
        const number = Math.floor(Math.random() * 1000);
        const echo = note ? ` You said: ${note}` : "";
        return {
          content: [{ type: "text", text: `tool_${i} says ${word} ${number}.${echo}` }],
        };
      },
    );
  }
}
