# Brainstorm brief — map_d vs client automap (RW-class Chinese MUD)

You are a **product + systems design brainstormer** (not implementer).  
Reply in **Traditional Chinese** (technical terms may stay English).  
No code. No generic “just use Mudlet” fluff — be concrete and ranked.

## Context (facts)

**mudgate** = browser zMUD-class client (React/TS + WSS auth proxy).  
Depth benchmark: **Revival World (重生的世界)** — Big5, full VT, **server `map_d`**.

### Two different “maps”

1. **Server map_d** (truth for cities/areas)  
   - Full-screen VT overlay: SAVEC → CUP rows → REST  
   - Server paints glyphs/colors; city ~25×9 viewport  
   - Client already has VT screen buffer that renders this correctly  

2. **Client automap** (side panel)  
   - No reliable GMCP Room.Info on RW  
   - Text parse of 出口/title is fragile  
   - Pure coord grid was mocked as `oooo@oooo`  
   - Current approach: **Nav Shell** — Nearby HUD + dead-reckon session trail + map_d mirror backlog  

### User pain

- Classic Mudlet-style high-precision automap is a bad fit when map_d already owns spatial truth  
- User asked: for RW-like systems, is automap hopeless? Any **ambitious / high-leverage** product ideas still worth doing?

### Constraints

- Browser only (no raw TCP)  
- Chinese-first UX (zh-TW)  
- map_d must never regress  
- Prefer honest confidence (known/guessed/unknown) over pretty wrong graphs  
- Optional later multi-MUD; RW first  

## Questions (answer all)

1. **Strategic stance**: For map_d MUDs, what should client claim to be? (nav assistant / second map / something else)

2. **Top 5 ambitious ideas** that are still *technically plausible* in a browser client without server GMCP — ranked by **player wow × feasibility** for RW-class. Include at least one “moonshot”.

3. **Anti-ideas**: What should we explicitly refuse to build for RW (even if competitors have it)?

4. **map_d leverage**: How to productize the *already-correct* VT map (mirror, freeze-frame, annotate, OCR-less interaction, embed official HTML map, etc.) without re-deriving topology?

5. **When full room-graph automap becomes worth it** (labyrinth / no map_d zones / multi-mud) — gating criteria.

6. **One recommended 2-sprint roadmap** (P0/P1/P2 bullets) for mudgate given current Nav Shell.

## Output format (required)

```text
ENGINE: <exact model name>
STANCE: <one sentence>

TOP_IDEAS:
1. <name> — <why wow> — <feasibility H/M/L> — <risk>
2. ...
3. ...
4. ...
5. ... (include one moonshot)

ANTI:
- ...

MAP_D_LEVERAGE:
- ...

GRAPH_WHEN:
- ...

SPRINTS:
- P0: ...
- P1: ...
- P2: ...

WILDEST_BUT_USEFUL: <one paragraph>
```
