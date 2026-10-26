# Handoff: JustB Magazine Refresh

## Overview
A typographic, magazine-style refresh of the four core JustB surfaces — Locate, Arrive (press-and-hold), Breathe, and Today (feed) — plus a parallel night mode. The goal is an elegant, editorial almanac where the UI recedes and the content carries the experience.

## About the design files
The files in this bundle (`JustB Magazine.html`, `screens.jsx`, plus the helper starter components) are **design references built in plain HTML/React**. They are not production code to drop in. The job is to **recreate these designs inside the existing Next.js 14 / TypeScript / Tailwind / Framer Motion codebase**, using its established patterns — the existing `FeedCard`, `BreathingExercise`, `LocationInput`, and `app/page.tsx` orchestration stay in place; their visual layer changes.

## Fidelity
**High-fidelity.** Exact colors, typography scales, layout proportions, and the small editorial flourishes (kickers with em-rules, drop cap, pull-quote treatment) are specified below and visible in `screens.jsx`. Recreate pixel-faithfully using Tailwind + CSS variables.

---

## Design tokens

Add these to `app/globals.css`, replacing the current `:root` block. Keep the existing category colors — only the paper/ink/accent tokens change. Add a `.theme-night` class for night mode.

```css
:root {
  /* Paper / ink */
  --bg:               #f5efe4;
  --bg-card:          #ffffff;          /* used sparingly — most surfaces are paper */
  --bg-quote:         rgba(28,26,22,.025);
  --text-primary:     #1c1a16;
  --text-secondary:   #6e655a;
  --text-muted:       #a39787;
  --rule:             rgba(28,26,22,.11);
  --rule-strong:      rgba(28,26,22,.18);
  --accent:           #b56a3a;          /* sienna */

  /* Atmospheric top wash (replaces gradient strip) */
  --sky-wash:         linear-gradient(180deg, rgba(198,216,235,.7) 0%, transparent 100%);
}

.theme-night {
  --bg:               #0f111a;
  --bg-card:          rgba(232,226,211,.03);
  --bg-quote:         rgba(232,226,211,.03);
  --text-primary:     #e8e2d3;
  --text-secondary:   #9a9385;
  --text-muted:       #6c6757;
  --rule:             rgba(232,226,211,.13);
  --rule-strong:      rgba(232,226,211,.18);
  --accent:           #d7a85f;          /* warm amber */
  --sky-wash:         linear-gradient(180deg, rgba(48,62,98,.35) 0%, transparent 100%);
}
```

**Night mode trigger.** Apply `.theme-night` on `<body>` (or `<html>`) when the local hour is `< 5` or `>= 21` — the same threshold the existing `getTimeOfDayGradient` uses for `isNight`. Lift that calculation into a `useDarkMode()` hook that:
1. Computes `isNight` from `new Date().getHours()`.
2. Sets `document.documentElement.classList.toggle('theme-night', isNight)`.
3. Returns the boolean for components that need it.

Drop the `isNight` prop threading through `FeedCard`, `Glyphs`, `BreathingExercise`, etc. — they should read styles from the CSS variables instead, so the same component renders correctly in either mode.

---

## Typography

Three families. All from Google Fonts.

```html
<!-- app/layout.tsx <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&family=Geist:wght@300;400;500;600&display=swap" rel="stylesheet">
```

Extend `tailwind.config.ts`:
```ts
fontFamily: {
  display: ['"DM Serif Display"', 'Georgia', 'serif'],   // logo, headlines, drop cap
  serif:   ['"Source Serif 4"', 'Georgia', 'serif'],     // body, lede italics, list items
  sans:    ['Geist', 'ui-sans-serif', 'system-ui'],      // kickers, meta, almanac numbers
},
```

**Type scale (used throughout):**

