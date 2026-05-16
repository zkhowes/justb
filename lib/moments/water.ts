import { MomentContext, LocationContext } from "./types";

export interface WaterGlyph {
  label: string;
  value?: string;
}

export type WaterResult = {
  moments: MomentContext[];
  glyph: WaterGlyph | null;
  error?: string;
  note?: string;
};

interface UsgsTimeSeries {
  sourceInfo?: {
    siteName?: string;
    geoLocation?: {
      geogLocation?: {
        latitude?: number;
        longitude?: number;
      };
    };
  };
  variable?: {
    variableCode?: Array<{ value?: string }>;
    unit?: { unitCode?: string };
    variableName?: string;
  };
  values?: Array<{
    value?: Array<{
      value?: string;
      dateTime?: string;
    }>;
  }>;
}

function bbox(lat: number, lng: number, delta = 0.35): string {
  return [
    (lng - delta).toFixed(4),
    (lat - delta).toFixed(4),
    (lng + delta).toFixed(4),
    (lat + delta).toFixed(4),
  ].join(",");
}

function latestValue(series: UsgsTimeSeries): { value: number; unit: string; name: string; time?: string } | null {
  const values = series.values?.[0]?.value ?? [];
  const latest = values[values.length - 1];
  const raw = latest?.value;
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return {
    value,
    unit: series.variable?.unit?.unitCode ?? "",
    name: series.variable?.variableName ?? "",
    time: latest?.dateTime,
  };
}

function flowLabel(cfs: number): string {
  if (cfs < 100) return "low flow";
  if (cfs < 1000) return "steady flow";
  if (cfs < 10000) return "strong flow";
  return "high flow";
}

export async function fetchWaterMoments(loc: LocationContext): Promise<WaterResult> {
  try {
    const url = new URL("https://waterservices.usgs.gov/nwis/iv/");
    url.searchParams.set("format", "json");
    url.searchParams.set("bBox", bbox(loc.lat, loc.lng));
    url.searchParams.set("parameterCd", "00060,00065");
    url.searchParams.set("siteStatus", "active");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "JustB/1.0 (local almanac)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { moments: [], glyph: null, error: `USGS HTTP ${res.status}` };

    const json: { value?: { timeSeries?: UsgsTimeSeries[] } } = await res.json();
    const series = json.value?.timeSeries ?? [];
    if (series.length === 0) {
      return { moments: [], glyph: null, note: "no active USGS gauge nearby" };
    }

    const discharge = series.find((s) =>
      s.variable?.variableCode?.some((c) => c.value === "00060")
    );
    const gaugeHeight = series.find((s) =>
      s.variable?.variableCode?.some((c) => c.value === "00065")
    );
    const primarySeries = discharge ?? gaugeHeight ?? series[0];
    const primary = latestValue(primarySeries);
    if (!primary) {
      return { moments: [], glyph: null, note: "nearby USGS gauge had no current reading" };
    }

    const siteName = primarySeries.sourceInfo?.siteName ?? "nearby water gauge";
    const label = discharge && primarySeries === discharge ? flowLabel(primary.value) : "water level";
    const rounded = primary.value >= 100 ? Math.round(primary.value) : Math.round(primary.value * 10) / 10;
    const glyph: WaterGlyph = {
      label,
      value: `${rounded}${primary.unit ? ` ${primary.unit}` : ""}`,
    };

    const height = gaugeHeight ? latestValue(gaugeHeight) : null;
    const extra = height && primarySeries !== gaugeHeight
      ? `\nGauge height: ${Math.round(height.value * 10) / 10}${height.unit ? ` ${height.unit}` : ""}`
      : "";

    return {
      glyph,
      moments: [
        {
          category: "water",
          source: "usgs-water",
          data: `Water conditions near ${loc.city} from USGS:
Gauge: ${siteName}
Current ${primary.name || "reading"}: ${rounded}${primary.unit ? ` ${primary.unit}` : ""}
Condition: ${label}${extra}

Use this as a local field note: river/creek/lake conditions, runoff, paddling/walking context, or why water nearby might feel especially lively or quiet today. Avoid safety claims unless the source explicitly indicates flooding.`,
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
