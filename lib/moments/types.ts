export type MomentCategory =
  | "sky-space"
  | "sky"
  | "space"
  | "nature"
  | "local-scene"
  | "sports"
  | "events"
  | "earth-garden"
  | "history"
  | "culture"
  | "food"
  | "community";

// Raw structured data from an API or computation — fed to Claude for prose
export interface MomentContext {
  category: MomentCategory;
  source: string; // e.g. "espn", "ticketmaster", "suncalc", "wikimedia"
  data: string; // pre-formatted text summary for the LLM prompt
}

// Location context shared across all providers
export interface LocationContext {
  city: string;
  lat: number;
  lng: number;
  timezone: string;
  date: string; // e.g. "March 5, 2026"
  dateISO: string; // e.g. "2026-03-05"
}