| Role | Family | Size | Weight | Line-height | Letter-spacing | Notes |
|------|--------|-----:|-------:|------------:|---------------:|-------|
| Wordmark (locate screen) | display | 96 | 400 | 0.95 | -0.02em | |
| Section headline / hero | display | 36 | 400 | 1.02 | -0.015em | |
| Article H3 | display | 22–28 | 400 | 1.05–1.1 | -0.01em | |
| Section header (Local pulse, Field notes) | display | 18 | 400 | — | -0.005em | |
| Standfirst (italic lede) | serif italic | 16 | 300 | 1.45 | — | sub color |
| Body paragraph | serif | 14–15 | 400 | 1.55–1.6 | — | primary color |
| Kicker (CatMark, eyebrow) | sans | 9.5–10 | 500 | — | 0.18–0.28em UPPERCASE | accent color |
| Meta (date, almanac labels) | sans | 9.5–11 | 400 | — | 0.16–0.22em UPPERCASE | muted/sub |
| Almanac numbers | serif | 13 | 400 | — | tnum | primary |
| Drop cap (lede first letter) | display | 44 | 400 | 0.85 | — | accent, `float:left`, `padding-right: 8px`, `padding-top: 4px` |

---

## Screen 1 — Locate

**Purpose:** First-run city pick + freeform search.

**Layout** (margin `28px` horizontal, top padding `72px`):
- Top meta row: centered, sans 10/0.28em uppercase, muted. Format: `Vol. 26 · Sat · May 16` with a 3px dot between. Used as a tiny periodical chrome.
- Center stack (flex column, justify-center):
  - Wordmark `JustB` — display 96 / 400.
  - Standfirst `just be here. / just be now.` — serif italic 19/300, line-break between sentences, color `--text-secondary`, max-width 280px.
  - Ornament: 24px rule + 4×4px accent diamond + 24px rule, gap 10px, `marginTop: 28px`.
- Bottom search block (above 40px footer pad):
  - Eyebrow `where are you, today` — sans 10/0.22em uppercase, centered, muted, `marginBottom: 10px`.
  - Field: bottom-border only (no rounded pill). `borderBottom: 1px solid var(--rule-strong); paddingBottom: 12px`.
    - 14×18 map-pin SVG in accent color (1.4 stroke, accent fill on inner circle).
    - Typed text in `font-serif` 20px (currently `Sea`).
    - 1px×18px blinking caret in accent (`animation: caret 1.1s steps(2) infinite`).
    - Trailing arrow-right SVG (16×12, primary color, 0.6 opacity).
  - Suggestions list: replaces the current pill dropdown.
    - `<ul>` with no styling. Each `<li>` is a 3-col grid: zero-padded index `01` (sans 9/0.18em uppercase muted, 18px min), city name (serif 17 primary, flex:1), region (sans 11 sub).
    - `padding: 10px 0`, divider `1px solid var(--rule-strong)` between items (not after the last).

**Implementation hook:** Rewrite `components/location-input.tsx` to render in this form. The suggestion fetch + submit logic is unchanged; only the markup/styles change. Remove the white card with shadow.

**Replace `app/page.tsx` location-phase render** with this centered layout — drop the `text-center mb-10` block; the wordmark now belongs inside `LocationInput` (or, cleaner, keep it as page-level and just style the field).

---

## Screen 2 — Arrive (press-and-hold)

**Purpose:** Two-second hold to enter breathing.

**Layout:**
- Top: a soft sky wash (260px high, `--sky-wash` variable). In night mode, render a ~38px warm-cream moon at `top:80px right:60px` with `radial-gradient(circle at 35% 35%, #f1e8c8 0%, #d2c290 60%, #8d7b48 100%)` and `box-shadow: 0 0 30px rgba(241,232,200,0.15)`.
- Masthead block (centered, `padding: 72px 28px 0`):
  - Sans meta: `Seattle · Saturday, May 16` — 10/0.28em uppercase.
  - Display headline two-line: `Two slow breaths,` then italic `then today.` in accent + serif-italic-300 — display 30/400, lh 1.05, marginTop 14.
