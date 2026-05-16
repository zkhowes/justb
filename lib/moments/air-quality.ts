import { MomentContext, LocationContext } from "./types";

export interface AirQualityGlyph {
  label: string;
  value?: string;
}

export type AirQualityResult = {
  moments: MomentContext[];
  glyph: AirQualityGlyph | null;
  error?: string;
  note?: string;
};

interface OpenAQLocation {
  id: number;
  name?: string;
  locality?: string;
  distance?: number;
}

interface OpenAQLatest {
  parameter?: { name?: string; units?: string };
  value?: number;
  unit?: string;
  datetime?: { local?: string; utc?: string };
  coordinates?: { latitude?: number; longitude?: number };
}

function describePm25(value: number): string {
  if (value <= 5) return "very clear";
  if (value <= 12) return "good";
  if (value <= 35) return "noticeable";
  if (value <= 55) return "unhealthy for sensitive groups";
  return "poor";
}

function formatDistance(meters?: number): string | null {
  if (typeof meters !== "number" || !Number.isFinite(meters)) return null;
  const miles = meters / 1609.344;
  if (miles < 0.1) return "<0.1 mi";
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

export async function fetchAirQualityMoments(
  loc: LocationContext
): Promise<AirQualityResult> {
  const apiKey = process.env.OPENAQ_API_KEY;
  if (!apiKey) {
    return {
      moments: [],
      glyph: null,
      note: "OPENAQ_API_KEY not configured",
    };
  }

  try {
    const locationsUrl = new URL("https://api.openaq.org/v3/locations");
    locationsUrl.searchParams.set("coordinates", `${loc.lat},${loc.lng}`);
    locationsUrl.searchParams.set("radius", "25000");
    locationsUrl.searchParams.set("limit", "5");
    locationsUrl.searchParams.set("order_by", "distance");

    const locRes = await fetch(locationsUrl.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "JustB/1.0 (local almanac)",
        "X-API-Key": apiKey,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!locRes.ok) return { moments: [], glyph: null, error: `OpenAQ locations HTTP ${locRes.status}` };

    const locJson: { results?: OpenAQLocation[] } = await locRes.json();
    const station = locJson.results?.[0];
    if (!station?.id) {
      return { moments: [], glyph: null, note: "no nearby OpenAQ station" };
    }

    const latestUrl = new URL(`https://api.openaq.org/v3/locations/${station.id}/latest`);
    const latestRes = await fetch(latestUrl.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "JustB/1.0 (local almanac)",
        "X-API-Key": apiKey,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!latestRes.ok) return { moments: [], glyph: null, error: `OpenAQ latest HTTP ${latestRes.status}` };

    const latestJson: { results?: OpenAQLatest[] } = await latestRes.json();
    const readings = latestJson.results ?? [];
    const pm25 = readings.find((r) => (r.parameter?.name ?? "").toLowerCase().includes("pm2"));
    const pm10 = readings.find((r) => (r.parameter?.name ?? "").toLowerCase().includes("pm10"));
    const primary = pm25 ?? pm10 ?? readings[0];
    if (!primary || typeof primary.value !== "number") {
      return { moments: [], glyph: null, note: "OpenAQ station had no current readings" };
    }

    const unit = primary.parameter?.units ?? primary.unit ?? "";
    const parameter = primary.parameter?.name ?? "air quality";
    const rounded = Math.round(primary.value * 10) / 10;
    const distance = formatDistance(station.distance);
    const stationName = station.name ?? station.locality ?? "nearby monitor";
    const condition = parameter.toLowerCase().includes("pm2")
      ? describePm25(primary.value)
      : "measured";
    const glyph: AirQualityGlyph = {
      label: condition,
      value: `${rounded}${unit ? ` ${unit}` : ""}`,
    };

    return {
      glyph,
      moments: [
        {
          category: "air",
          source: "openaq",
          data: `Air quality near ${loc.city} from OpenAQ:
Monitor: ${stationName}${distance ? ` (${distance} away)` : ""}
Reading: ${parameter} ${rounded}${unit ? ` ${unit}` : ""}
Condition: ${condition}

Use this only if it is interesting or useful today. Explain what the reading means in plain language for someone deciding whether to linger outside, open windows, or pick a cleaner-air walk. Do not overstate health advice.`,
        },
      ],
    };
  } catch (err) {
    return {
      moments: [],
      glyph: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
