import { MomentContext, LocationContext } from "./types";
import {
  getEventCalendars,
  getEventFeeds,
  getLocalTerms,
  HtmlCalendarSourceConfig,
  RssSourceConfig,
} from "../city-enrichment";

interface CityEventSource {
  url: string;
  dateField: string; // Socrata column name for date filtering/ordering
  // Map source-specific fields to our standard shape
  parse: (item: Record<string, unknown>) => CommunityEvent | null;
}

interface CommunityEvent {
  name: string;
  type: string;
  location: string;
  date: string; // ISO date or human-readable
  detail?: string;
}

interface EventRssItem {
  title: string;
  description: string;
  pubDate: string;
  link: string;
  startDate?: string;
  endDate?: string;
  location?: string;
}

/**
 * City open data (Socrata SODA API) endpoints for community events.
 * These are free, no API key required, and return JSON.
 */
const CITY_EVENT_SOURCES: Record<string, CityEventSource> = {
  "new york": {
    url: "https://data.cityofnewyork.us/resource/tvpp-9vvx.json",
    dateField: "start_date_time",
    parse: (item) => {
      const name = item.event_name as string | undefined;
      if (!name) return null;
      return {
        name,
        type: (item.event_type as string) ?? "Event",
        location:
          (item.event_borough as string) ??
          (item.event_location as string) ??
          "",
        date: (item.start_date_time as string) ?? "",
      };
    },
  },
  chicago: {
    url: "https://data.cityofchicago.org/resource/xgse-8eg7.json",
    dateField: "date",
    parse: (item) => {
      const name = item.event_details as string | undefined;
      if (!name) return null;
      return {
        name,
        type: (item.event_type as string) ?? "Event",
        location: (item.venue as string) ?? "",
        date: (item.date as string) ?? "",
      };
    },
  },
  "los angeles": {
    url: "https://data.lacity.org/resource/8spw-3fhx.json",
    dateField: "event_start_date",
    parse: (item) => {
      const name =
        (item.event_name as string) ?? (item.work_desc as string) ?? null;
      if (!name) return null;
      return {
        name,
        type:
          (item.per_sub_type as string) ??
          (item.per_type as string) ??
          "Event",
        location: (item.location as string) ?? "",
        date: (item.event_start_date as string) ?? "",
      };
    },
  },
  seattle: {
    url: "https://data.seattle.gov/resource/dm95-f8w5.json",
    dateField: "event_start_date",
    parse: (item) => {
      const name = item.name_of_event as string | undefined;
      if (!name) return null;
      // Skip denied/cancelled permits
      const status = ((item.permit_status as string) ?? "").toLowerCase();
      if (status === "denied" || status === "cancelled") return null;
      return {
        name,
        type: (item.permit_type as string) ?? "Event",
        location:
          (item.event_location_neighborhood as string) ??
          (item.organization as string) ??
          "",
        date: (item.event_start_date as string) ?? "",
      };
    },
  },
};

function getCitySource(city: string): CityEventSource | null {
  const key = city.split(",")[0].trim().toLowerCase();
  if (CITY_EVENT_SOURCES[key]) return CITY_EVENT_SOURCES[key];
  for (const [name, source] of Object.entries(CITY_EVENT_SOURCES)) {
    if (key.includes(name) || name.includes(key)) return source;
  }
  return null;
}

function textBetween(block: string, tag: string): string {
  return block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"))?.[1] ??
    block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ??
    "";
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;|&#8212;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEventRssItems(xml: string): EventRssItem[] {
  const items: EventRssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = cleanText(textBetween(block, "title"));
    if (!title) continue;
    const description = cleanText(textBetween(block, "description")).slice(0, 260);
    items.push({
      title,
      description,
      pubDate: cleanText(textBetween(block, "pubDate")),
      link: cleanText(textBetween(block, "link")),
      startDate:
        cleanText(textBetween(block, "ev:startdate")) ||
        cleanText(textBetween(block, "event:startdate")) ||
        cleanText(textBetween(block, "startdate")),
      endDate:
        cleanText(textBetween(block, "ev:enddate")) ||
        cleanText(textBetween(block, "event:enddate")) ||
        cleanText(textBetween(block, "enddate")),
      location:
        cleanText(textBetween(block, "ev:location")) ||
        cleanText(textBetween(block, "event:location")) ||
        cleanText(textBetween(block, "location")),
    });
  }
  return items;
}

