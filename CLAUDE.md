# JustB

**URL**: https://justb.zkhowes.fun (TBD)
**Purpose**: A daily local feed — "just be here, just be now." Shows 10 items about what's happening in your city today.
**Stack**: Next.js 14, TypeScript, Tailwind CSS, Anthropic SDK (Haiku), Pexels API
**Dev port**: 3004

## Architecture: Moments System

The feed is built from **moment providers** — modular data fetchers that each handle a category. Structured data is gathered from free APIs first, then passed to Claude (Haiku, no web search) to write compelling prose.

### Flow
1. `lib/moments/index.ts` — orchestrates all providers in parallel
2. `lib/generate-feed.ts` — passes structured data to Claude for prose generation
3. Results cached at 3 layers: in-memory (server), CDN (Vercel), localStorage (client)

### Moment Providers

| Provider | File | Categories | Data Source | Cost |
|----------|------|------------|-------------|------|
| **Sky** | `lib/moments/sky.ts` | sky-space | suncalc + Open-Meteo hourly cloud cover | Free |
| **Sports** | `lib/moments/sports.ts` | sports | ESPN unofficial API | Free, no key |
| **Events** | `lib/moments/events.ts` | events, culture | Ticketmaster + SeatGeek | Free (API keys needed) |
| **History** | `lib/moments/history.ts` | history | Wikimedia On This Day + Wikipedia city articles | Free |
| **Reddit** | `lib/moments/reddit.ts` | community | Arctic Shift (community Reddit archive) | Free, no key |
| **Community Events** | `lib/moments/community-events.ts` | happenings | City open data, city-profile event calendars (Seattle's Child, Do206) | Free, no key |
| **Water** | `lib/moments/water.ts` | water | USGS instantaneous values | Free, no key |
| **Air Quality** | `lib/moments/air-quality.ts` | air | OpenAQ | Free key |
| **Alerts** | `lib/moments/alerts.ts` | civic | National Weather Service alerts | Free, no key |
| **LLM-only** | (in prompt) | nature, local-scene, earth-garden, food/community | Claude Haiku training knowledge | ~2-3K tokens |

### Adding a New Moment Provider

1. Create `lib/moments/<name>.ts`
2. Export `async function fetch<Name>Moments(loc: LocationContext): Promise<MomentContext[]>`
3. Add to the `Promise.allSettled` array in `lib/moments/index.ts`
4. Update `generate-feed.ts` to handle the new category if needed

### Improving an Existing Provider

Each provider can be improved independently:
- **Sky**: Could add visible planet data via an astronomy API; could render SVG sky charts
- **Sports**: Could add college sports, standings, injury reports
- **Events**: Could add Bandsintown for indie music coverage. Eventbrite search API was removed in 2019 — not viable. Meetup API requires paid Pro account.
- **History**: Now scrapes Wikipedia city articles for date-specific local facts. **Consider switching to Sonnet for this category** — Haiku hallucinates dates when no API data matches. Sonnet would be more reliable for knowledge-based history items but costs ~25x more per call.
- **Nature**: Currently LLM-only — could integrate eBird API for real bird sighting data
- **Culture**: Ticketmaster covers ticketed events; no free API exists for museum exhibitions
- **Reddit**: Data comes from Arctic Shift (`arctic-shift.photon-reddit.com`), a community-run Reddit archive. Reddit's own API blocks Vercel datacenter IPs without OAuth, and the commercial Data API request has been stuck in review since 2026-04-01. Arctic Shift has ~15-60min lag and only supports sort by `created_utc`, so the provider fetches the last 48h and re-ranks client-side by engagement/recency. Maps city names to subreddits via `CITY_SUBREDDITS`.
- **Community Events**: Fetches from Socrata SODA open data portals plus optional per-city enrichment profiles in `lib/city-enrichment.ts`. Seattle currently includes Seattle's Child calendar and Do206 date pages. Add new cities by adding a `CityEnrichmentProfile` with local terms, event calendars, event feeds, and news feeds; add Socrata endpoints to `CITY_EVENT_SOURCES` where available.

### Sky Provider Details

The sky provider now includes:
- **Golden hour windows** (morning + evening) via SunCalc
- **Sunset quality** — cross-references hourly cloud cover from Open-Meteo with sunset time
- **Daylight milestones** — duration changes, 12-hour crossing, solstice turn detection
- Sunrise/sunset times are NOT included (shown in glyphs UI separately)

## Environment Variables

| Variable | Required | Source |
|----------|----------|--------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic console |
| `PEXELS_API_KEY` | Yes | Pexels developer |
| `OPENAQ_API_KEY` | No (enables air quality) | OpenAQ |
| `TICKETMASTER_API_KEY` | No (degrades gracefully) | developer.ticketmaster.com |
| `SEATGEEK_CLIENT_ID` | No (degrades gracefully) | seatgeek.com/build |
| `DATABASE_URL` | No (preview features) | Neon console |
| `ADMIN_EMAIL` | Yes (for /admin) | Your Google email |
| `NEXTAUTH_SECRET` | Yes (for /admin) | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes (for /admin) | App URL |
| `GOOGLE_CLIENT_ID` | Yes (for /admin) | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Yes (for /admin) | Google Cloud Console |
| `NEXT_PUBLIC_PREVIEW_MODE` | No (legacy, replaced by /admin) | Manual |

## Kanban

### To Investigate
- **Cross-category blending**: Cards that bridge two categories (e.g. earth-garden + local-scene for farmers markets). Consider `secondaryCategory` field or prompt guidance for intentional crossovers.
- **Regional events / "Zoomed Out" mode**: Tracked in Linear as [ZKH-33 — JustB Zoomed Out](https://linear.app/zkhowes/issue/ZKH-33/justb-zoomed-out-investigate-radius-expansion-for-small-towns). Investigates radius expansion (1–2hr drive) for small towns where the local feed is too sparse; tensions with the "be here, be now" premise.
- **Sky charts**: Render a simple SVG/canvas polar sky chart from SunCalc + constellation dataset instead of Pexels starfield photos. Would be a signature feature.
- **eBird API**: Real bird sighting data for the nature category instead of LLM-only.
- **EverOut source path**: EverOut is editorially strong, but server fetches currently hit AWS WAF (`403` / challenge). Revisit only if a public feed/API or permitted integration path becomes available.
- **City enrichment expansion**: Add city profiles beyond Seattle for local event/news calendars once stable source URLs are identified.

### Done (2026-05-29)
- Happenings promoted to full cards — community events no longer collapse into a single Local pulse row. Each surviving event (eventPriority ≥ 2, cap 6) becomes its own MomentContext in `lib/moments/community-events.ts`, and the LLM emits one happening card per event with name + when + venue + 2–3 sentence blurb. New `happening` variant in `FeedCard`, new dedicated "Happenings — this week" section between the pull-quote and Local pulse. Seattle's Child + Do206 + RSS parsers now extract event URLs into a `link?` field instead of stuffing them into `detail`. `MULTI_CARD_CATEGORIES` set in feed-prompt + `balanceFeedCategoryMix` so multi-card categories survive the once-per-category dedupe; `MAX_FEED_ITEMS` bumped 12 → 18.
- Daylight demoted to Local pulse — sky provider splits its daylight-delta line into its own `daylight` MomentContext. New `Category` + label + pill config; the page's pulse filter swaps `happenings` for `daylight` and widens to 4 slots. Sky card keeps golden hour + sunset quality only.
- Cache invalidation — browser `FEED_CACHE_VERSION` 8 → 9, server `SERVER_FEED_CACHE_VERSION` 8 → 9; debug-trace `VALID_CATEGORIES` synced for /admin.
- Prompt-build extraction — split `buildFeedPrompt` / `buildLlmOnlyInstructions` / `formatMomentsForPrompt` / `balanceFeedCategoryMix` / `filterRepeatedVarietySubjectsWithMinimum` out of `generate-feed.ts` into a new `lib/feed-prompt.ts` module so `debug-trace.ts` consumes the same code path instead of duplicating the prompt string. /admin debug trace and `/api/feed` now build prompts via the shared module.
- recentTopics URL params accept the repeated-key shape (`?recentTopics=a&recentTopics=b`) the client was already producing, in addition to the comma-joined fallback.
- Vuln patch (safe) — `flatted`, `picomatch`, `brace-expansion` advisories cleared via `npm audit fix`. Remaining 4 high CVEs (Next.js 14, next-auth 4, eslint-config-next, glob) require `--force` with breaking changes (Next 16 + next-auth → 3.x downgrade) and are deferred to a dedicated upgrade deploy.

### Done (2026-05-16)
- Magazine refresh — paper/ink editorial redesign of all four screens (Locate, Arrive, Breathe, Today) plus parallel night mode. DM Serif Display + Source Serif 4 + Inter; sienna accent on cream parchment by day, deep ink-blue by night. `useDarkMode` hook flips `theme-night` on `<html>` so CSS variables drive both modes — no more `isNight` prop threading or `gradient` string passing. New `Masthead` (non-sticky wordmark + city pin + 5-cell almanac strip), `CatMark` (top-rule + accent kicker, replaces colored CategoryPill on cards), hero card with drop-cap lede + fact strip, full-bleed pull-quote variant, 2-col stat card, Local pulse list rows, typographic Field notes. Floating refresh button replaces sticky header. Glassmorphism + colored gradient panels removed.
- Local almanac feed expansion — added `happenings`, `water`, `air`, and `civic` categories; wired USGS water gauges, NWS alerts, optional OpenAQ air quality, and glyph support for water/air/alerts.
- Seattle source framework — added `lib/city-enrichment.ts` for per-city local terms, news feeds, event feeds, and HTML calendar sources. Seattle now discovers happenings from Seattle's Child calendar and Do206 date pages rather than hardcoded individual events.
- Editorial feed rhythm — added "Today in [City]", lead card, Local pulse, and Field notes sections; bumped browser/server cache versions to invalidate stale feed shapes.
- Claude-missing fallback — if `ANTHROPIC_API_KEY` is absent, `/api/feed` now returns a source-grounded fallback feed instead of a 500. Fallback skips prompt-only moments and prioritizes local news over Reddit chatter.
- Local-news guardrails — local news now requires city-profile local terms and rejects obvious national/world stories before prompt/fallback generation.

### Done (2026-05-14)
- Reddit engagement-signal rewrite — Arctic Shift snapshots posts at creation and never updates `score`/`num_comments`, so every post forever shows score=1, num_comments=0 and the old filter rejected everything. Provider now queries the comments endpoint (which DOES accumulate), paginates 5×100 comments per subreddit, groups by `link_id`, fetches the top 25 parent posts by ID, and ranks by recent-comment momentum (time since last comment, not time since post creation).
- Debug screen completeness — added missing provider rows for `local-news`, `community-events`, and `tides`. These have been running in the real feed since 2026-04-18 but never surfaced in /admin → debug. Tide is glyph-only (doesn't feed the LLM prompt) but now appears with its NOAA result for visibility. Single `fetchTides` call reused between trace + glyph computation.

### Done (2026-05-07)
- Tides in glyph bar — NOAA CO-OPS predictions, free, no API key. Picks nearest of 15 major US coastal stations by great-circle distance; skips with a "note" beyond 150km inland.
- Glyph error visibility — per-source `errors` and `notes` on `GlyphData`; in dev/preview the glyph bar swaps in amber `⚠ tide / ⚠ weather / ⚠ astro` chips with the underlying error in tooltip + a small diagnostic line under the bar.
- Card variants + fact chips — new feed renderer with hero/quote/stat/minimal layouts by category and index, plus 1–3 short fact chips per card sourced from a new `facts` field that Haiku now emits.
- Admin → Display tab — three independent localStorage-backed toggles (newFeed, variants, chips) so the new render path can be A/B'd against the original. Defaults to all on.

### Done (2026-04-21)
- Reddit provider migrated to Arctic Shift — Reddit's own API blocks Vercel IPs, OAuth script-app form returns 500, and the commercial Data API ticket has been stuck in review since 2026-04-01. Arctic Shift (community archive) gives ~15-60min-lag data with no auth; provider fetches 48h window and re-ranks client-side by engagement/recency.

### Done (2026-04-18)
- Community events provider — Socrata SODA open data for NYC, Chicago, LA, Seattle (farmers markets, street fairs, festivals)
- Reddit unauthenticated path fix — proper headers, rate-limit handling, content-type validation
- Local news provider wired into orchestrator (was previously untracked)
- All 3 community sources (Reddit, local news, city open data) now run in parallel

### Done (2026-03-31)
- Admin debug/monitoring tab — full feed trace with per-provider params, responses, timing, LLM prompt/response, and per-card user feedback
- Fix dark mode card text contrast (white text on night glassmorphism cards)
- Nature-based backgrounds tied to location + season (Pexels API)
- Glassmorphism cards with backdrop-blur and transparency
- Ready button 2s press-and-hold with SVG ring + fill gauge animation
- Breathing reduced to 2 breaths with 1s hold
- Sharp background (no blur) with frosted glass card overlay
- Split sky-space into separate sky and space categories

### Done (2026-03-28)
- Reddit provider for local community signal
- Enhanced sky provider (golden hour, sunset quality, daylight milestones)
- Wikipedia city history scraping for local on-this-day facts
- History prompt guardrails to prevent date hallucination
- Image height increase (h-32 → h-48)
- Focused imageQuery (single most visual subject)
- Category validation/normalization (ensures all cards have pills)

## Key Design Decisions

- **Haiku over Sonnet**: Structured content generation doesn't need Sonnet's reasoning. Haiku is ~25x cheaper.
- **No web search**: APIs provide better, cheaper, more reliable data than LLM web search for events/sports.
- **LLM for prose only**: Claude writes the copy; APIs provide the facts. Best of both worlds.
- **Graceful degradation**: If Ticketmaster/SeatGeek keys aren't set, those categories fall back to LLM knowledge.
- **3-layer caching**: Same city+date never hits Claude twice in the same day.
