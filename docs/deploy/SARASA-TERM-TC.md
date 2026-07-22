# Self-host / install Sarasa Term TC (F3)

When trial alignScore is off dual-width or CJK glyphs look like tofu:

1. Install [Sarasa Gothic / Sarasa Term](https://github.com/be5invis/Sarasa-Gothic) **TC** variant system-wide.
2. Or load a subset webfont via your own CDN and set **Custom primary** to that family.
3. Keep **TC fallback chain** enabled so missing primaries still fall back.
4. Use **Font trial A/B** — green ≈2.0 alignScore preferred.

mudgate does **not** bundle full CJK fonts in git.
