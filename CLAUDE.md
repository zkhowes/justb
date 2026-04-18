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
| **Reddit** | `lib/moments/reddit.ts` | community | Reddit JSON/OAuth API (r/{CityName}) | Free (OAuth optional) |
| **Community Events** | `lib/moments/community-events.ts` | community | City open data (Socrata SODA API) | Free, no key |
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
- **Reddit**: Maps city names to subreddits via `CITY_SUBREDDITS`. Add new city mappings there as needed. Unauthenticated path works but limits to 1 sub + 15 posts to avoid rate limits. OAuth credentials (`REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`) unlock 2 subs + 25 posts.
- **Community Events**: Fetches from Socrata SODA open data portals. Currently supports NYC, Chicago, LA, Seattle. Add new cities by adding entries to `CITY_EVENT_SOURCES` with the Socrata endpoint URL, date field name, and a parser function.

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
| `TICKETMASTER_API_KEY` | No (degrades gracefully) | developer.ticketmaster.com |
| `SEATGEEK_CLIENT_ID` | No (degrades gracefully) | seatgeek.com/build |
| `REDDIT_CLIENT_ID` | No (degrades to public JSON) | reddit.com/prefs/apps |
| `REDDIT_CLIENT_SECRET` | No (degrades to public JSON) | reddit.com/prefs/apps |
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
- **Regional events**: Surface notable events within ~2hr drive of the city (e.g. Skagit Valley Tulip Festival for Seattle users). Needs radius expansion or curated regional event mapping.
- **Sky charts**: Render a simple SVG/canvas polar sky chart from SunCalc + constellation dataset instead of Pexels starfield photos. Would be a signature feature.
- **eBird API**: Real bird sighting data for the nature category instead of LLM-only.

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
