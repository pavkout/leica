// Cities for the light planner: city-centre coordinates (rounded to 0.01°,
// about 1 km, plenty for sun times) and IANA time zones. Also used to name
// "where you are" by the nearest one, offline: the position never leaves the
// device.

export interface City {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
}

export const CITIES: City[] = [
  // Greece
  { id: "athens", name: "Athens", country: "Greece", lat: 37.98, lon: 23.73, tz: "Europe/Athens" },
  { id: "thessaloniki", name: "Thessaloniki", country: "Greece", lat: 40.64, lon: 22.94, tz: "Europe/Athens" },
  { id: "patras", name: "Patras", country: "Greece", lat: 38.25, lon: 21.73, tz: "Europe/Athens" },
  { id: "heraklion", name: "Heraklion", country: "Greece", lat: 35.34, lon: 25.13, tz: "Europe/Athens" },
  { id: "chania", name: "Chania", country: "Greece", lat: 35.51, lon: 24.02, tz: "Europe/Athens" },
  { id: "larissa", name: "Larissa", country: "Greece", lat: 39.64, lon: 22.42, tz: "Europe/Athens" },
  { id: "volos", name: "Volos", country: "Greece", lat: 39.36, lon: 22.94, tz: "Europe/Athens" },
  { id: "ioannina", name: "Ioannina", country: "Greece", lat: 39.66, lon: 20.85, tz: "Europe/Athens" },
  { id: "kavala", name: "Kavala", country: "Greece", lat: 40.94, lon: 24.41, tz: "Europe/Athens" },
  { id: "rhodes", name: "Rhodes", country: "Greece", lat: 36.43, lon: 28.22, tz: "Europe/Athens" },
  { id: "corfu", name: "Corfu", country: "Greece", lat: 39.62, lon: 19.92, tz: "Europe/Athens" },
  { id: "kalamata", name: "Kalamata", country: "Greece", lat: 37.04, lon: 22.11, tz: "Europe/Athens" },
  { id: "santorini", name: "Santorini (Fira)", country: "Greece", lat: 36.42, lon: 25.43, tz: "Europe/Athens" },
  { id: "mykonos", name: "Mykonos", country: "Greece", lat: 37.45, lon: 25.33, tz: "Europe/Athens" },
  { id: "alexandroupoli", name: "Alexandroupoli", country: "Greece", lat: 40.85, lon: 25.87, tz: "Europe/Athens" },
  // Europe
  { id: "wetzlar", name: "Wetzlar", country: "Germany", lat: 50.56, lon: 8.5, tz: "Europe/Berlin" },
  { id: "berlin", name: "Berlin", country: "Germany", lat: 52.52, lon: 13.4, tz: "Europe/Berlin" },
  { id: "munich", name: "Munich", country: "Germany", lat: 48.14, lon: 11.58, tz: "Europe/Berlin" },
  { id: "hamburg", name: "Hamburg", country: "Germany", lat: 53.55, lon: 9.99, tz: "Europe/Berlin" },
  { id: "amsterdam", name: "Amsterdam", country: "Netherlands", lat: 52.37, lon: 4.89, tz: "Europe/Amsterdam" },
  { id: "brussels", name: "Brussels", country: "Belgium", lat: 50.85, lon: 4.35, tz: "Europe/Brussels" },
  { id: "paris", name: "Paris", country: "France", lat: 48.86, lon: 2.35, tz: "Europe/Paris" },
  { id: "marseille", name: "Marseille", country: "France", lat: 43.3, lon: 5.37, tz: "Europe/Paris" },
  { id: "london", name: "London", country: "United Kingdom", lat: 51.51, lon: -0.13, tz: "Europe/London" },
  { id: "edinburgh", name: "Edinburgh", country: "United Kingdom", lat: 55.95, lon: -3.19, tz: "Europe/London" },
  { id: "dublin", name: "Dublin", country: "Ireland", lat: 53.35, lon: -6.26, tz: "Europe/Dublin" },
  { id: "lisbon", name: "Lisbon", country: "Portugal", lat: 38.72, lon: -9.14, tz: "Europe/Lisbon" },
  { id: "porto", name: "Porto", country: "Portugal", lat: 41.15, lon: -8.61, tz: "Europe/Lisbon" },
  { id: "madrid", name: "Madrid", country: "Spain", lat: 40.42, lon: -3.7, tz: "Europe/Madrid" },
  { id: "barcelona", name: "Barcelona", country: "Spain", lat: 41.39, lon: 2.17, tz: "Europe/Madrid" },
  { id: "rome", name: "Rome", country: "Italy", lat: 41.9, lon: 12.5, tz: "Europe/Rome" },
  { id: "milan", name: "Milan", country: "Italy", lat: 45.46, lon: 9.19, tz: "Europe/Rome" },
  { id: "venice", name: "Venice", country: "Italy", lat: 45.44, lon: 12.32, tz: "Europe/Rome" },
  { id: "naples", name: "Naples", country: "Italy", lat: 40.85, lon: 14.27, tz: "Europe/Rome" },
  { id: "vienna", name: "Vienna", country: "Austria", lat: 48.21, lon: 16.37, tz: "Europe/Vienna" },
  { id: "zurich", name: "Zurich", country: "Switzerland", lat: 47.38, lon: 8.54, tz: "Europe/Zurich" },
  { id: "prague", name: "Prague", country: "Czechia", lat: 50.08, lon: 14.44, tz: "Europe/Prague" },
  { id: "budapest", name: "Budapest", country: "Hungary", lat: 47.5, lon: 19.04, tz: "Europe/Budapest" },
  { id: "warsaw", name: "Warsaw", country: "Poland", lat: 52.23, lon: 21.01, tz: "Europe/Warsaw" },
  { id: "copenhagen", name: "Copenhagen", country: "Denmark", lat: 55.68, lon: 12.57, tz: "Europe/Copenhagen" },
  { id: "stockholm", name: "Stockholm", country: "Sweden", lat: 59.33, lon: 18.07, tz: "Europe/Stockholm" },
  { id: "oslo", name: "Oslo", country: "Norway", lat: 59.91, lon: 10.75, tz: "Europe/Oslo" },
  { id: "helsinki", name: "Helsinki", country: "Finland", lat: 60.17, lon: 24.94, tz: "Europe/Helsinki" },
  { id: "reykjavik", name: "Reykjavík", country: "Iceland", lat: 64.15, lon: -21.94, tz: "Atlantic/Reykjavik" },
  { id: "istanbul", name: "Istanbul", country: "Türkiye", lat: 41.01, lon: 28.98, tz: "Europe/Istanbul" },
  { id: "nicosia", name: "Nicosia", country: "Cyprus", lat: 35.17, lon: 33.36, tz: "Asia/Nicosia" },
  { id: "sofia", name: "Sofia", country: "Bulgaria", lat: 42.7, lon: 23.32, tz: "Europe/Sofia" },
  { id: "bucharest", name: "Bucharest", country: "Romania", lat: 44.43, lon: 26.1, tz: "Europe/Bucharest" },
  // Elsewhere
  { id: "new-york", name: "New York", country: "United States", lat: 40.71, lon: -74.01, tz: "America/New_York" },
  { id: "chicago", name: "Chicago", country: "United States", lat: 41.88, lon: -87.63, tz: "America/Chicago" },
  { id: "san-francisco", name: "San Francisco", country: "United States", lat: 37.77, lon: -122.42, tz: "America/Los_Angeles" },
  { id: "los-angeles", name: "Los Angeles", country: "United States", lat: 34.05, lon: -118.24, tz: "America/Los_Angeles" },
  { id: "toronto", name: "Toronto", country: "Canada", lat: 43.65, lon: -79.38, tz: "America/Toronto" },
  { id: "mexico-city", name: "Mexico City", country: "Mexico", lat: 19.43, lon: -99.13, tz: "America/Mexico_City" },
  { id: "havana", name: "Havana", country: "Cuba", lat: 23.11, lon: -82.37, tz: "America/Havana" },
  { id: "buenos-aires", name: "Buenos Aires", country: "Argentina", lat: -34.6, lon: -58.38, tz: "America/Argentina/Buenos_Aires" },
  { id: "sao-paulo", name: "São Paulo", country: "Brazil", lat: -23.55, lon: -46.63, tz: "America/Sao_Paulo" },
  { id: "cairo", name: "Cairo", country: "Egypt", lat: 30.04, lon: 31.24, tz: "Africa/Cairo" },
  { id: "marrakesh", name: "Marrakesh", country: "Morocco", lat: 31.63, lon: -7.99, tz: "Africa/Casablanca" },
  { id: "cape-town", name: "Cape Town", country: "South Africa", lat: -33.92, lon: 18.42, tz: "Africa/Johannesburg" },
  { id: "dubai", name: "Dubai", country: "United Arab Emirates", lat: 25.2, lon: 55.27, tz: "Asia/Dubai" },
  { id: "mumbai", name: "Mumbai", country: "India", lat: 19.08, lon: 72.88, tz: "Asia/Kolkata" },
  { id: "bangkok", name: "Bangkok", country: "Thailand", lat: 13.76, lon: 100.5, tz: "Asia/Bangkok" },
  { id: "singapore", name: "Singapore", country: "Singapore", lat: 1.35, lon: 103.82, tz: "Asia/Singapore" },
  { id: "hong-kong", name: "Hong Kong", country: "China", lat: 22.32, lon: 114.17, tz: "Asia/Hong_Kong" },
  { id: "shanghai", name: "Shanghai", country: "China", lat: 31.23, lon: 121.47, tz: "Asia/Shanghai" },
  { id: "seoul", name: "Seoul", country: "South Korea", lat: 37.57, lon: 126.98, tz: "Asia/Seoul" },
  { id: "tokyo", name: "Tokyo", country: "Japan", lat: 35.68, lon: 139.65, tz: "Asia/Tokyo" },
  { id: "kyoto", name: "Kyoto", country: "Japan", lat: 35.01, lon: 135.77, tz: "Asia/Tokyo" },
  { id: "sydney", name: "Sydney", country: "Australia", lat: -33.87, lon: 151.21, tz: "Australia/Sydney" },
  { id: "melbourne", name: "Melbourne", country: "Australia", lat: -37.81, lon: 144.96, tz: "Australia/Melbourne" },
  { id: "auckland", name: "Auckland", country: "New Zealand", lat: -36.85, lon: 174.76, tz: "Pacific/Auckland" },
];

/** Great-circle distance, km. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function nearestCity(lat: number, lon: number, cities: City[] = CITIES): { city: City; km: number } {
  let best = cities[0];
  let bestKm = Infinity;
  for (const c of cities) {
    const km = distanceKm(lat, lon, c.lat, c.lon);
    if (km < bestKm) {
      best = c;
      bestKm = km;
    }
  }
  return { city: best, km: bestKm };
}

/** "37.98° N, 23.73° E" */
export function formatCoords(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`;
}
