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
  // phase is 0..1; floor into 8 equal segments so transitional phases
  // (crescent/gibbous) span the full range between cardinal points
  // (new → 0, first-quarter → 0.25, full → 0.5, last-quarter → 0.75)
  const idx = Math.floor(phase * 8) % 8;
  return PHASE_NAMES[idx];
}

function formatTime(date: Date, timezone: string): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

/** Return a Date representing midnight local time (as UTC instant) for the given IANA timezone. */
function startOfLocalDay(date: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)!.value);
  const elapsedMs = (get("hour") * 3600 + get("minute") * 60 + get("second")) * 1000;
  return new Date(date.getTime() - elapsedMs);
}

export function getAstroData(
  lat: number,
  lng: number,
  date: Date,
  timezone: string
) {
  // Use start of local day for all calculations so the search window matches
  // the user's calendar day and phase/illumination match weather services.
  const dayStart = startOfLocalDay(date, timezone);

  const moonIllum = SunCalc.getMoonIllumination(dayStart);
  const moonTimes = SunCalc.getMoonTimes(dayStart, lat, lng);
  const sunTimes = SunCalc.getTimes(dayStart, lat, lng);

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