- Disc (centered, flex:1, 280×280):
  - `border-radius: 50%`, `border: 1px solid var(--rule-strong)`.
  - Box-shadow: `inset 0 0 60px rgba(28,26,22,0.03), 0 8px 30px rgba(28,26,22,0.06)` (day); inset uses parchment color in night.
  - Progress ring: full-circle 280×280 SVG, rotated -90°, `circle r=139` with `strokeDasharray = 2πr`, `strokeDashoffset = 2πr * (1 - progress)`, stroke=`var(--accent)`, strokeWidth=1.5, strokeLinecap=round, opacity 0.85. Replaces the current strokeWidth=3 ring.
  - Center label, 3-line stack:
    1. Accent kicker `Press & hold` — sans 9.5/0.28em uppercase.
    2. Display `Hold to / begin` — display 26/400, lh 1.
    3. Italic hint `two seconds` — serif italic 12, sub color, marginTop 14.
- Footer almanac (centered horizontal row):
  - `48°F · sunset 8:40 · high tide 5:25 pm` (day) / `48°F · moonrise 10:12 · waning crescent` (night).
  - Sans 11, sub color; 2×2px dots between items.

**Implementation hook:** This is the `pressing=false` state of `BreathingExercise`. Replace the existing rounded button + ring. Pull the disc, masthead, and almanac into a new `<ReadyDisc>` subcomponent so the breathing-active branch can stay simple. The fill-gauge animation can be removed entirely — the perimeter ring alone is enough; it's cleaner.

---

## Screen 3 — Breathe

**Purpose:** Quiet pacing while the feed loads.

**Layout:**
- Sky wash 340px high (same gradient variable).
- Centered area:
  - **Circle** — 220×220, `border: 1px solid var(--rule)`, very faint background fill (`rgba(255,255,255,0.4)` day, `rgba(232,226,211,0.02)` night), `box-shadow: 0 8px 40px rgba(28,26,22,0.05), inset 0 0 60px rgba(28,26,22,0.02)`. Same `scale` animation as today (inhale → 1, hold → 1, exhale → 0.6) on a `transition: all 1s ease` (Framer Motion `animate={{ scale }}` is fine).
- Phase label (centered, `padding: 0 28px 80px`):
  - Display 30/400 `Breathe out…` with the `…` in accent color. Phase variants: `Breathe in…`, `Hold…`, `Breathe out…`.
  - Below: rule-flanked counter, sans 10/0.24em uppercase: `— Breath 1 of 2 —` (numbers in sub color, `of` in muted). Rule lines are 18×1px muted.
  - Italic hint serif 14/300 sub color, max-width 240, centered: `let the shoulders drop. let the day arrive.` (rotates by phase optionally — `inhale: "fill from the belly up"`, `hold: "just for a beat"`, `exhale: "let the shoulders drop. let the day arrive."`).

**Implementation hook:** Rewrite the breathing-active branch of `BreathingExercise`. Drop the indigo-specific border classes; styles read from variables.

---

## Screen 4 — Today (feed)

This is the heaviest change. The current page composes a sticky header, a glyph bar, a "Today in {city}" intro section, and three card sections (lead / pulse / field notes). The refresh keeps that structure but rebuilds every visual element.

### 4a. Masthead (replaces sticky header)

Not sticky. Sits at the top of the scroll, `padding: 52px 22px 28px`:

```
JustB                            VOL. 26 · NO. 136
📍 Seattle, WA · Saturday, May 16 · 2026
─────────────────────────────────────────────
 48°     5:39a    8:40p    🌒        5:25p
 partly  rise     sunset   waxing    tide ↑
─────────────────────────────────────────────
```

- Row 1: flex, `align-items: baseline`. Left: display 28 `JustB`. Right: sans 9.5/0.22em uppercase, sub color.
- Row 2 (`marginTop: 8`): tiny accent pin SVG (9×11) + city as inline-flex with `text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--text-muted)` — this is the **change-city** click target. Followed by a 2px dot and date. Sans 11 sub.
- Row 3 — **almanac strip** (replaces the old `Glyphs` component): `padding: 10px 0`, `border-top` + `border-bottom: 1px solid var(--rule)`, flex justify-between. Each cell is a 2-line column (`min-width: 36px`):
  - Top line: serif 13 primary, `font-feature-settings: "tnum"`.
  - Bottom line: sans 8.5/0.16em uppercase, muted.
  - Cells separated by a 22×1px rule.
