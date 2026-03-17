import { geocodeCity } from "../geocode";
import { getAstroData } from "../astro";
import { MomentContext, LocationContext } from "./types";
import { fetchSkyMoments } from "./sky";
import { fetchSportsMoments } from "./sports";
import { fetchEventMoments } from "./events";
import { fetchHistoryMoments } from "./history";
import { fetchWeather } from "./weather";
import { GlyphData } from "../types";

export type { MomentContext, LocationContext };

export async function gatherAllMoments(
  city: string,
  date: string
): Promise<{ loc: LocationContext; moments: MomentContext[]; glyphs: GlyphData }> {
  const { lat, lng, timezone } = await geocodeCity(city);
  const dateISO = new Date().toISOString().slice(0, 10);

  const loc: LocationContext = { city, lat, lng, timezone, date, dateISO };

  // Fetch all moment providers + weather in parallel
  const [skyResult, sportsResult, eventsResult, historyResult, weatherResult] =
    await Promise.allSettled([
      fetchSkyMoments(loc),
      fetchSportsMoments(loc),
      fetchEventMoments(loc),
      fetchHistoryMoments(loc),
      fetchWeather(lat, lng),
    ]);

  const moments: MomentContext[] = [];
  for (const result of [skyResult, sportsResult, eventsResult, historyResult]) {
    if (result.status === "fulfilled") {
      moments.push(...result.value);
    }
  }

  const astro = getAstroData(lat, lng, new Date(), timezone);
  const weather =
    weatherResult.status === "fulfilled" ? weatherResult.value : null;

  const glyphs: GlyphData = {
    weather,
    sunrise: astro.sunrise,
    sunset: astro.sunset,
    moonPhase: astro.moonPhase,
    moonIllumination: astro.moonIllumination,
  };

  return { loc, moments, glyphs };
}
