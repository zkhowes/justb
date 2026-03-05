import { MomentContext, LocationContext } from "./types";

// ESPN unofficial API — free, no key needed
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

interface ESPNEvent {
  name: string;
  date: string;
  status: { type: { description: string } };
  competitions: Array<{
    venue?: { fullName: string; address?: { city: string; state: string } };
    competitors: Array<{
      team: { displayName: string; abbreviation: string };
      homeAway: string;
      score?: string;
    }>;
    broadcasts?: Array<{ names: string[] }>;
  }>;
}

interface ESPNResponse {
  events?: ESPNEvent[];
}

const LEAGUES = [
  { path: "basketball/nba", label: "NBA" },
  { path: "football/nfl", label: "NFL" },
  { path: "baseball/mlb", label: "MLB" },
  { path: "hockey/nhl", label: "NHL" },
  { path: "soccer/usa.1", label: "MLS" },
] as const;

async function fetchLeague(
  leaguePath: string,
  dateStr: string
): Promise<ESPNEvent[]> {
  try {
    const res = await fetch(
      `${ESPN_BASE}/${leaguePath}/scoreboard?dates=${dateStr}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data: ESPNResponse = await res.json();
    return data.events ?? [];
  } catch {
    return [];
  }
}

function isLocalGame(event: ESPNEvent, city: string): boolean {
  const cityLower = city.toLowerCase();
  // Check venue city
  for (const comp of event.competitions) {
    const venueCity = comp.venue?.address?.city?.toLowerCase();
    if (venueCity && cityLower.includes(venueCity)) return true;
    // Check team names (e.g. "Portland" in "Portland Trail Blazers")
    for (const team of comp.competitors) {
      if (team.team.displayName.toLowerCase().includes(cityLower.split(",")[0].trim().toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}

function formatEvent(event: ESPNEvent, league: string): string {
  const comp = event.competitions[0];
  if (!comp) return "";
  const home = comp.competitors.find((c) => c.homeAway === "home");
  const away = comp.competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return "";
  const venue = comp.venue?.fullName ?? "TBD";
  const broadcast = comp.broadcasts?.[0]?.names?.join(", ") ?? "";
  const time = new Date(event.date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  let line = `${league}: ${away.team.displayName} at ${home.team.displayName}, ${time}, ${venue}`;
  if (broadcast) line += ` (${broadcast})`;
  return line;
}

export async function fetchSportsMoments(
  loc: LocationContext
): Promise<MomentContext[]> {
  const dateStr = loc.dateISO.replace(/-/g, "");

  const results = await Promise.allSettled(
    LEAGUES.map((l) => fetchLeague(l.path, dateStr))
  );

  const localGames: string[] = [];
  const allGames: string[] = [];

  results.forEach((result, i) => {
    if (result.status !== "fulfilled") return;
    for (const event of result.value) {
      const formatted = formatEvent(event, LEAGUES[i].label);
      if (!formatted) continue;
      allGames.push(formatted);
      if (isLocalGame(event, loc.city)) {
        localGames.push(formatted);
      }
    }
  });

  if (localGames.length === 0 && allGames.length === 0) {
    return [
      {
        category: "sports",
        source: "espn",
        data: `No major professional sports games found for ${loc.date}. Mention the current season status or next upcoming games for teams near ${loc.city}.`,
      },
    ];
  }

  const games = localGames.length > 0 ? localGames : allGames.slice(0, 5);
  const locality = localGames.length > 0 ? "Local games" : "Notable games today (none local)";

  return [
    {
      category: "sports",
      source: "espn",
      data: `${locality} on ${loc.date}:\n${games.join("\n")}`,
    },
  ];
}
