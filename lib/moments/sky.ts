import SunCalc from "suncalc";
import { getAstroData } from "../astro";
import { MomentContext, LocationContext } from "./types";
import { WeatherData } from "./weather";

function formatTime(date: Date, timezone: string): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function minutesBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 60000);
}

export async function fetchSkyMoments(
  loc: LocationContext,
  weather?: WeatherData | null
): Promise<MomentContext[]> {
  const now = new Date();
  const astro = getAstroData(loc.lat, loc.lng, now, loc.timezone);
  const sunTimes = SunCalc.getTimes(now, loc.lat, loc.lng);

  const lines: string[] = [];

  // Golden hour windows
  if (sunTimes.goldenHour && sunTimes.sunset) {
    const goldenStart = formatTime(sunTimes.goldenHour, loc.timezone);
    const goldenDuration = minutesBetween(sunTimes.goldenHour, sunTimes.sunset);
    lines.push(`Evening golden hour: ${goldenStart} — ${astro.sunset} (${goldenDuration} min).`);
  }
  // Morning golden hour (dawn → golden hour end)
  if (sunTimes.goldenHourEnd && sunTimes.sunrise) {
    const morningEnd = formatTime(sunTimes.goldenHourEnd, loc.timezone);
    lines.push(`Morning golden hour: ${astro.sunrise} — ${morningEnd}.`);
  }

  // Sunset quality based on cloud cover at sunset hour
  if (weather?.hourlyCloudCover && sunTimes.sunset) {
    const sunsetHour = parseInt(
      sunTimes.sunset.toLocaleTimeString("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: loc.timezone,
      })
    );
    const cloudAtSunset = weather.hourlyCloudCover[sunsetHour] ?? 50;
    const precipAtSunset = weather.hourlyPrecipProb?.[sunsetHour] ?? 0;

    if (precipAtSunset < 20) {
      if (cloudAtSunset <= 15) {
        lines.push(`Sunset quality: excellent — clear skies at ${astro.sunset}. Great evening for a walk.`);
      } else if (cloudAtSunset <= 40) {
        lines.push(`Sunset quality: good — scattered clouds at ${astro.sunset} could catch some color.`);
      } else if (cloudAtSunset <= 70) {
        lines.push(`Sunset quality: moderate — partly cloudy at sunset.`);
      }
    }
  }

  // Daylight duration + meaningful milestones
  if (sunTimes.sunrise && sunTimes.sunset) {
    const daylightMins = minutesBetween(sunTimes.sunrise, sunTimes.sunset);
    const daylightHrs = Math.floor(daylightMins / 60);
    const daylightRemMins = daylightMins % 60;

    // Compare to yesterday
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdaySun = SunCalc.getTimes(yesterday, loc.lat, loc.lng);
    if (yesterdaySun.sunrise && yesterdaySun.sunset) {
      const yesterdayMins = minutesBetween(yesterdaySun.sunrise, yesterdaySun.sunset);
      const diff = daylightMins - yesterdayMins;

      // Check for solstice proximity (daylight change flips sign)
      const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
      const twoDaysAgoSun = SunCalc.getTimes(twoDaysAgo, loc.lat, loc.lng);
      const prevDiff = twoDaysAgoSun.sunrise && twoDaysAgoSun.sunset
        ? minutesBetween(twoDaysAgoSun.sunrise, twoDaysAgoSun.sunset) - yesterdayMins
        : 0;

      let milestone = "";
      // Equinox/solstice proximity: daylight change direction flipped
      if (prevDiff !== 0 && diff !== 0 && Math.sign(prevDiff) !== Math.sign(diff)) {
        if (diff < 0) {
          milestone = " — today marks the start of shortening days.";
        } else {
          milestone = " — today marks the start of lengthening days.";
        }
      }
      // 12-hour crossing
      else if (yesterdayMins < 720 && daylightMins >= 720) {
        milestone = " — today crosses 12 hours of daylight.";
      }

      const absDiff = Math.abs(diff);
      if (absDiff >= 1) {
        const moreOrLess = diff > 0 ? "more" : "less";
        lines.push(`${daylightHrs}h ${daylightRemMins}m of daylight today — ${absDiff} minute${absDiff > 1 ? "s" : ""} ${moreOrLess} than yesterday${milestone}`);
      }
    }
  }

  return [
    {
      category: "sky-space",
      source: "suncalc+weather",
      data: lines.length > 0
        ? `Sky data for ${loc.city}:\n${lines.join("\n")}\n\nNote: sunrise/sunset times are shown separately in the glyphs UI — do NOT repeat them. Focus on golden hour, sunset quality, daylight milestones, visible planets, and constellations for the season.`
        : `Sunrise ${astro.sunrise}, sunset ${astro.sunset} (${loc.timezone}). Focus on visible planets and constellations for the season — do NOT repeat sunrise/sunset times (shown in glyphs UI).`,
    },
  ];
}
