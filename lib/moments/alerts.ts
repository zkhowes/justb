import { MomentContext, LocationContext } from "./types";

export interface AlertGlyph {
  count: number;
  label: string;
}

export type AlertResult = {
  moments: MomentContext[];
  glyph: AlertGlyph | null;
  error?: string;
  note?: string;
};

interface NwsAlert {
  properties?: {
    event?: string;
    severity?: string;
    certainty?: string;
    headline?: string;
    description?: string;
    areaDesc?: string;
  };
}

export async function fetchAlertMoments(loc: LocationContext): Promise<AlertResult> {
  try {
    const url = new URL("https://api.weather.gov/alerts/active");
    url.searchParams.set("point", `${loc.lat},${loc.lng}`);

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/geo+json",
        "User-Agent": "JustB/1.0 (local almanac; contact: justb.zkhowes.fun)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { moments: [], glyph: null, error: `NWS alerts HTTP ${res.status}` };

    const json: { features?: NwsAlert[] } = await res.json();
    const alerts = (json.features ?? [])
      .map((a) => a.properties)
      .filter((a): a is NonNullable<NwsAlert["properties"]> => !!a?.event);

    if (alerts.length === 0) {
      return { moments: [], glyph: { count: 0, label: "clear" }, note: "no active NWS alerts" };
    }

    const meaningful = alerts.filter((a) => {
      const sev = (a.severity ?? "").toLowerCase();
      return sev === "extreme" || sev === "severe" || sev === "moderate";
    });
    const selected = (meaningful.length > 0 ? meaningful : alerts).slice(0, 3);
    const lines = selected.map((a) => {
      const parts = [a.event];
      if (a.severity) parts.push(`severity: ${a.severity}`);
      if (a.headline) parts.push(`headline: ${a.headline}`);
      return parts.join(" — ");
    });

    return {
      glyph: { count: alerts.length, label: alerts.length === 1 ? "1 alert" : `${alerts.length} alerts` },
      moments: [
        {
          category: "civic",
          source: "nws-alerts",
          data: `Active local alerts for ${loc.city} from the National Weather Service:
${lines.join("\n")}

Only include this if the alert materially affects being outside, getting around, or choosing what to do today. Keep it calm, practical, and brief.`,
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
