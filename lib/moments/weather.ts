export type WeatherData = {
  temp: number;
  code: number;
  /** Hourly cloud cover % for the day (index 0 = midnight, index 23 = 11pm) */
  hourlyCloudCover?: number[];
  /** Hourly precipitation probability % */
  hourlyPrecipProb?: number[];
};

export async function fetchWeather(
  lat: number,
  lng: number
): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&hourly=cloud_cover,precipitation_probability&temperature_unit=fahrenheit&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      temp: Math.round(data.current.temperature_2m),
      code: data.current.weather_code,
      hourlyCloudCover: data.hourly?.cloud_cover ?? undefined,
      hourlyPrecipProb: data.hourly?.precipitation_probability ?? undefined,
    };
  } catch {
    return null;
  }
}
