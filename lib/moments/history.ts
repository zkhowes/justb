import { MomentContext, LocationContext } from "./types";

interface WikiEvent {
  text: string;
  year: number;
  pages: Array<{ title: string }>;
}

interface WikiResponse {
  selected?: WikiEvent[];
  events?: WikiEvent[];
}

export async function fetchHistoryMoments(
  loc: LocationContext
): Promise<MomentContext[]> {
  const d = new Date(loc.dateISO);
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");

  try {
    const res = await fetch(
      `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/${month}/${day}`,
      {
        headers: {
          "User-Agent": "JustB/1.0 (zkhowes.fun)",
          "Api-User-Agent": "JustB/1.0 (zkhowes.fun)",
        },
      }
    );

    if (!res.ok) {
      return fallback(loc);
    }

    const data: WikiResponse = await res.json();
    const events = data.selected ?? data.events ?? [];

    if (events.length === 0) {
      return fallback(loc);
    }

    // Prefer events with a geographic connection to the user's city/region
    const cityLower = loc.city.toLowerCase();
    const localEvents = events.filter((e) => {
      const text = e.text.toLowerCase();
      const pageNames = e.pages.map((p) => p.title.toLowerCase()).join(" ");
      const combined = `${text} ${pageNames}`;
      return combined.includes(cityLower) ||
        combined.includes(loc.city.split(",")[0].trim().toLowerCase());
    });

    // Pick events: prioritize local, fill with spread across eras
    let picks: WikiEvent[];
    if (localEvents.length > 0) {
      // Lead with local events, pad with global spread
      const globalSorted = events
        .filter((e) => !localEvents.includes(e))
        .sort((a, b) => a.year - b.year);
      picks = [
        ...localEvents.slice(0, 2),
        ...(globalSorted.length > 0 ? [globalSorted[Math.floor(globalSorted.length / 2)]] : []),
      ].filter(Boolean).slice(0, 3);
    } else {
      const sorted = events.sort((a, b) => a.year - b.year);
      picks = [
        sorted[0],
        sorted[Math.floor(sorted.length / 2)],
        sorted[sorted.length - 1],
      ].filter(Boolean);
    }

    const lines = picks.map(
      (e) => `${e.year}: ${e.text}`
    );

    return [
      {
        category: "history",
        source: "wikimedia",
        data: `On this day (${loc.date}):\n${lines.join("\n")}\n\nSTRONGLY prefer a fact with a direct connection to ${loc.city} or its region. If none connect, use your own knowledge of local history for this date.`,
      },
    ];
  } catch {
    return fallback(loc);
  }
}

function fallback(loc: LocationContext): MomentContext[] {
  return [
    {
      category: "history",
      source: "llm-knowledge",
      data: `Share a historical fact about ${loc.city} tied to this time of year. Include indigenous history, early settlement, or a notable regional event.`,
    },
  ];
}
