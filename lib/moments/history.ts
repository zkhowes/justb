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

    // Pick 3 interesting events, spread across eras
    const sorted = events.sort((a, b) => a.year - b.year);
    const picks = [
      sorted[0],
      sorted[Math.floor(sorted.length / 2)],
      sorted[sorted.length - 1],
    ].filter(Boolean);

    const lines = picks.map(
      (e) => `${e.year}: ${e.text}`
    );

    return [
      {
        category: "history",
        source: "wikimedia",
        data: `On this day (${loc.date}):\n${lines.join("\n")}\n\nUse one of these facts, ideally tying it to ${loc.city} or the region if possible.`,
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
