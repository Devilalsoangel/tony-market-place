// susej-guard: Cline plugin (hooks + tool) for this marketplace repo.
// - Observes every tool call (console summary kept out of model context).
// - Blocks CATASTROPHIC command patterns before they execute (throw = block,
//   per Cline plugin guidelines: "a thrown error in beforeTool counts as a
//   tool failure").
// - Registers a session_preflight tool: stack truth probes for PG/admin/Metro.

// Minimal ambient typing so the file also passes standalone tsc without
// installing @cline/sdk locally (host strips & provides it at runtime).
declare module "@cline/sdk" {
  export interface PluginHookContext {
    input?: Record<string, unknown>;
    [k: string]: unknown;
  }
  export interface AgentPluginApi {
    registerTool(tool: unknown): void;
    [k: string]: unknown;
  }
  export interface AgentPlugin {
    name: string;
    manifest: { capabilities: string[] };
    setup?(api: AgentPluginApi, ctx?: unknown): void;
    hooks?: Record<string, (context?: any) => any>;
  }
  export function createTool(defn: {
    name: string;
    description: string;
    inputSchema?: Record<string, unknown>;
    execute: (input: any) => Promise<unknown> | unknown;
  }): unknown;
}

let toolCalls = 0;
let blockedCalls = 0;

// Only truly catastrophic, unqualified actions get blocked. Repo ops like
// removing susej-admin-panel/.next are legitimate recovery steps and allowed.
const KILL_PATTERNS: Array<{ re: RegExp; why: string }> = [
  { re: /(rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\s+(\/|"C:\\Users\\TONI\\projects")?\s*$)/i, why: "rm -rf with empty/target-less operand" },
  { re: /drop\s+(database|schema)\b/i, why: "DROP DATABASE/SCHEMA" },
  { re: /prisma\s+migrate\s+reset\b(?!.*)--force/i, why: "prisma migrate reset --force (wipes DB)" },
  { re: /git\s+push\s+[^\n]*--force[^\n]*\bmain\b/i, why: "force-push to main" },
  { re: /Remove-Item\s+-Recurse\s+-Force\s+"?C:\\Users\\TONI\\projects\\social-commerce-template"?\s*$/i, why: "deleting the whole repo" },
];

function commandText(input: Record<string, unknown>): string {
  // tolerate shapes: {commands:[...]}, {command:"..."}, {input:"..."}
  const parts: string[] = [];
  const push = (v: unknown) => typeof v === "string" && parts.push(v);
  push(input?.["command"]);
  push(input?.["input"]);
  if (Array.isArray(input?.["commands"])) input["commands"].forEach(push);
  return parts.join("\n");
}

export default {
  name: "susej-guard",
  manifest: { capabilities: ["tools", "hooks"] },

  setup(api: any) {
    api.registerTool(
      createTool({
        name: "session_preflight",
        description:
          "Probe local stack truth for this repo before live-data work: admin :3000 /api/v1/config reachability, Postgres :5432 listener, Metro :8081 status. Returns exact statuses - use instead of guessing whether backend services are alive.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async () => {
          const lines: string[] = [];
          // Admin/config probe via fetch (Node >= 18 global)
          try {
            const ctl = new AbortController();
            const t = setTimeout(() => ctl.abort(), 5000);
            const started = Date.now();
            const res = await fetch("http://127.0.0.1:3000/api/v1/config", { signal: ctl.signal });
            clearTimeout(t);
            lines.push(`admin /api/v1/config -> HTTP ${res.status} (${Date.now() - started}ms)`);
          } catch (e: any) {
            lines.push(`admin /api/v1/config -> DOWN (${String(e?.cause?.code ?? e?.name ?? e)})`);
          }
          // Listener checks
          for (const port of [5432, 3000, 8081]) {
            try {
              const net = await import("node:child_process");
              const r = net.spawnSync("cmd", ["/c", `netstat -ano | findstr :${port}`], { encoding: "utf8", timeout: 8000 });
              const listening = String(r.stdout ?? "").includes(`:${port}`);
              lines.push(`port ${port} -> ${listening ? "LISTENING" : "closed"}`);
            } catch {
              lines.push(`port ${port} -> probe failed`);
            }
          }
          return { content: [{ type: "text", text: lines.join("\n") }] };
        },
      })
    );
  },

  hooks: {
    async beforeTool(context: any) {
      const name = String(context?.tool?.name ?? context?.toolCall?.name ?? "");
      const input = (context?.input ?? context?.toolCall?.input ?? {}) as Record<string, unknown>;
      // Guard only command-executing tools (name-based heuristic)
      if (/command|bash|shell|exec/i.test(name)) {
        const text = commandText(input);
        for (const { re, why } of KILL_PATTERNS) {
          if (re.test(text)) {
            blockedCalls++;
            console.error(`[susej-guard] BLOCKED (${why}): ${text.slice(0, 160)}`);
            throw new Error(`Blocked by susej-guard plugin: ${why}. Reconsider or ask the user.`);
          }
        }
      }
      toolCalls++;
      return undefined; // observe, don't mutate
    },

    async afterRun(context: any) {
      const usage: any = context?.result?.usage;
      const total =
        (usage?.totalInputTokens ?? usage?.inputTokens ?? 0) +
        (usage?.totalOutputTokens ?? usage?.outputTokens ?? 0);
      console.error(`[susej-guard] run done | toolCalls=${toolCalls} blocked=${blockedCalls} tokens~${total}`);
    },
  },
};
