import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Snowflake,
  Sunrise,
  Sunset,
  Moon,
  Waves,
  AlertTriangle,
} from "lucide-react";
import { GlyphData } from "@/lib/types";

function weatherIcon(code: number) {
  if (code === 0) return Sun;
  if (code <= 3) return CloudSun;
  if (code <= 48) return CloudFog;
  if (code <= 67) return CloudRain;
  if (code <= 77) return Snowflake;
  if (code <= 82) return CloudRain;
  if (code <= 86) return CloudSnow;
  if (code <= 99) return CloudLightning;
  return Cloud;
}

const isDev = process.env.NODE_ENV !== "production";
const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === "true";

export function Glyphs({
  data,
  isNight,
}: {
  data: GlyphData;
  isNight: boolean;
}) {
  const muted = isNight ? "text-indigo-400" : "text-[var(--text-muted)]";
  const primary = isNight ? "text-indigo-200" : "text-[var(--text-primary)]";

  const WeatherIcon = data.weather ? weatherIcon(data.weather.code) : null;

  // Show errors only to dev / preview users — never to end users in prod
  const showDiagnostics = isDev || isPreview;
  const errorEntries = Object.entries(data.errors ?? {});
  const noteEntries = Object.entries(data.notes ?? {});
  const hasDiagnostics = errorEntries.length > 0 || noteEntries.length > 0;

  // Build tide display string
  const tideLabel = data.tide
    ? data.tide.state === "rising"
      ? data.tide.nextHigh
        ? `↑ high ${data.tide.nextHigh}`
        : "↑ rising"
      : data.tide.nextLow
        ? `↓ low ${data.tide.nextLow}`
        : "↓ falling"
    : null;

  return (
    <div className="py-2.5">
      <div
        className={`flex items-center justify-center gap-5 text-xs ${muted}`}
      >
        {data.weather && WeatherIcon ? (
          <span className="flex items-center gap-1">
            <WeatherIcon size={14} />
            <span className={primary}>{data.weather.temp}°F</span>
          </span>
        ) : showDiagnostics && data.errors?.weather ? (
          <span
            className="flex items-center gap-1 text-amber-500"
            title={`weather: ${data.errors.weather}`}
          >
            <AlertTriangle size={12} />
            weather
          </span>
        ) : null}

        {data.sunrise ? (
          <span className="flex items-center gap-1">
            <Sunrise size={14} />
            <span className={primary}>{data.sunrise}</span>
          </span>
        ) : showDiagnostics && data.errors?.astro ? (
          <span
            className="flex items-center gap-1 text-amber-500"
            title={`astro: ${data.errors.astro}`}
          >
            <AlertTriangle size={12} />
            astro
          </span>
        ) : null}

        {data.sunset && (
          <span className="flex items-center gap-1">
            <Sunset size={14} />
            <span className={primary}>{data.sunset}</span>
          </span>
        )}

        {data.moonPhase && (
          <span className="flex items-center gap-1">
            <Moon size={14} />
            <span className={primary}>{data.moonPhase}</span>
          </span>
        )}

        {tideLabel ? (
          <span className="flex items-center gap-1">
            <Waves size={14} />
            <span className={primary}>{tideLabel}</span>
          </span>
        ) : showDiagnostics && data.errors?.tide ? (
          <span
            className="flex items-center gap-1 text-amber-500"
            title={`tide: ${data.errors.tide}`}
          >
            <AlertTriangle size={12} />
            tide
          </span>
        ) : null}
      </div>

      {showDiagnostics && hasDiagnostics && (
        <div className="mt-1 px-3 text-center text-[10px] text-[var(--text-muted)]/70 leading-tight">
          {errorEntries.map(([k, v]) => (
            <div key={`err-${k}`} className="text-amber-500/80">
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
