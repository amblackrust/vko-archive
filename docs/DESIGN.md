# DESIGN.md

White (day) or graphite-black (night) page, one blue for actions, rounded shapes, Geologica set with soft corners. Content sits in hairline-ruled lists, not card grids; a few solid colour tiles carry topics.

## Rules
- Use the full viewport width (`.wrap`, gutter `--gutter`, cap 1920px). No sidebars on public pages; admin has a top bar with grouped menus and full-width tables.
- Lists and tables over cards. Panels are rounded (16–32px) and only where a block needs to stand apart (dates, help, assistant). No perforated edges, no film/stamp ornament.
- Copy is short: a heading, at most one line of lead. No notes about demo content anywhere.
- One typeface everywhere: Geologica (self-hosted, `font-variation-settings: "SHRP" 0` = softest corners). Headings 700, tracking -0.03em.
- Colours: `--action` blue, `--postmark` red (status, highlights), `--ochre`/`--sage` topic tones, `--ok`/`--bad` states. Tones for tiles come from `src/lib/tones.ts` (white text in both themes).
- Motion: springs (`src/lib/motion.ts`); press feedback on pointer-down; one theme-change circle transition; reduced motion/transparency/contrast respected, plus the in-site switches.

## Assistant
Docked right panel (26rem), pushes the page on wide screens, opened from the header button or Ctrl/Cmd+J. Replies stream; `[S1]` markers and source chips link to the real pages.

## Admin
Generic list + form per resource (`src/lib/admin-config.ts`), language tabs for translatable fields, workflow buttons from the server's `available_actions`, history, files. Same tokens, denser tables.
