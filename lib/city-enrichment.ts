export interface RssSourceConfig {
  name: string;
  url: string;
}

export interface HtmlCalendarSourceConfig {
  name: string;
  urlTemplate: string;
  parser: "seattles-child" | "do206";
}

export interface CityEnrichmentProfile {
  key: string;
  displayName: string;
  localTerms: string[];
  nonLocalPatterns?: RegExp[];
  newsFeeds?: RssSourceConfig[];
  eventFeeds?: RssSourceConfig[];
  eventCalendars?: HtmlCalendarSourceConfig[];
}

const GLOBAL_NON_LOCAL_PATTERNS = [
  /\bisrael/i,
  /\bhamas\b/i,
  /\bgaza\b/i,
  /\bukraine\b/i,
  /\brussia\b/i,
  /\bchina\b/i,
  /\bwhite house\b/i,
  /\btrump\b/i,
  /\bcongress\b/i,
  /\bsupreme court\b/i,
  /\bwall street\b/i,
];

const CITY_PROFILES: Record<string, CityEnrichmentProfile> = {
  seattle: {
    key: "seattle",
    displayName: "Seattle",
    localTerms: [
      "seattle",
      "west seattle",
      "capitol hill",
      "ballard",
      "fremont",
      "wallingford",
      "university district",
      "u district",
      "the ave",
      "queen anne",
      "belltown",
      "pioneer square",
      "south lake union",
      "columbia city",
      "rainier beach",
      "beacon hill",
      "georgetown",
      "uw",
      "washington huskies",
      "king county",
      "sound transit",
      "link light rail",
      "puget sound",
    ],
    nonLocalPatterns: [/\bspokane\b/i],
    newsFeeds: [
      { name: "The Stranger", url: "https://www.thestranger.com/rss/news" },
      { name: "Seattle Times", url: "https://www.seattletimes.com/feed/" },
    ],
    eventCalendars: [
      {
        name: "Seattle's Child Calendar",
        urlTemplate: "https://www.seattleschild.com/calendar/?event_date={dateISO}",
        parser: "seattles-child",
      },
      {
        name: "Do206",
        urlTemplate: "https://do206.com/events?date={dateISO}",
        parser: "do206",
      },
    ],
  },
  portland: {
    key: "portland",
    displayName: "Portland",
    localTerms: ["portland", "multnomah", "willamette", "hawthorne", "alberta", "pearl district"],
    newsFeeds: [
      { name: "OregonLive", url: "https://www.oregonlive.com/arc/outboundfeeds/rss/?outputType=xml" },
      { name: "Willamette Week", url: "https://www.wweek.com/feed/" },
    ],
  },
  "san francisco": {
    key: "san francisco",
    displayName: "San Francisco",
    localTerms: ["san francisco", "sf", "bay area", "mission", "soma", "sunset", "richmond"],
    newsFeeds: [
      { name: "SFGate", url: "https://www.sfgate.com/feed/sfgate/rss.xml" },
      { name: "SF Chronicle", url: "https://www.sfchronicle.com/feed/sfgate/rss.xml" },
    ],
  },
  "los angeles": {
    key: "los angeles",
    displayName: "Los Angeles",
    localTerms: ["los angeles", "la ", "hollywood", "echo park", "silver lake", "dtla"],
    newsFeeds: [
      { name: "LAist", url: "https://laist.com/feed" },
      { name: "LA Times", url: "https://www.latimes.com/local/rss2.0.xml" },
    ],
  },
  "new york": {
    key: "new york",
    displayName: "New York",
    localTerms: ["new york", "nyc", "brooklyn", "queens", "manhattan", "bronx", "staten island"],
    newsFeeds: [
      { name: "Gothamist", url: "https://gothamist.com/feed" },
      { name: "amNY", url: "https://www.amny.com/feed/" },
    ],
  },
  chicago: {
    key: "chicago",
    displayName: "Chicago",
    localTerms: ["chicago", "cook county", "loop", "logan square", "hyde park", "wicker park"],
    newsFeeds: [
      { name: "Block Club Chicago", url: "https://blockclubchicago.org/feed/" },
      { name: "Chicago Sun-Times", url: "https://chicago.suntimes.com/rss/index.xml" },
    ],
  },
};

export function getCityKey(city: string): string {
  return city.split(",")[0].trim().toLowerCase();
}

export function getCityProfile(city: string): CityEnrichmentProfile | null {
  const key = getCityKey(city);
  if (CITY_PROFILES[key]) return CITY_PROFILES[key];
  for (const [name, profile] of Object.entries(CITY_PROFILES)) {
    if (key.includes(name) || name.includes(key)) return profile;
  }
  return null;
}

export function getLocalTerms(city: string): string[] {
  const profile = getCityProfile(city);
  return profile?.localTerms ?? [getCityKey(city)];
}

export function getNonLocalPatterns(city: string): RegExp[] {
  const profile = getCityProfile(city);
  return [...GLOBAL_NON_LOCAL_PATTERNS, ...(profile?.nonLocalPatterns ?? [])];
}

export function getNewsFeeds(city: string): RssSourceConfig[] {
  return getCityProfile(city)?.newsFeeds ?? [];
}

export function getEventFeeds(city: string): RssSourceConfig[] {
  return getCityProfile(city)?.eventFeeds ?? [];
}

export function getEventCalendars(city: string): HtmlCalendarSourceConfig[] {
  return getCityProfile(city)?.eventCalendars ?? [];
}
