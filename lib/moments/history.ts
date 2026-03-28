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

/**
 * Fetch "History of {City}" Wikipedia article and extract date-tagged events
 * for the current month+day. Returns structured local history facts.
 * This supplements the global On-This-Day API with city-specific data.
 */
async function fetchCityWikiHistory(
  city: string,
  month: number,
  day: number
): Promise<string[]> {
  const cityName = city.split(",")[0].trim();
  // Try "History of {City}" and "Timeline of {City}" articles
  const titles = [
    `History of ${cityName}`,
    `Timeline of ${cityName}`,
    cityName,
  ];

  const monthNames = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthName = monthNames[month];

  for (const title of titles) {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&explaintext=true&format=json&origin=*`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "JustB/1.0 (zkhowes.fun)",
        },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const pages = data.query?.pages;
      if (!pages) continue;

      const page = Object.values(pages)[0] as { extract?: string };
      const extract = page?.extract;
      if (!extract) continue;

      // Search for sentences mentioning this month + day, or just this month
      const facts: string[] = [];
      const sentences = extract.split(/(?<=[.!?])\s+/);

      // Exact date matches first (e.g. "March 28" or "28 March")
      const exactPatterns = [
        new RegExp(`${monthName}\\s+${day}\\b`, "i"),
        new RegExp(`${day}\\s+${monthName}\\b`, "i"),
      ];
      for (const s of sentences) {
        if (exactPatterns.some((p) => p.test(s)) && s.length > 30 && s.length < 500) {
          // Extract surrounding context (include previous sentence if it has a year)
          const idx = sentences.indexOf(s);
          const prev = idx > 0 ? sentences[idx - 1] : "";
          const hasYear = /\b(1[5-9]\d{2}|20[0-2]\d)\b/.test(s) || /\b(1[5-9]\d{2}|20[0-2]\d)\b/.test(prev);
          if (hasYear) {
            facts.push(s.trim());
          }
        }
      }

      // If no exact date, try month-level matches with year context
      if (facts.length === 0) {
        const monthPattern = new RegExp(`\\b${monthName}\\b`, "i");
        const yearPattern = /\b(1[5-9]\d{2}|20[0-2]\d)\b/;
        for (const s of sentences) {
          if (monthPattern.test(s) && yearPattern.test(s) && s.length > 30 && s.length < 500) {
            facts.push(s.trim());
          }
        }
      }

      if (facts.length > 0) return facts.slice(0, 3);
    } catch {
      continue;
    }
  }

  return [];
}

export async function fetchHistoryMoments(
  loc: LocationContext
): Promise<MomentContext[]> {
  const d = new Date(loc.dateISO);
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const monthStr = String(month).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");

  // Fetch global on-this-day and city-specific Wikipedia history in parallel
  const [onThisDayResult, cityHistoryResult] = await Promise.allSettled([
    fetchOnThisDay(loc, monthStr, dayStr),
    fetchCityWikiHistory(loc.city, month, day),
  ]);

  const onThisDay = onThisDayResult.status === "fulfilled" ? onThisDayResult.value : [];
  const cityHistory = cityHistoryResult.status === "fulfilled" ? cityHistoryResult.value : [];

  if (onThisDay.length === 0 && cityHistory.length === 0) {
    return fallback(loc);
  }

  let data = `On this day (${loc.date}):\n`;

  if (cityHistory.length > 0) {
    data += `\nLocal history from Wikipedia (${loc.city}):\n${cityHistory.map((f) => `- ${f}`).join("\n")}\n`;
  }

  if (onThisDay.length > 0) {
    data += `\nGlobal events on this date:\n${onThisDay.join("\n")}\n`;
  }

  data += `\nSTRONGLY prefer a fact with a direct connection to ${loc.city} or its region. If none connect, use your own knowledge ONLY if you are highly confident about the exact date — never guess a date.`;

  return [
    {
      category: "history",
      source: cityHistory.length > 0 ? "wikipedia+wikimedia" : "wikimedia",
      data,
    },
  ];
}

async function fetchOnThisDay(
  loc: LocationContext,
  month: string,
  day: string
): Promise<string[]> {
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

    if (!res.ok) return [];

    const data: WikiResponse = await res.json();
    const events = data.selected ?? data.events ?? [];
    if (events.length === 0) return [];

    // Prefer events with a geographic connection to the user's city/region
    const cityLower = loc.city.toLowerCase();
    const cityShort = loc.city.split(",")[0].trim().toLowerCase();
    const localEvents = events.filter((e) => {
      const text = e.text.toLowerCase();
      const pageNames = e.pages.map((p) => p.title.toLowerCase()).join(" ");
      const combined = `${text} ${pageNames}`;
      return combined.includes(cityLower) || combined.includes(cityShort);
    });

    let picks: WikiEvent[];
    if (localEvents.length > 0) {
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

    return picks.map((e) => `${e.year}: ${e.text}`);
  } catch {
    return [];
  }
}

function fallback(loc: LocationContext): MomentContext[] {
  return [
    {
      category: "history",
      source: "llm-knowledge",
      data: `Share a historical fact about ${loc.city} tied to this time of year. ONLY share facts you are highly confident about — include the year. If unsure of the exact date, describe a seasonal historical pattern instead. Include indigenous history, early settlement, or a notable regional event. NEVER fabricate or guess specific dates.`,
    },
  ];
}
