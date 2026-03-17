import { MomentContext, LocationContext } from "./types";

const TM_API_KEY = process.env.TICKETMASTER_API_KEY;
const SEATGEEK_CLIENT_ID = process.env.SEATGEEK_CLIENT_ID;

// --- Ticketmaster Discovery API ---

interface TMEvent {
  name: string;
  dates: { start: { localTime?: string; localDate: string } };
  _embedded?: {
    venues?: Array<{ name: string; city?: { name: string } }>;
  };
  classifications?: Array<{
    segment?: { name: string };
    genre?: { name: string };
  }>;
}

interface TMResponse {
  _embedded?: { events?: TMEvent[] };
}

async function fetchTicketmaster(loc: LocationContext): Promise<TMEvent[]> {
  if (!TM_API_KEY) return [];
  try {
    const startDate = `${loc.dateISO}T00:00:00Z`;
    const endDate = `${loc.dateISO}T23:59:59Z`;
    const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
    url.searchParams.set("apikey", TM_API_KEY);
    url.searchParams.set("latlong", `${loc.lat},${loc.lng}`);
    url.searchParams.set("radius", "30");
    url.searchParams.set("unit", "miles");
    url.searchParams.set("startDateTime", startDate);
    url.searchParams.set("endDateTime", endDate);
    url.searchParams.set("size", "20");
    url.searchParams.set("sort", "relevance,asc");

    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data: TMResponse = await res.json();
    return data._embedded?.events ?? [];
  } catch {
    return [];
  }
}

function formatTMEvent(e: TMEvent): { text: string; type: string } {
  const venue = e._embedded?.venues?.[0]?.name ?? "";
  const time = e.dates.start.localTime
    ? new Date(`${e.dates.start.localDate}T${e.dates.start.localTime}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  const segment = e.classifications?.[0]?.segment?.name ?? "Event";
  const genre = e.classifications?.[0]?.genre?.name ?? "";
  let text = e.name;
  if (venue) text += ` at ${venue}`;
  if (time) text += `, ${time}`;
  if (genre && genre !== "Undefined") text += ` (${genre})`;
  return { text, type: segment };
}

// --- SeatGeek API ---

interface SGEvent {
  title: string;
  venue: { name: string; city: string };
  datetime_local: string;
  type: string;
  taxonomies?: Array<{ name: string }>;
}

interface SGResponse {
  events?: SGEvent[];
}

async function fetchSeatGeek(loc: LocationContext): Promise<SGEvent[]> {
  if (!SEATGEEK_CLIENT_ID) return [];
  try {
    const url = new URL("https://api.seatgeek.com/2/events");
    url.searchParams.set("client_id", SEATGEEK_CLIENT_ID);
    url.searchParams.set("lat", loc.lat.toString());
    url.searchParams.set("lon", loc.lng.toString());
    url.searchParams.set("range", "30mi");
    url.searchParams.set("datetime_local.gte", `${loc.dateISO}T00:00:00`);
    url.searchParams.set("datetime_local.lte", `${loc.dateISO}T23:59:59`);
    url.searchParams.set("per_page", "15");
    url.searchParams.set("sort", "score.desc");

    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data: SGResponse = await res.json();
    return data.events ?? [];
  } catch {
    return [];
  }
}

function formatSGEvent(e: SGEvent): string {
  const time = new Date(e.datetime_local).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${e.title} at ${e.venue.name}, ${time}`;
}

// --- Combined events + culture moments ---

export async function fetchEventMoments(
  loc: LocationContext
): Promise<MomentContext[]> {
  const [tmEvents, sgEvents] = await Promise.all([
    fetchTicketmaster(loc),
    fetchSeatGeek(loc),
  ]);

  // Separate music/events from arts/culture
  const musicEvents: string[] = [];
  const cultureEvents: string[] = [];
  const seenNames = new Set<string>();

  for (const e of tmEvents) {
    const { text, type } = formatTMEvent(e);
    const key = e.name.toLowerCase().slice(0, 30);
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    if (type === "Arts & Theatre") {
      cultureEvents.push(text);
    } else {
      musicEvents.push(text);
    }
  }

  // Add SeatGeek events that aren't duplicates
  for (const e of sgEvents) {
    const key = e.title.toLowerCase().slice(0, 30);
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    const taxonomy = e.taxonomies?.[0]?.name ?? "";
    if (taxonomy === "theater" || taxonomy === "literary") {
      cultureEvents.push(formatSGEvent(e));
    } else {
      musicEvents.push(formatSGEvent(e));
    }
  }

  const moments: MomentContext[] = [];

  if (musicEvents.length > 0) {
    moments.push({
      category: "events",
      source: "ticketmaster+seatgeek",
      data: `Live events near ${loc.city} on ${loc.date}:\n${musicEvents.slice(0, 8).join("\n")}`,
    });
  }

  if (cultureEvents.length > 0) {
    moments.push({
      category: "culture",
      source: "ticketmaster+seatgeek",
      data: `Arts & culture events near ${loc.city} on ${loc.date}:\n${cultureEvents.slice(0, 5).join("\n")}`,
    });
  }

  return moments;
}
