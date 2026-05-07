export type Category =
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

export type GlyphData = {
  weather: { temp: number; code: number } | null;
  sunrise: string;
  sunset: string;
  moonPhase: string;
  moonIllumination: number;
  tide: {
    state: "rising" | "falling";
    nextHigh: string | null;
    nextLow: string | null;
  } | null;
  /** Per-source diagnostics so the UI can surface failures rather than silently hiding them */
  errors: {
    weather?: string;
    astro?: string;
    tide?: string;
  };
  /** Reason a non-error field is null (e.g. tide skipped because inland) — for transparency */
  notes: {
    tide?: string;
  };
};

export type FeedItem = {
  id: string;
  title: string;
  body: string;
  category: Category;
  confidence: "high" | "medium" | "low";
  imageQuery?: string;
  imageUrl?: string;
  /** 1–3 short structured facts pulled out of the moment data — rendered as chips
   *  above the body. Each fact is 1–4 words; e.g. "8pm tonight", "$25", "0.6mi". */
  facts?: string[];
};
