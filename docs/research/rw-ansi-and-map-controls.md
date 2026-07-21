# RW ANSI / ASCII control surface (must be complete)

> Source of truth: public **RWlib 1.0.2** + **Undine-1.3** from  
> https://www.revivalworld.org/rw/opensource  
> Extracted 2026-07-21 into analysis notes (not vendored into this repo).

This is **not** “pretty colors only”. Revival World’s map UI is a **full-screen VT100-style overlay**: save cursor → absolute addressing → paint map rows → restore cursor, plus scroll-region freezes for title screens. A client that only does SGR (`\e[…m`) will **break map_d / look-on-map**.

## Hard product rule

| Rule | Meaning |
|------|---------|
| **Complete control plane** | Implement the control sequences RW actually emits, with correct terminal semantics |
| **Byte-first** | Parse on the Big5/Telnet byte stream; do not strip non-SGR CSI |
| **Cell buffer** | Maintain a real screen buffer (rows×cols×attrs); map redraw patches cells in place |
| **Parity target** | Behavior of a good zMUD/VT100 session on RW, not “good enough for chat” |

## 1. Canonical macros — `/include/ansi.h`

RW defines (Clode@RW additions marked):

| Macro | Escape | Semantics |
|-------|--------|-----------|
| `ESC` | `\e` | ESC |
| `CSI` | `\e[` | CSI |
| `SGR(x)` | `\e[xm` | graphics rendition |
| `NOR` | `\e[m` / `\e[0m` | reset attrs |
| `BOLD` | `\e[1m` | bold |
| `ITALIC` | `\e[3m` | italic |
| `U` | `\e[4m` | underline |
| `BLINK` | `\e[5m` | blink |
| `REV` | `\e[7m` | reverse |
| `HIREV` | `\e[1;7m` | bold reverse |
| fg `BLK`…`CYN`, `WHT=\e[1;30m` | 30–36, special grey | |
| bg `BBLK`…`BWHT` | 40–47 | |
| hi fg `HBLK`…`HIW` | `1;30`…`1;37` | |
| hi bg `HBBLK`…`HBWHT` | `1;40`…`1;47` | |
| `BEEP` | `\a` | BEL |
| `CLR` | `\e[2J` | erase entire display |
| `HOME` | `\e[H` | cursor home |
| `SAVEC` | `\e[s` | **save cursor** (DECSC-ish) |
| `REST` | `\e[u` | **restore cursor** |
| `FRTOP` | `\e[2;25r` | freeze/scroll region |
| `FRBOT` | `\e[1;24r` | freeze/scroll region |
| `UNFR` | `\e[r` | reset scroll region |
| `FREEZE(x,y)` | `\e[x;yr` | **scroll region** (Clode@RW) |
| `MOVEC(x,y)` | `\e[x;yH` | **CUP** absolute (Clode@RW) |
| `REF` | `CLR+HOME` | clear + home |
| `REVINDEX` | `\eM` | reverse index |
| `BIGTOP/BOT` | `\e#3` / `\e#4` | double height |
| `SINGW` / `DBL` | `\e#5` / `\e#6` | single/double width |

Also documented in-header: VT100 erase `J`/`K` modes, cursor keys, etc.

## 2. Map pipeline (why partial ANSI fails)

### `look` on a maproom — `/cmds/std/ppl/look.c`

When entering map view (and title screen owner changes to `MAP_D`):

```text
SAVEC + REF + REST
→ \e[s \e[2J \e[H \e[u
```

Then appends `MAP_D->show_map(loc)` which is dispatched to city/area/zone systems.

### City map — `/system/daemons/city_d_main.c` `show_map`

Pattern:

```text
SAVEC                         // \e[s
\e[1;1H                       // absolute top-left header
for each row j:
  \e[(j+2);1H │ <cells…> │sidebar
footer:
  \e[(j+2);1H └…┘
  \e[(j+3);1H _____城區地圖_
  \e[u                        // REST — restore pre-map cursor
  REST                        // again
```

Cells are Big5 glyphs with embedded SGR, e.g. `HIY"Γ"NOR`, player marker via:

```text
ansi_part(map2[j][i]) + HIC"╳"NOR
```

