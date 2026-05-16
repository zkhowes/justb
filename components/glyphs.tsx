import { GlyphData } from "@/lib/types";

const isDev = process.env.NODE_ENV !== "production";
const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === "true";

const WEATHER_LABEL: Record<number, string> = {
  0: "clear",
};
function weatherLabel(code: number): string {
  if (code in WEATHER_LABEL) return WEATHER_LABEL[code];
  if (code <= 3) return "partly";
  if (code <= 48) return "fog";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "showers";
  if (code <= 86) return "snow";
  if (code <= 99) return "storms";
  return "clouds";
}

type Cell = { value: string; label: string };

function buildCells(data: GlyphData): Cell[] {
  const cells: Cell[] = [];

  if (data.weather) {
    cells.push({
      value: `${data.weather.temp}°`,
      label: weatherLabel(data.weather.code),
    });
  }
  if (data.sunrise) {
    cells.push({ value: data.sunrise, label: "rise" });
  }
  if (data.sunset) {
    cells.push({ value: data.sunset, label: "sunset" });
  }
  if (data.moonPhase) {
    cells.push({ value: moonGlyph(data.moonPhase), label: data.moonPhase });
  }

  // Tide vs. air vs. water — only one fits comfortably in a 5-cell row.
  if (data.tide) {
    const t = data.tide;
    const next = t.state === "rising" ? t.nextHigh : t.nextLow;
    cells.push({
      value: next || (t.state === "rising" ? "↑" : "↓"),
      label: t.state === "rising" ? "tide ↑" : "tide ↓",
    });
  } else if (data.air?.value || data.air?.label) {
    cells.push({
      value: data.air.value || data.air.label,
      label: "air",
    });
  } else if (data.water?.value || data.water?.label) {
    cells.push({
      value: data.water.value || data.water.label,
      label: "water",
    });
  }

  return cells;
}

function moonGlyph(phase: string): string {
  // Best-effort glyph based on common moon phase names; otherwise show first letter.
  const map: Record<string, string> = {
    "new moon": "🌑",
    "waxing crescent": "🌒",
    "first quarter": "🌓",
    "waxing gibbous": "🌔",
    "full moon": "🌕",
    "waning gibbous": "🌖",
    "last quarter": "🌗",
    "waning crescent": "🌘",
  };
  return map[phase.toLowerCase()] ?? "○";
}

export function Glyphs({ data }: { data: GlyphData; isNight?: boolean }) {
  const cells = buildCells(data);
  if (cells.length === 0) return null;

  const showDiagnostics = isDev || isPreview;
  const errorEntries = Object.entries(data.errors ?? {});
  const noteEntries = Object.entries(data.notes ?? {});
  const hasDiagnostics =
    showDiagnostics && (errorEntries.length > 0 || noteEntries.length > 0);

  return (
    <div>
      <div
        className="flex items-center justify-between"
        style={{
          padding: "10px 0",
          borderTop: "1px solid var(--rule)",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        {cells.map((cell, i) => (
          <div
            key={i}
            className="flex items-center"
            style={{ flex: 1, justifyContent: "center" }}
          >
            <div className="flex flex-col items-center" style={{ minWidth: 36 }}>
              <span
                className="font-serif"
                style={{
                  fontSize: 13,
                  color: "var(--text-primary)",
                  fontFeatureSettings: '"tnum"',
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.1,
                }}
              >
                {cell.value}
              </span>
              <span
                className="font-sans uppercase"
                style={{
                  fontSize: 8.5,
                  letterSpacing: "0.16em",
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                {cell.label}
              </span>
            </div>
            {i < cells.length - 1 && (
              <span
                aria-hidden
                style={{
                  width: 22,
                  height: 1,
                  background: "var(--rule)",
                  margin: "0 6px",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {hasDiagnostics && (
        <div
          className="font-sans"
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            opacity: 0.8,
            padding: "6px 4px 0",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {errorEntries.map(([k, v]) => (
            <div key={`err-${k}`}>
              {k} error: {v}
            </div>
          ))}
          {noteEntries.map(([k, v]) => (
            <div key={`note-${k}`}>
              {k}: {v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
