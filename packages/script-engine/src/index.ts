/**
 * Declarative script engine (Phase 2) — no arbitrary JS, no cookie/fetch access.
 */

export type Alias = { name: string; expand: string; enabled?: boolean };
export type Trigger = {
  id: string;
  pattern: string; // regex source
  flags?: string;
  action: "send" | "highlight" | "gag" | "setvar";
  payload?: string; // command or var name=value template
  enabled?: boolean;
  cooldownMs?: number;
};
export type Package = {
  id: string;
  name: string;
  enabled: boolean;
  aliases: Alias[];
  triggers: Trigger[];
  variables?: Record<string, string>;
};

export type EngineEvent =
  | { type: "send"; line: string }
  | { type: "highlight"; line: string }
  | { type: "gag" }
  | { type: "setvar"; key: string; value: string };

export class ScriptEngine {
  packages: Package[] = [];
  variables: Record<string, string> = {};
  private lastFire = new Map<string, number>();
  private queue: string[] = [];

  importPackage(json: string): Package {
    const p = JSON.parse(json) as Package;
    if (!p.id || !p.name) throw new Error("invalid package");
    // strip anything that looks like JS code execution hooks
    if ("code" in (p as object) || "eval" in (p as object)) {
      throw new Error("executable packages forbidden");
    }
    p.aliases = p.aliases ?? [];
    p.triggers = p.triggers ?? [];
    p.variables = p.variables ?? {};
    this.packages = this.packages.filter((x) => x.id !== p.id);
    this.packages.push(p);
    Object.assign(this.variables, p.variables);
    return p;
  }

  exportPackage(id: string): string {
    const p = this.packages.find((x) => x.id === id);
    if (!p) throw new Error("not found");
    return JSON.stringify(p, null, 2);
  }

  setEnabled(id: string, enabled: boolean): void {
    const p = this.packages.find((x) => x.id === id);
    if (p) p.enabled = enabled;
  }

  /** Expand alias; supports multi-command with `;` */
  expandInput(line: string): string[] {
    const trimmed = line.trim();
    const word = trimmed.split(/\s+/)[0] ?? "";
    const rest = trimmed.slice(word.length).trim();
    for (const pkg of this.packages) {
      if (!pkg.enabled) continue;
      for (const a of pkg.aliases) {
        if (a.enabled === false) continue;
        if (a.name === word) {
          let exp = a.expand;
          exp = exp.replace(/\$args/g, rest);
          exp = this.substVars(exp);
          return exp.split(";").map((s) => s.trim()).filter(Boolean);
        }
      }
    }
    return [this.substVars(line)];
  }

  enqueue(lines: string[]): void {
    this.queue.push(...lines);
  }

  drainQueue(max = 10): string[] {
    return this.queue.splice(0, max);
  }

  /** Process one server line (visible text). Returns events; may gag. */
  onServerLine(line: string, now = Date.now()): EngineEvent[] {
    const events: EngineEvent[] = [];
    let gag = false;
    for (const pkg of this.packages) {
      if (!pkg.enabled) continue;
      for (const t of pkg.triggers) {
        if (t.enabled === false) continue;
        let re: RegExp;
        try {
          re = new RegExp(t.pattern, t.flags ?? "");
        } catch {
          continue;
        }
        const m = re.exec(line);
        if (!m) continue;
        const cd = t.cooldownMs ?? 0;
        const last = this.lastFire.get(t.id) ?? 0;
        if (cd && now - last < cd) continue;
        this.lastFire.set(t.id, now);

        // capture groups $1.. into temps
        const locals: Record<string, string> = { ...this.variables };
        for (let i = 1; i < m.length; i++) {
          locals[String(i)] = m[i] ?? "";
        }

        switch (t.action) {
          case "gag":
            gag = true;
            events.push({ type: "gag" });
            break;
          case "highlight":
            events.push({ type: "highlight", line });
            break;
          case "send": {
            const cmd = this.substVars(t.payload ?? "", locals);
            events.push({ type: "send", line: cmd });
            this.enqueue([cmd]);
            break;
          }
          case "setvar": {
            const payload = t.payload ?? "";
            const eq = payload.indexOf("=");
            if (eq > 0) {
              const key = payload.slice(0, eq).trim();
              const val = this.substVars(payload.slice(eq + 1), locals);
              // forbid secret-looking keys
              if (/cookie|password|token|localStorage|document/i.test(key)) break;
              this.variables[key] = val;
              events.push({ type: "setvar", key, value: val });
            }
            break;
          }
        }
      }
    }
    if (gag) return events.filter((e) => e.type === "gag" || e.type === "send");
    return events;
  }

  /** Hard deny network / DOM access surface */
  forbiddenApiAccess(name: string): never {
    throw new Error(`script-engine denies access to ${name}`);
  }

  get cookie(): never {
    return this.forbiddenApiAccess("cookie");
  }

  get localStorage(): never {
    return this.forbiddenApiAccess("localStorage");
  }

  fetch(): never {
    return this.forbiddenApiAccess("fetch");
  }

  private substVars(s: string, extra: Record<string, string> = {}): string {
    const map = { ...this.variables, ...extra };
    return s.replace(/\$(\w+)/g, (_, k: string) => map[k] ?? "");
  }
}