Vision size (from `map.h`): city **25×9**, area **31×9**, full map grid **100×100**.

### Title / freeze band — `/system/kernel/simul_efun/title_screen.c`

```text
startup_title_screen:
  newlines + CLR + FREEZE(line, height)   // scroll region
spec_line_msg:
  SAVEC + MOVEC(line,1) + msg + REST      // paint one frozen line
reset_screen:
  clear lines via MOVEC; REST SAVEC UNFR REST
```

Used when switching city/area systems (`reset_screen` from city/area daemons) and games like mj.

## 3. Undine driver ANSI helpers (map cell color)

`packages/ansi.c` (Clode@RW):

| Efun | Role |
|------|------|
| `ansi()` | `$HIR$` style codes + pass through SGR CSI |
| `remove_ansi()` | strip **only** `\e[…m` SGR (leaves cursor CSI intact if present) |
| `noansi_strlen()` | visible length ignoring SGR |
| `ansi_part()` | keep leading SGR of a cell string (for dual-attr map paint) |
| `remove_bg_ansi()` | strip background color params |
| `kill_repeat_ansi()` | compress repeated SGR |

**Client implication:** map cells routinely interleave SGR with Big5 DBCS. Client must:

1. Parse SGR and non-SGR CSI separately.
2. Support **attribute carry** into the next glyph (`ansi_part` use case).
3. Count columns with DBCS width (full-width = 2 cells) matching `noansi_strlen` / terminal columns.

## 4. Minimum control set for “RW complete” gate

### Must implement (acceptance: city/area map usable)

| Code | Name | RW use |
|------|------|--------|
| `\e[s` / `\e[u` | save/restore cursor | every map frame |
| `\e[H` / `\e[r;cH` | CUP | map rows, headers |
| `\e[2J` | ED erase display | look → map, title |
| `\e[r` / `\e[t;br` | DECSTBM scroll region | title freeze |
| `\e[0m`… colors, bold, dim, reverse, underline, blink | SGR | everywhere |
| C0: BEL, BS, HT, LF, CR | | |
| Big5 DBCS + mid-stream SGR | 雙色 / cell attrs | map tiles |

### Should implement (parity / future-proof)

| Code | Why |
|------|-----|
| `\e[K` / `\e[0-2K` EL | line erase |
| `\e[J` / `\e[0-2J` ED variants | partial clear |
| `\e[A-D` CUU/CUD/CUF/CUB | cursor relative |
| `\eM` RI | reverse index |
| `\e#3–6` double width/height | ansi.h exports them |
| DEC private modes if seen live | probe later |

### Explicit non-goal for v1

- Full historical VT52 / entire X3.64 table in `doc/help/ansicode` (reference only).
- Perfect soft-font / alternate charset ROM.

## 5. Terminal architecture consequence

```
bytes (Big5 + CSI + SGR + C0)
  → Telnet/MCCP strip
  → Control parser (state machine)
  → Screen model: {rows, cols, cells[{ch|dbcs, fg, bg, attrs}], cursor, saved_cursor, scroll_region}
  → Renderer (canvas/DOM/WebGL)
  → Scrollback is separate from the “live map overlay” region
```

**Stock xterm.js** may cover much CSI, but:

- Big5 on the wire still needs a decode/cell layer in front, and
- Dual-color / `ansi_part` map cells need explicit tests against RWlib fixtures.

Recommendation: either (a) custom cell buffer + renderer with VT subset above, or (b) xterm.js **after** a Big5→UTF-16 + control-preserving adapter, with golden tests from recorded map frames.

## 6. Fixture plan

| Fixture | How |
|---------|-----|
| Banner | `tests/fixtures/streams/rw-banner-4000.bin` (done) |
| Synthetic map frame | Build from `city_d_main.c` sequence templates + Big5 tiles |
| Live map frame | User captures after login (no secrets); optional |
| Title freeze | Synthesize from `title_screen.c` |

## 7. References in tree

- Plan: `docs/plans/2026-07-21-web-zmud-rw.md` §2.5 / Phase 1–3
- Probe: `docs/research/rw-probe-2026-07-21.md`
- Upstream opensource index: https://www.revivalworld.org/rw/opensource
