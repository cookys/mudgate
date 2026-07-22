/**
 * zMUD-style command history for the bottom command line.
 * cursor === -1 means "editing draft"; ↑ enters history from the newest entry.
 */

export class CommandHistory {
  private items: string[] = [];
  private cursor = -1;
  private draft = "";
  constructor(private readonly max = 200) {}

  /** Record a successfully submitted line (not password). */
  push(line: string): void {
    const t = line.trim();
    if (!t) return;
    if (this.items[this.items.length - 1] !== t) {
      this.items.push(t);
      if (this.items.length > this.max) this.items.shift();
    }
    this.cursor = -1;
    this.draft = "";
  }

  /** Move older. Pass current draft when leaving live edit. */
  up(currentDraft: string): string | null {
    if (this.items.length === 0) return null;
    if (this.cursor === -1) {
      this.draft = currentDraft;
      this.cursor = this.items.length - 1;
    } else if (this.cursor > 0) {
      this.cursor -= 1;
    }
    return this.items[this.cursor] ?? null;
  }

  /** Move newer; past newest restores draft. */
  down(): string | null {
    if (this.cursor === -1) return null;
    if (this.cursor < this.items.length - 1) {
      this.cursor += 1;
      return this.items[this.cursor] ?? null;
    }
    this.cursor = -1;
    return this.draft;
  }

  /** Test / debug */
  snapshot(): { items: string[]; cursor: number; draft: string } {
    return {
      items: [...this.items],
      cursor: this.cursor,
      draft: this.draft,
    };
  }

  clear(): void {
    this.items = [];
    this.cursor = -1;
    this.draft = "";
  }
}

const ECHO_KEY = "mudgate.echoCommands";

/** zMUD "Echo commands" preference — default on. */
export function loadEchoCommands(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const v = localStorage.getItem(ECHO_KEY);
    if (v == null) return true;
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

export function saveEchoCommands(on: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(ECHO_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
