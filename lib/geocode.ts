import tzlookup from "tz-lookup";

export async function geocodeCity(
  city: string
): Promise<{ lat: number; lng: number; timezone: string }> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "JustB/1.0 (zkhowes.fun)" },
  });

  if (!res.ok) {
    throw new Error(`Geocode failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data.length) {
    throw new Error(`No geocode results for "${city}"`);
  }

  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);
  const timezone = tzlookup(lat, lng);

  return { lat, lng, timezone };
}
