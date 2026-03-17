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

  return (
    <div
      className={`flex items-center justify-center gap-5 py-2.5 text-xs ${muted}`}
    >
      {data.weather && WeatherIcon && (
        <span className="flex items-center gap-1">
          <WeatherIcon size={14} />
          <span className={primary}>{data.weather.temp}°F</span>
        </span>
      )}

      <span className="flex items-center gap-1">
        <Sunrise size={14} />
        <span className={primary}>{data.sunrise}</span>
      </span>

      <span className="flex items-center gap-1">
        <Sunset size={14} />
        <span className={primary}>{data.sunset}</span>
      </span>

      <span className="flex items-center gap-1">
        <Moon size={14} />
        <span className={primary}>{data.moonPhase}</span>
      </span>
    </div>
  );
}
