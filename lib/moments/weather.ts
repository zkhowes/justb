export async function fetchWeather(
  lat: number,
  lng: number
): Promise<{ temp: number; code: number } | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      temp: Math.round(data.current.temperature_2m),
      code: data.current.weather_code,
    };
  } catch {
    return null;
  }
}
