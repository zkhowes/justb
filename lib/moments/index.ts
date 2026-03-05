import { geocodeCity } from "../geocode";
import { MomentContext, LocationContext } from "./types";
import { fetchSkyMoments } from "./sky";
import { fetchSportsMoments } from "./sports";
import { fetchEventMoments } from "./events";
import { fetchHistoryMoments } from "./history";

export type { MomentContext, LocationContext };

export async function gatherAllMoments(
  city: string,
  date: string
): Promise<{ loc: LocationContext; moments: MomentContext[] }> {
  const { lat, lng, timezone } = await geocodeCity(city);
  const dateISO = new Date().toISOString().slice(0, 10);

  const loc: LocationContext = { city, lat, lng, timezone, date, dateISO };

  // Fetch all moment providers in parallel
  const results = await Promise.allSettled([
    fetchSkyMoments(loc),
    fetchSportsMoments(loc),
    fetchEventMoments(loc),
    fetchHistoryMoments(loc),
  ]);

  const moments: MomentContext[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      moments.push(...result.value);
    }
  }

  return { loc, moments };
}
