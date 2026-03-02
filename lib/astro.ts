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

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function getAstroData(lat: number, lng: number, date: Date) {
  const moonIllum = SunCalc.getMoonIllumination(date);
  const moonTimes = SunCalc.getMoonTimes(date, lat, lng);
  const sunTimes = SunCalc.getTimes(date, lat, lng);

  return {
    moonPhase: getPhaseName(moonIllum.phase),
    moonIllumination: Math.round(moonIllum.fraction * 100),
    moonrise: moonTimes.rise ? formatTime(moonTimes.rise) : "does not rise",
    moonset: moonTimes.set ? formatTime(moonTimes.set) : "does not set",
    sunrise: formatTime(sunTimes.sunrise),
    sunset: formatTime(sunTimes.sunset),
  };
}