function eventOverlapsWindow(item: EventRssItem, loc: LocationContext): boolean {
  const start = new Date(`${loc.dateISO}T00:00:00`);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dateCandidates = [item.startDate, item.endDate, item.pubDate].filter(Boolean) as string[];

  if (dateCandidates.length === 0) {
    const text = `${item.title} ${item.description}`;
    const year = start.getFullYear();
    const month = start.toLocaleDateString("en-US", { month: "long" });
    const day = start.getDate();
    return text.includes(String(year)) && text.includes(month) && text.includes(String(day));
  }

  return dateCandidates.some((candidate) => {
    const parsed = new Date(candidate);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed >= start && parsed <= end;
  });
}

function isLocalEvent(item: EventRssItem, loc: LocationContext): boolean {
  const text = `${item.title} ${item.description} ${item.location ?? ""}`.toLowerCase();
  return getLocalTerms(loc.city).some((term) => text.includes(term));
}

function inferEventType(item: EventRssItem): string {
  const text = `${item.title} ${item.description}`.toLowerCase();
  if (/\bfair|festival|market|street fair|street party\b/.test(text)) return "Festival";
  if (/\bmusic|concert|performance|stage\b/.test(text)) return "Performance";
  if (/\bworkshop|class|story time|storytime\b/.test(text)) return "Workshop";
  if (/\bfood|truck|restaurant|tasting\b/.test(text)) return "Food";
  return "Event";
}

function rssItemToEvent(item: EventRssItem, source: RssSourceConfig): CommunityEvent {
  return {
    name: item.title,
    type: inferEventType(item),
    location: item.location ?? "",
    date: item.startDate || item.pubDate || "",
    detail: item.description ? `${item.description} Source: ${source.name}.` : `Source: ${source.name}.`,
  };
}

