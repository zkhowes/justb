// NOAA CO-OPS tide predictions — free, no API key.
// https://api.tidesandcurrents.noaa.gov/api/prod/

export type TideEvent = { type: "H" | "L"; time: string };

export type TideData = {
  /** Whether the tide is currently rising or falling (interpolated from neighboring extremes) */
  state: "rising" | "falling";
  /** Next high tide (formatted local time) — null if none in the day */
  nextHigh: string | null;
  /** Next low tide (formatted local time) — null if none in the day */
  nextLow: string | null;
  /** NOAA station id used (for debugging) */
  stationId: string;
  /** Distance in km from the requested location to the station */
  stationDistanceKm: number;
};

// Major NOAA CO-OPS tide stations near common US coastal cities.
// id: https://tidesandcurrents.noaa.gov/stations.html?type=Water+Levels
const STATIONS: { id: string; name: string; lat: number; lng: number }[] = [
  { id: "9447130", name: "Seattle, WA", lat: 47.6026, lng: -122.3393 },
  { id: "9439040", name: "Astoria, OR", lat: 46.2073, lng: -123.7686 },
  { id: "9414290", name: "San Francisco, CA", lat: 37.8063, lng: -122.4659 },
  { id: "9410660", name: "Los Angeles, CA", lat: 33.72, lng: -118.27 },
  { id: "9410170", name: "San Diego, CA", lat: 32.7142, lng: -117.1736 },
  { id: "8443970", name: "Boston, MA", lat: 42.3539, lng: -71.0503 },
  { id: "8518750", name: "The Battery, NY", lat: 40.7006, lng: -74.0142 },
  { id: "8534720", name: "Atlantic City, NJ", lat: 39.355, lng: -74.4183 },
  { id: "8557380", name: "Lewes, DE", lat: 38.7822, lng: -75.1192 },
  { id: "8638610", name: "Sewells Point, VA", lat: 36.9467, lng: -76.3303 },
  { id: "8665530", name: "Charleston, SC", lat: 32.7806, lng: -79.9239 },
  { id: "8723214", name: "Virginia Key, FL", lat: 25.7314, lng: -80.1622 },
  { id: "8729108", name: "Panama City, FL", lat: 30.1517, lng: -85.6669 },
  { id: "8761724", name: "Grand Isle, LA", lat: 29.2633, lng: -89.9567 },
  { id: "8771013", name: "Eagle Point, TX", lat: 29.4806, lng: -94.9183 },
];

/** Great-circle distance in km */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nearestStation(lat: number, lng: number) {
  let best = STATIONS[0];
  let bestDist = distanceKm(lat, lng, best.lat, best.lng);
  for (const s of STATIONS.slice(1)) {
    const d = distanceKm(lat, lng, s.lat, s.lng);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return { station: best, distanceKm: bestDist };
}

function formatTime(iso: string, timezone: string): string {
  // NOAA returns local-station time as "YYYY-MM-DD HH:mm" without a tz suffix.
  // Treat as the station's wall clock; convert only for display.
  const [datePart, timePart] = iso.split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  // Construct a UTC date that matches the same local hour for display purposes.
  const utc = new Date(Date.UTC(y, m - 1, d, hh, mm));
  return utc.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export type TideFetchResult =
  | { ok: true; data: TideData | null; reason?: string }
  | { ok: false; error: string };

/**
 * Fetches today's tide predictions for the location.
 * Returns null data (with reason) for inland locations beyond the threshold.
 * Returns an error for actual fetch/parse failures so the caller can surface it.
 */
export async function fetchTides(
  lat: number,
  lng: number,
  timezone: string
): Promise<TideFetchResult> {
  const { station, distanceKm: dist } = nearestStation(lat, lng);

  // If the nearest station is more than ~150km away, we're inland — skip.
  if (dist > 150) {
    return { ok: true, data: null, reason: `nearest station ${station.name} is ${Math.round(dist)}km away` };
  }

  try {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const url =
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` +
      `?product=predictions&application=justb&begin_date=${today}&end_date=${today}` +
      `&datum=MLLW&station=${station.id}&time_zone=lst_ldt&units=english&interval=hilo&format=json`;

    const res = await fetch(url, {
      // 10s upper bound; NOAA is usually <500ms
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { ok: false, error: `NOAA HTTP ${res.status}` };
    }
    const json = (await res.json()) as { predictions?: { t: string; v: string; type: "H" | "L" }[]; error?: { message: string } };
    if (json.error) {
      return { ok: false, error: `NOAA error: ${json.error.message}` };
    }
    const preds = json.predictions ?? [];
    if (preds.length === 0) {
      return { ok: false, error: "NOAA returned no predictions" };
    }

    const now = new Date();
    // Find the next high and low after now (NOAA times are local-station, but
    // timezone parameter `lst_ldt` should match station-local — close enough for "next" detection).
    // Parse each prediction time as if it's the user's local clock:
    const nowLocal = now.toLocaleString("en-US", { timeZone: timezone, hour12: false });
    const todayPrefix = nowLocal.split(",")[0]; // ignored; using direct time compare below
    void todayPrefix;

    let nextHigh: string | null = null;
    let nextLow: string | null = null;
    let lastBefore: { type: "H" | "L"; date: Date } | null = null;
    let firstAfter: { type: "H" | "L"; date: Date } | null = null;

    for (const p of preds) {
      const [datePart, timePart] = p.t.split(" ");
      const [y, m, d] = datePart.split("-").map(Number);
      const [hh, mm] = timePart.split(":").map(Number);
      const localDate = new Date(y, m - 1, d, hh, mm);
      if (localDate.getTime() < now.getTime()) {
        lastBefore = { type: p.type, date: localDate };
      } else {
        if (!firstAfter) firstAfter = { type: p.type, date: localDate };
        if (p.type === "H" && !nextHigh) nextHigh = formatTime(p.t, timezone);
        if (p.type === "L" && !nextLow) nextLow = formatTime(p.t, timezone);
      }
    }

    // Determine state. If the next extreme is High, tide is rising; if Low, falling.
    let state: "rising" | "falling";
    if (firstAfter) {
      state = firstAfter.type === "H" ? "rising" : "falling";
    } else if (lastBefore) {
      // No future extremes — invert last observed
      state = lastBefore.type === "H" ? "falling" : "rising";
    } else {
      state = "rising";
    }

    return {
      ok: true,
      data: {
        state,
        nextHigh,
        nextLow,
        stationId: station.id,
        stationDistanceKm: Math.round(dist),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
