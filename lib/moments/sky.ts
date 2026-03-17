import { getAstroData } from "../astro";
import { MomentContext, LocationContext } from "./types";

export async function fetchSkyMoments(loc: LocationContext): Promise<MomentContext[]> {
  const astro = getAstroData(loc.lat, loc.lng, new Date(), loc.timezone);

  return [
    {
      category: "sky-space",
      source: "suncalc",
      data: `Sunrise ${astro.sunrise}, sunset ${astro.sunset} (${loc.timezone}).`,
    },
  ];
}
