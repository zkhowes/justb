type Season = "spring" | "summer" | "fall" | "winter";

const SEASON_QUERIES: Record<Season, string[]> = {
  spring: ["cherry blossoms", "spring flowers meadow", "spring rain green"],
  summer: ["summer golden hour", "summer wildflowers", "warm sunshine field"],
  fall: ["autumn leaves", "fall foliage", "golden autumn forest"],
  winter: ["winter frost", "snow covered trees", "winter morning mist"],
};

const CITY_VIBES: Record<string, Record<Season, string>> = {
  seattle: { spring: "cherry blossoms pacific northwest", summer: "puget sound mountains", fall: "pacific northwest autumn rain", winter: "misty evergreen forest" },
  phoenix: { spring: "desert wildflowers bloom", summer: "sonoran desert sunset cactus", fall: "arizona desert golden hour", winter: "desert morning frost" },
  "new york": { spring: "central park spring blossoms", summer: "new york summer park", fall: "central park autumn leaves", winter: "new york snow cityscape" },
  chicago: { spring: "lake michigan spring", summer: "chicago lakefront summer", fall: "midwest autumn golden", winter: "chicago winter snow" },
  denver: { spring: "colorado spring mountains", summer: "rocky mountains wildflowers", fall: "colorado aspen golden", winter: "rocky mountains snow" },
  miami: { spring: "tropical flowers ocean", summer: "miami beach palm trees", fall: "tropical sunset ocean", winter: "warm tropical beach" },
  "san francisco": { spring: "golden gate fog spring", summer: "california coastal fog", fall: "san francisco bay autumn", winter: "pacific coast winter" },
  austin: { spring: "texas bluebonnets wildflowers", summer: "texas hill country sunset", fall: "texas autumn live oaks", winter: "texas hill country winter" },
  portland: { spring: "oregon spring blossoms rain", summer: "pacific northwest summer", fall: "oregon autumn forest", winter: "oregon misty winter" },
  "los angeles": { spring: "california poppy fields", summer: "california golden coast", fall: "los angeles golden hour hills", winter: "california coast winter" },
};

export function getSeasonForMonth(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

export function buildBackgroundQuery(city: string, month: number, isNight: boolean): string {
  const season = getSeasonForMonth(month);
  const cityKey = city.toLowerCase().trim();

  if (isNight) {
    return `${city} night skyline`;
  }

  const cityVibe = CITY_VIBES[cityKey]?.[season];
  if (cityVibe) return cityVibe;

  const seasonQueries = SEASON_QUERIES[season];
  const pick = seasonQueries[Math.floor(Math.random() * seasonQueries.length)];
  return `${city} ${pick}`;
}

export function buildFallbackQuery(month: number): string {
  const season = getSeasonForMonth(month);
  const queries = SEASON_QUERIES[season];
  return queries[Math.floor(Math.random() * queries.length)];
}