async function fetchEventFeedEvents(loc: LocationContext): Promise<CommunityEvent[]> {
  const feeds = getEventFeeds(loc.city);
  if (feeds.length === 0) return [];

  const results = await Promise.allSettled(
    feeds.slice(0, 4).map(async (feed) => {
      const res = await fetch(feed.url, {
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml",
          "User-Agent": "JustB/1.0 (local event feed aggregator)",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.warn(`[CommunityEvents] ${feed.name} returned ${res.status}`);
        return [];
      }
      const xml = await res.text();
      return parseEventRssItems(xml)
        .filter((item) => eventOverlapsWindow(item, loc))
        .filter((item) => isLocalEvent(item, loc))
        .slice(0, 12)
        .map((item) => rssItemToEvent(item, feed));
    })
  );

  const events: CommunityEvent[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") events.push(...result.value);
  }
  return events;
}

function parseCalendarEvents(html: string, source: HtmlCalendarSourceConfig): CommunityEvent[] {
  if (source.parser === "do206") return parseDo206Events(html, source);
  return parseSeattleChildEvents(html, source);
}

function parseSeattleChildEvents(html: string, source: HtmlCalendarSourceConfig): CommunityEvent[] {
  const events: CommunityEvent[] = [];
  const blocks = html.match(/<div class="wp-event-title">[\s\S]*?(?=<div class="wp-event-title">|<nav|<\/main|$)/g) ?? [];

  for (const block of blocks) {
    const linkMatch = block.match(/<a\s+href="([^"]+)">([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    const link = cleanText(linkMatch[1]);
    const title = cleanText(linkMatch[2]);
    if (!title) continue;

    const dateText = cleanText(block.match(/<p>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    const location = cleanText(block.match(/<div class="wp-event-location">([\s\S]*?)<\/div>/i)?.[1] ?? "");
    events.push({
      name: title,
      type: inferEventType({ title, description: "", pubDate: "", link }),
      location,
      date: calendarDateToISO(dateText),
      detail: `Date/time: ${dateText}${link ? `. Source: ${source.name}. ${link}` : ` Source: ${source.name}.`}`,
    });
  }

  return events;
}

function parseDo206Events(html: string, source: HtmlCalendarSourceConfig): CommunityEvent[] {
  const events: CommunityEvent[] = [];
  const blocks = html.match(/<div class="ds-listing event-card[\s\S]*?(?=<div class="ds-listing event-card|<div class="ds-ad|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/g) ?? [];

  for (const block of blocks) {
    const title = cleanText(block.match(/<span class="ds-listing-event-title-text"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    if (!title) continue;

    const permalink = cleanText(block.match(/data-permalink="([^"]+)"/i)?.[1] ?? "");
    const startDate = cleanText(block.match(/itemprop="startDate"[^>]*datetime="([^"]+)"/i)?.[1] ?? "");
    const endDate = cleanText(block.match(/itemprop="endDate"[^>]*datetime="([^"]+)"/i)?.[1] ?? "");
    const venue = cleanText(block.match(/class="ds-venue-name"[\s\S]*?<span itemprop="name">([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const categoryClass = cleanText(block.match(/ds-event-category-([a-z0-9-]+)/i)?.[1] ?? "");
    const attendeeCount = cleanText(block.match(/ds-listing-attendee-count">[\s\S]*?(\d+)\s*<\/div>/i)?.[1] ?? "");
    const soldOut = /ds-listing-soldout/i.test(block);
    const free = /\bfree\b/i.test(block);

    const bits = [
      venue ? `Venue: ${venue}` : "",
      startDate ? `Starts: ${formatDo206Date(startDate)}` : "",
      attendeeCount ? `${attendeeCount} saves` : "",
      soldOut ? "sold out" : "",
      free ? "free" : "",
      `Source: ${source.name}.`,
      permalink ? `https://do206.com${permalink}` : "",
    ].filter(Boolean);

    events.push({
      name: title,
      type: do206Type(categoryClass),
      location: venue,
      date: startDate,
      detail: bits.join(" "),
      ...(endDate ? { endDate } : {}),
    } as CommunityEvent);
  }

  return events;
}

function formatDo206Date(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function do206Type(category: string): string {
  if (category.includes("concerts") || category.includes("music")) return "Music";
  if (category.includes("food")) return "Food";
  if (category.includes("performing")) return "Performance";
  if (category.includes("sports")) return "Sports";
  if (category.includes("comedy")) return "Comedy";
  if (category.includes("culture")) return "Culture";
  return "Event";
}

function calendarDateToISO(dateText: string): string {
  const match = dateText.match(/\b([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (!match) return dateText;
  const parsed = new Date(`${match[1]} ${match[2]}, ${match[3]} 12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateText;
  return parsed.toISOString().slice(0, 10);
}

async function fetchCalendarEvents(loc: LocationContext): Promise<CommunityEvent[]> {
  const calendars = getEventCalendars(loc.city);
  if (calendars.length === 0) return [];

  const results = await Promise.allSettled(
    calendars.slice(0, 3).map(async (calendar) => {
      const url = calendar.urlTemplate.replace("{dateISO}", encodeURIComponent(loc.dateISO));
      const res = await fetch(url, {
        headers: {
          Accept: "text/html",
          "User-Agent": "JustB/1.0 (local event calendar aggregator)",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.warn(`[CommunityEvents] ${calendar.name} returned ${res.status}`);
        return [];
      }
      const html = await res.text();
      return parseCalendarEvents(html, calendar)
        .filter((event) => isCommunityEventLocal(event, loc))
        .slice(0, 12);
    })
  );

  const events: CommunityEvent[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") events.push(...result.value);
  }
  return events;
}

function isCommunityEventLocal(event: CommunityEvent, loc: LocationContext): boolean {
  const text = `${event.name} ${event.location} ${event.detail ?? ""}`.toLowerCase();
  return getLocalTerms(loc.city).some((term) => text.includes(term));
}

export async function fetchCommunityEventMoments(
  loc: LocationContext
): Promise<MomentContext[]> {
  const source = getCitySource(loc.city);
  const [feedEvents, calendarEvents] = await Promise.all([
    fetchEventFeedEvents(loc),
    fetchCalendarEvents(loc),
  ]);
  const discoveredEvents = [...feedEvents, ...calendarEvents];
  if (!source) return formatEvents(discoveredEvents, loc);

  try {
    // Query for events happening this week (today through +7 days)
    const startDate = loc.dateISO;
    const endDate = new Date(
      new Date(loc.dateISO).getTime() + 7 * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .slice(0, 10);

    // Socrata SoQL query — filter by date range using city-specific date field
    const url = new URL(source.url);
    url.searchParams.set("$limit", "30");
    url.searchParams.set("$order", `${source.dateField} ASC`);
    url.searchParams.set(
      "$where",
      `${source.dateField} >= '${startDate}' AND ${source.dateField} <= '${endDate}T23:59:59'`
    );

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "JustB:1.0.0 (community events aggregator)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      // If the date filter fails (different field names), try without filtering
      // and filter client-side
      console.warn(
        `[CommunityEvents] ${loc.city} query failed (${res.status}), trying unfiltered`
      );
      return await fetchUnfiltered(source, loc);
    }

    const items: Record<string, unknown>[] = await res.json();
    const sourceEvents = items
      .map((item) => source.parse(item))
      .filter((event): event is CommunityEvent => event !== null);
    return formatEvents([...discoveredEvents, ...sourceEvents], loc);
  } catch (err) {
    console.error(
      `[CommunityEvents] ${loc.city} error:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

/** Fallback: fetch without date filter and filter client-side */
async function fetchUnfiltered(
  source: CityEventSource,
  loc: LocationContext
): Promise<MomentContext[]> {
  try {
    const url = new URL(source.url);
    url.searchParams.set("$limit", "50");
    url.searchParams.set("$order", `${source.dateField} DESC`);

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "JustB:1.0.0 (community events aggregator)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`[CommunityEvents] ${loc.city} unfiltered also failed (${res.status})`);
      return [];
    }

    const items: Record<string, unknown>[] = await res.json();
    const sourceEvents = items
      .map((item) => source.parse(item))
      .filter((event): event is CommunityEvent => event !== null);
    return formatEvents(sourceEvents, loc);
  } catch {
    return [];
  }
}

function formatEvents(
  events: CommunityEvent[],
  loc: LocationContext
): MomentContext[] {
  const startDate = new Date(`${loc.dateISO}T00:00:00`);
  const endDate = new Date(`${loc.dateISO}T23:59:59`);
  endDate.setDate(endDate.getDate() + 7);

  const filteredEvents = events
    .filter((e): e is CommunityEvent => {
      if (!e) return false;
      // Filter to this week if we have a date
      if (e.date) {
        try {
          const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(e.date)
            ? new Date(`${e.date}T12:00:00`)
            : new Date(e.date);
          return eventDate >= startDate && eventDate <= endDate;
        } catch {
          return true; // Include if date parsing fails
        }
      }
      return true;
    });

  if (filteredEvents.length === 0) return [];

  // Deduplicate by name (case-insensitive)
  const seen = new Set<string>();
  const unique = filteredEvents
    .filter((e) => {
      const key = e.name.toLowerCase().slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => eventPriority(b) - eventPriority(a));

  const lines = unique.slice(0, 10).map((e) => {
    const parts = [e.name];
    if (e.type && e.type !== "Event") parts.push(`(${e.type})`);
    if (e.location) parts.push(`— ${e.location}`);
    if (e.detail) parts.push(`— ${e.detail}`);
    if (e.date) {
      try {
        const d = /^\d{4}-\d{2}-\d{2}$/.test(e.date)
          ? new Date(`${e.date}T12:00:00`)
          : new Date(e.date);
        parts.push(
          `on ${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`
        );
      } catch {
        // skip date formatting
      }
    }
    return parts.join(" ");
  });

  console.log(
    `[CommunityEvents] ${loc.city}: ${events.length} events this week, showing ${lines.length}`
  );

  return [
    {
      category: "happenings",
      source: "city-event-sources",
      data: `Community events happening in ${loc.city} this week:\n${lines.join("\n")}\n\nHighlight the 2-3 most interesting community events — prioritize farmers markets, street fairs, festivals, free workshops, and block parties over generic permits. Include day/location if available. Write as a local friend sharing what's worth checking out this week.`,
    },
  ];
}

function eventPriority(event: CommunityEvent): number {
  const text = `${event.name} ${event.type} ${event.detail ?? ""}`.toLowerCase();
  let score = 0;
  if (/\bstreet fair|festival|fair\b/.test(text)) score += 6;
  if (/\bmarket|farmers market|food truck|vendors?\b/.test(text)) score += 4;
  if (/\bfree\b/.test(text)) score += 2;
  if (/\bworkshop|class|story time|storytime\b/.test(text)) score -= 1;
  return score;
}
