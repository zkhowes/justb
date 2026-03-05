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
| **Sky** | `lib/moments/sky.ts` | sky-space | suncalc (local computation) | Free |
| **Sports** | `lib/moments/sports.ts` | sports | ESPN unofficial API | Free, no key |
| **Events** | `lib/moments/events.ts` | events, culture | Ticketmaster + SeatGeek | Free (API keys needed) |
| **History** | `lib/moments/history.ts` | history | Wikimedia On This Day | Free |
| **LLM-only** | (in prompt) | nature, local-scene, earth-garden, food/community | Claude Haiku training knowledge | ~2-3K tokens |

### Adding a New Moment Provider

1. Create `lib/moments/<name>.ts`
2. Export `async function fetch<Name>Moments(loc: LocationContext): Promise<MomentContext[]>`
3. Add to the `Promise.allSettled` array in `lib/moments/index.ts`
4. Update `generate-feed.ts` to handle the new category if needed

### Improving an Existing Provider

Each provider can be improved independently:
- **Sky**: Could add visible planet data via an astronomy API
- **Sports**: Could add college sports, standings, injury reports
- **Events**: Could add Bandsintown for indie music coverage
- **History**: Could filter for events geographically relevant to the user's city
- **Nature**: Currently LLM-only — could integrate eBird API for real bird sighting data
- **Culture**: Ticketmaster covers ticketed events; no free API exists for museum exhibitions

## Environment Variables

| Variable | Required | Source |
|----------|----------|--------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic console |
| `PEXELS_API_KEY` | Yes | Pexels developer |
| `TICKETMASTER_API_KEY` | No (degrades gracefully) | developer.ticketmaster.com |
| `SEATGEEK_CLIENT_ID` | No (degrades gracefully) | seatgeek.com/build |

## Key Design Decisions

- **Haiku over Sonnet**: Structured content generation doesn't need Sonnet's reasoning. Haiku is ~25x cheaper.
- **No web search**: APIs provide better, cheaper, more reliable data than LLM web search for events/sports.
- **LLM for prose only**: Claude writes the copy; APIs provide the facts. Best of both worlds.
- **Graceful degradation**: If Ticketmaster/SeatGeek keys aren't set, those categories fall back to LLM knowledge.
- **3-layer caching**: Same city+date never hits Claude twice in the same day.
