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
import { fetchTides } from "./tides";
import { fetchAirQualityMoments } from "./air-quality";
import { fetchWaterMoments } from "./water";
import { fetchAlertMoments } from "./alerts";
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

  const [skyResult, sportsResult, eventsResult, historyResult, redditResult, newsResult, communityEventsResult, airResult, waterResult, alertResult, tideResult] =
    await Promise.allSettled([
      fetchSkyMoments(loc, weatherResult),
      fetchSportsMoments(loc),
      fetchEventMoments(loc),
      fetchHistoryMoments(loc),
      fetchRedditMoments(loc),
      fetchLocalNewsMoments(loc),
      fetchCommunityEventMoments(loc),
      fetchAirQualityMoments(loc),
      fetchWaterMoments(loc),
      fetchAlertMoments(loc),
      fetchTides(lat, lng, timezone),
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
  const air = airResult.status === "fulfilled" ? airResult.value : null;
  const water = waterResult.status === "fulfilled" ? waterResult.value : null;
  const alerts = alertResult.status === "fulfilled" ? alertResult.value : null;

  if (redditMoments.length > 0) moments.push(...redditMoments);
  if (newsMoments.length > 0) moments.push(...newsMoments);
  if (communityEventMoments.length > 0) moments.push(...communityEventMoments);
  if (air?.moments.length) moments.push(...air.moments);
  if (water?.moments.length) moments.push(...water.moments);
  if (alerts?.moments.length) moments.push(...alerts.moments);

  const errors: GlyphData["errors"] = {};
  const notes: GlyphData["notes"] = {};

  let astro: ReturnType<typeof getAstroData> | null = null;
  try {
    astro = getAstroData(lat, lng, new Date(), timezone);
  } catch (e) {
    errors.astro = e instanceof Error ? e.message : String(e);
  }

  if (!weatherResult) errors.weather = "open-meteo returned no data";

  if (airResult.status === "rejected") {
    errors.air = airResult.reason instanceof Error ? airResult.reason.message : String(airResult.reason);
  } else if (air?.error) {
    errors.air = air.error;
  } else if (air?.note) {
    notes.air = air.note;
  }

  if (waterResult.status === "rejected") {
    errors.water = waterResult.reason instanceof Error ? waterResult.reason.message : String(waterResult.reason);
  } else if (water?.error) {
    errors.water = water.error;
  } else if (water?.note) {
    notes.water = water.note;
  }

  if (alertResult.status === "rejected") {
    errors.alerts = alertResult.reason instanceof Error ? alertResult.reason.message : String(alertResult.reason);
  } else if (alerts?.error) {
    errors.alerts = alerts.error;
  } else if (alerts?.note) {
    notes.alerts = alerts.note;
  }

  let tide: GlyphData["tide"] = null;
  if (tideResult.status === "fulfilled") {
    const r = tideResult.value;
    if (r.ok) {
      if (r.data) {
        tide = { state: r.data.state, nextHigh: r.data.nextHigh, nextLow: r.data.nextLow };
      } else if (r.reason) {
        notes.tide = r.reason;
      }
    } else {
      errors.tide = r.error;
    }
  } else {
    errors.tide = tideResult.reason instanceof Error ? tideResult.reason.message : String(tideResult.reason);
  }

  const glyphs: GlyphData = {
    weather: weatherResult ? { temp: weatherResult.temp, code: weatherResult.code } : null,
    sunrise: astro?.sunrise ?? "",
    sunset: astro?.sunset ?? "",
    moonPhase: astro?.moonPhase ?? "",
    moonIllumination: astro?.moonIllumination ?? 0,
    tide,
    air: air?.glyph ?? null,
    water: water?.glyph ?? null,
    alerts: alerts?.glyph ?? null,
    errors,
    notes,
  };

  if (Object.keys(errors).length > 0) {
    console.warn("[glyphs] errors:", errors);
  }

  return { loc, moments, glyphs };
}
