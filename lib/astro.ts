import SunCalc from "suncalc";

const PHASE_NAMES = [
  "New Moon",
  "Waxing Crescent",
  "First Quarter",
  "Waxing Gibbous",
  "Full Moon",
  "Waning Gibbous",
  "Last Quarter",
  "Waning Crescent",
] as const;

function getPhaseName(phase: number): string {
  // phase is 0..1, divide into 8 segments
  const idx = Math.round(phase * 8) % 8;
  return PHASE_NAMES[idx];
}

function formatTime(date: Date, timezone: string): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

export function getAstroData(
  lat: number,
  lng: number,
  date: Date,
  timezone: string
) {
  const moonIllum = SunCalc.getMoonIllumination(date);
  const moonTimes = SunCalc.getMoonTimes(date, lat, lng);
  const sunTimes = SunCalc.getTimes(date, lat, lng);

  return {
    timezone,
    moonPhase: getPhaseName(moonIllum.phase),
    moonIllumination: Math.round(moonIllum.fraction * 100),
    moonrise: moonTimes.rise
      ? formatTime(moonTimes.rise, timezone)
      : "does not rise",
    moonset: moonTimes.set
      ? formatTime(moonTimes.set, timezone)
      : "does not set",
    sunrise: formatTime(sunTimes.sunrise, timezone),
    sunset: formatTime(sunTimes.sunset, timezone),
  };
}
