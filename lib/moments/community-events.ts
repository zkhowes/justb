import { MomentContext, LocationContext } from "./types";

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

export async function fetchCommunityEventMoments(
  loc: LocationContext
): Promise<MomentContext[]> {
  const source = getCitySource(loc.city);
  if (!source) return [];

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
    return formatEvents(items, source, loc);
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
    return formatEvents(items, source, loc);
  } catch {
    return [];
  }
}

function formatEvents(
  items: Record<string, unknown>[],
  source: CityEventSource,
  loc: LocationContext
): MomentContext[] {
  const startDate = new Date(loc.dateISO);
  const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  const events = items
    .map((item) => source.parse(item))
    .filter((e): e is CommunityEvent => {
      if (!e) return false;
      // Filter to this week if we have a date
      if (e.date) {
        try {
          const eventDate = new Date(e.date);
          return eventDate >= startDate && eventDate <= endDate;
        } catch {
          return true; // Include if date parsing fails
        }
      }
      return true;
    });

  if (events.length === 0) return [];

  // Deduplicate by name (case-insensitive)
  const seen = new Set<string>();
  const unique = events.filter((e) => {
    const key = e.name.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const lines = unique.slice(0, 10).map((e) => {
    const parts = [e.name];
    if (e.type && e.type !== "Event") parts.push(`(${e.type})`);
    if (e.location) parts.push(`— ${e.location}`);
    if (e.date) {
      try {
        const d = new Date(e.date);
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
      category: "community",
      source: "city-open-data",
      data: `Community events happening in ${loc.city} this week:\n${lines.join("\n")}\n\nHighlight the 2-3 most interesting community events — prioritize farmers markets, street fairs, festivals, free workshops, and block parties over generic permits. Include day/location if available. Write as a local friend sharing what's worth checking out this week.`,
    },
  ];
}