- Sticky behavior: drop the `sticky top-0` from the header. The masthead is part of the editorial flow. If you want a tiny sticky chip with the refresh button, do it as a floating 36px circular button bottom-right of the viewport.

**`Glyphs` refactor.** Rewrite `components/glyphs.tsx` to emit the row-3 stripe instead of the centered icon row. Keep all the data plumbing — only the markup changes. Map: `weather.temp` → cell 1; `sunrise` → cell 2; `sunset` → cell 3; `moonPhase` → cell 4; `tide` → cell 5 (or `air`/`water` if there's no tide). Diagnostics chips can stay in dev/preview, just restyled as small underlined links below the strip.

### 4b. Section eyebrow

A reusable element: `flex; gap: 10px`. 24×1px accent line + sans 10/0.28em uppercase accent text. Used for "Today in Seattle" above the lead, and any future sections.

### 4c. Hero article (lead card variant)

Lives where the existing `variant === "hero"` does. Restyle, don't reposition.

- Photo: full-width, `height: 320px`. **No overlay gradient, no overlay text** — the photo stands alone.
- Below the photo, in a `marginTop: 16` content block:
  - **CatMark** — a 1px accent top rule with sans 9.5/0.18em uppercase accent kicker below it: `Sky · Almanac`. Min-width 56, padding-top 4. (Replaces the colored CategoryPill bubble on hero.)
  - H2: display 36/400, lh 1.02, with a serif-italic-300 substring for emphasized numbers. e.g. `Evening glow peaks at <em>7:56</em> tonight`.
  - **Standfirst** — serif italic 16/300 sub color, marginBottom 14.
  - **Body paragraph with drop cap**:
    - First letter wrapped in `<span class="drop-cap">`: display 44, lh 0.85, `float: left`, `padding-right: 8px`, `padding-top: 4px`, color accent.
    - Body in serif 15/1.6 primary.
  - **Fact chips strip** (`item.facts` source) — replace the existing pill chips. Render as inline meta: `7:56—8:40 PM | 45 min window | longest-day trend alert` — sans 10.5 muted, `letterSpacing: 0.06em`. Numbers in primary, labels in sub, pipes (`|`) in `--rule` color.

### 4d. Standard article (image + text body)

For items 2+ with images.

- Photo at `height: 200px`, full bleed within the column.
- CatMark kicker.
- H3 display 24/400, lh 1.1.
- Body serif 14/1.55 sub color.
- Tiny meta line: sans 11 muted, `font-style: italic` on the leading label (e.g. `Field note · `) followed by joined values.

### 4e. Pull-quote article (history / culture variant)

Replaces the colored-gradient panel.

- Full-bleed within the container (`margin: 32px -22px` to break out of the page padding).
- `padding: 36px 30px 32px`.
- Background `var(--bg-quote)` with `border-top` and `border-bottom: 1px solid var(--rule)`.
- Decorative open-quote glyph: `position: absolute; top: 10px; left: 22px;`, display 80, accent at `opacity: 0.35`.
- CatMark kicker (e.g. `History · 97 yrs ago`).
- Pull-quote text: display 26/400 italic, `letter-spacing: -0.005em`, lh 1.15. Marks already part of the visual element, so no `"` in the string.
- Attribution line: sans 11 sub, `letterSpacing: 0.06em`. e.g. `May 16, 1929 · 270 in attendance · Pacific NW theaters still carry the tradition.`

### 4f. Stat article (sky / sports / space)

When a `facts[0]` looks like a single big number/time, lay it out as a 2-col grid:

- Left: H3 display 28/400 lh 1.05.
- Right: display 40 accent number with a small sub-color unit (`9:30` + small `pm`). Below the number, sans 9.5/0.18em uppercase muted label (e.g. `impossible-to-miss`).
- Below the grid: serif 14/1.55 sub body paragraph.

### 4g. Local pulse — list view

Replaces the stacked cards section for `happenings / water / air / civic / community`.

- Section header row: display 18 `Local pulse` left, sans 9.5/0.22em uppercase muted `live signals` right.
- `<ul>` of items as 3-col grid `[54px 1fr auto]`, gap 12, baseline aligned, padding 14 0, divider rule between items:
  - Col 1: kicker (sans 9.5/0.18em uppercase accent).
  - Col 2: title (serif 15/1.3 primary).
  - Col 3: time/value (sans 11 sub, tnum).
- No body paragraphs — these are pulse signals, one line each.

### 4h. Field notes — typographic-only

The remaining feed items (`nature`, `earth-garden`, etc., without large hero imagery). Stack of articles:

- CatMark kicker.
- H3 display 22/400 lh 1.1.
- Body serif 14/1.55 sub color.
- No image, no chip strip. 28px gap between articles.

### 4i. Section dividers

`<hr>` replaced with a 1px `var(--rule)` line, full column width. Place between distinct articles, but NOT between every card (so the eye gets breathing room). Use them around the pull-quote breakout and between the lead and the second article.

### 4j. Footer mark

Bottom of the feed, centered, `marginTop: 56; paddingTop: 22; borderTop: 1px solid var(--rule)`:
- Display 13 faint `· JustB ·`
- Sans 9.5/0.28em uppercase faint `just be here. just be now.`

---

## Component map — what changes where

| Existing file | What to do |
|---|---|
| `app/globals.css` | Replace `:root` tokens (above); add `.theme-night`. Add `@keyframes caret`. |
| `app/layout.tsx` | Inject Google Fonts links. Apply `theme-night` class server-side or via the `useDarkMode` hook on mount. |
| `app/page.tsx` | Remove time-of-day gradient prop threading + `isNight` prop threading. Drop `sticky` header. Use new `Masthead` component. Replace inline section headers with new `<SectionHeader>` + eyebrow. Drop `bg-indigo-950` etc. — everything reads from variables. |
| `components/location-input.tsx` | Rewrite markup to bottom-border field + numbered suggestion list. Keep all fetch/state logic. |
| `components/breathing-exercise.tsx` | Replace markup for both branches. Drop indigo-specific classes. Use accent-color progress ring (strokeWidth 1.5, single thin line). |
| `components/glyphs.tsx` | Output the new almanac strip (5-cell horizontal row). Keep the data shape unchanged. |
| `components/feed-card.tsx` | Rewrite each variant per §§ 4c–4h. **All variants share the new typography system.** Remove the `gradients` map — no card uses the colored gradient backgrounds anymore. Remove `backdrop-blur-xl` glassmorphism — surfaces are paper, not glass. |
| `components/category-pill.tsx` | Add a new `<CatMark>` export (top-rule + accent uppercase kicker) and use it in place of `<CategoryPill>` in all card variants. Keep `CategoryPill` exported for any admin/debug screens that still want it. |
| `components/feed-skeleton.tsx` | Restyle to match — paper-tone shimmer, not glass. |
| `tailwind.config.ts` | Add font families and a `--accent` color utility. |

**Animation.** The Framer Motion entrance (`y: 20 → 0`, `delay: index * 0.08`) is great — keep it. Don't add more.

---

## Behavior preserved (don't change)

- Feed fetching / caching logic in `app/page.tsx`.
- `localStorage` city persistence and feed-version key.
- IntersectionObserver scroll-depth tracking (preview mode).
- FeedbackRow inside cards (preview mode). Restyle it: replace the colored hover backgrounds with simple accent-tinted underlines.
- Press-and-hold 2-second timing + breathing 2-breath flow.

---

## Files in this bundle
- `JustB Magazine.html` — runnable canvas with all 8 artboards (day + night), pannable side-by-side.
- `screens.jsx` — the React components for all four screens. Treat as design reference for measurements + styles; the actual production components stay in `app/` and `components/`.
- `design-canvas.jsx`, `ios-frame.jsx`, `tweaks-panel.jsx` — host scaffolds for the canvas, ignore for implementation.

Open `JustB Magazine.html` in a browser to inspect any of the screens at full size. Pan the canvas to compare day vs. night side-by-side.
