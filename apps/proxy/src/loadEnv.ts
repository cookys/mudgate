/**
 * Minimal .env loader (no dotenv dependency).
 * Does not override existing process.env keys.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function parseEnvFile(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

function applyEnv(parsed: Record<string, string>): void {
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function tryLoad(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    applyEnv(parseEnvFile(readFileSync(path, "utf8")));
    return true;
  } catch {
    return false;
  }
}

/**
 * Load first existing file among candidates.
 * Search order: explicit paths, cwd/.env, repo-root/.env (from this package layout).
 */
export function loadDotEnv(extraPaths: string[] = []): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  // apps/proxy/src → repo root = ../../../
  const repoRoot = resolve(here, "../../..");
  const candidates = [
    ...extraPaths.map((p) => resolve(p)),
    resolve(process.cwd(), ".env"),
    resolve(repoRoot, ".env"),
    resolve(here, "../.env"),
  ];
  const loaded: string[] = [];
  const seen = new Set<string>();
  for (const p of candidates) {
    if (seen.has(p)) continue;
    seen.add(p);
    if (tryLoad(p)) loaded.push(p);
  }
  return loaded;
}
