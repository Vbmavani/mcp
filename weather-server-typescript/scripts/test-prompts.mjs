// End-to-end test of every prompt over stdio, against a fake NWS.
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const nws = createServer((_req, res) => {
  res.setHeader("Content-Type", "application/geo+json");
  res.end(
    JSON.stringify({
      features: [
        { properties: { event: "Test Heat Advisory", severity: "Moderate", areaDesc: "Valley" } },
      ],
    }),
  );
});
// Port 0 lets the OS pick a free port.
await new Promise((resolve) => nws.listen(0, "127.0.0.1", resolve));
const NWS_PORT = nws.address().port;

const check = (ok, what) => {
  if (!ok) throw new Error(what);
  console.log("PASS", what);
};

let exitCode = 1;
const client = new Client(
  { name: "prompts-test", version: "1.0.0" },
  { versionNegotiation: { mode: "auto" } },
);

try {
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [join(dirname(fileURLToPath(import.meta.url)), "../build/index.js")],
      env: { ...process.env, NWS_API_BASE: `http://127.0.0.1:${NWS_PORT}` },
      stderr: "ignore",
    }),
  );

  const { prompts } = await client.listPrompts();
  const byName = Object.fromEntries(prompts.map((p) => [p.name, p]));
  check(
    ["weather-help", "plan-outdoor-day", "state-briefing", "alert-summary"].every((n) => byName[n]),
    "prompts/list returns all four prompts",
  );
  const planArgs = byName["plan-outdoor-day"].arguments;
  check(
    planArgs.find((a) => a.name === "city")?.required === true &&
      planArgs.find((a) => a.name === "activity")?.required !== true,
    "plan-outdoor-day marks city required and activity optional",
  );

  const help = await client.getPrompt({ name: "weather-help" });
  check(help.messages.length === 1 && help.messages[0].content.type === "text", "weather-help returns fixed text");

  const plan = await client.getPrompt({
    name: "plan-outdoor-day",
    arguments: { city: "Austin, TX", activity: "hiking", when: "tomorrow" },
  });
  check(plan.messages[0].content.text.includes("hiking in Austin, TX tomorrow"), "plan-outdoor-day fills in arguments");

  const missing = await client.getPrompt({ name: "plan-outdoor-day", arguments: {} }).then(
    () => null,
    (error) => error,
  );
  check(missing !== null, "plan-outdoor-day rejects a missing required argument");

  const states = await client.complete({
    ref: { type: "ref/prompt", name: "state-briefing" },
    argument: { name: "state", value: "n" },
  });
  check(states.completion.values.includes("NY") && states.completion.values.every((v) => v.startsWith("N")), "state autocompletes from what was typed");

  const activities = await client.complete({
    ref: { type: "ref/prompt", name: "plan-outdoor-day" },
    argument: { name: "activity", value: "c" },
  });
  check(activities.completion.values.join() === "cycling,camping", "activity autocompletes");

  const briefing = await client.getPrompt({ name: "state-briefing", arguments: { state: "tx" } });
  const embedded = briefing.messages.find((m) => m.content.type === "resource");
  check(
    embedded?.content.resource.uri === "weather://alerts/TX" &&
      JSON.parse(embedded.content.resource.text)[0].event === "Test Heat Advisory",
    "state-briefing embeds live alert data",
  );

  const summary = await client.getPrompt({ name: "alert-summary", arguments: { state: "ca" } });
  const roles = summary.messages.map((m) => m.role).join();
  const link = summary.messages.find((m) => m.content.type === "resource_link");
  check(roles === "user,assistant,user,user", "alert-summary includes an example assistant answer");
  check(link?.content.uri === "weather://alerts/CA", "alert-summary links the data instead of embedding it");
  const linked = await client.readResource({ uri: link.content.uri });
  check(JSON.parse(linked.contents[0].text)[0].event === "Test Heat Advisory", "the linked resource can be read");

  exitCode = 0;
} catch (error) {
  console.error("FAIL", error);
} finally {
  await client.close().catch(() => {});
  nws.close();
  nws.closeAllConnections();
}
process.exit(exitCode);
