import { geocodeCity } from "../geocode";
import { getAstroData } from "../astro";
import { MomentContext, LocationContext } from "./types";
import { fetchSkyMoments } from "./sky";
import { fetchSportsMoments } from "./sports";
import { fetchEventMoments } from "./events";
import { fetchHistoryMoments } from "./history";
import { fetchRedditMoments } from "./reddit";
import { fetchLocalNewsMoments } from "./local-news";
import { fetchCommunityEventMoments } from "./community-events";
import { fetchWeather } from "./weather";
import { GlyphData } from "../types";

export type { MomentContext, LocationContext };

export async function gatherAllMoments(
  city: string,
  date: string
): Promise<{ loc: LocationContext; moments: MomentContext[]; glyphs: GlyphData }> {
  const { lat, lng, timezone } = await geocodeCity(city);
  // Derive dateISO from the date parameter (e.g. "March 17, 2026") rather than
  // server clock, which runs UTC on Vercel and can drift from the user's local date
  const parsed = new Date(date);
  const dateISO = isNaN(parsed.getTime())
    ? new Date().toISOString().slice(0, 10)
    : parsed.toISOString().slice(0, 10);

  const loc: LocationContext = { city, lat, lng, timezone, date, dateISO };

  // Fetch weather first (sky provider needs it), other providers in parallel
  const weatherResult = await fetchWeather(lat, lng);

  const [skyResult, sportsResult, eventsResult, historyResult, redditResult, newsResult, communityEventsResult] =
    await Promise.allSettled([
      fetchSkyMoments(loc, weatherResult),
      fetchSportsMoments(loc),
      fetchEventMoments(loc),
      fetchHistoryMoments(loc),
      fetchRedditMoments(loc),
      fetchLocalNewsMoments(loc),
      fetchCommunityEventMoments(loc),
    ]);

  const moments: MomentContext[] = [];
  // Add non-community providers first
  for (const result of [skyResult, sportsResult, eventsResult, historyResult]) {
    if (result.status === "fulfilled") {
      moments.push(...result.value);
    }
  }
  // Community sources: include all available — Reddit, local news, and city open data
  // More sources = richer local signal for Claude to work with
  const redditMoments = redditResult.status === "fulfilled" ? redditResult.value : [];
  const newsMoments = newsResult.status === "fulfilled" ? newsResult.value : [];
  const communityEventMoments = communityEventsResult.status === "fulfilled" ? communityEventsResult.value : [];

  if (redditMoments.length > 0) moments.push(...redditMoments);
  if (newsMoments.length > 0) moments.push(...newsMoments);
  if (communityEventMoments.length > 0) moments.push(...communityEventMoments);

  const astro = getAstroData(lat, lng, new Date(), timezone);
  const weather = weatherResult;

  const glyphs: GlyphData = {
    weather: weather ? { temp: weather.temp, code: weather.code } : null,
    sunrise: astro.sunrise,
    sunset: astro.sunset,
    moonPhase: astro.moonPhase,
    moonIllumination: astro.moonIllumination,
  };

  return { loc, moments, glyphs };
}
