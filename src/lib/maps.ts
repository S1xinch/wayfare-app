export type App = "apple" | "google" | "waze" | "geo" | "osm";
export type Platform = "ios" | "android" | "desktop";
export type Place = { name: string; query: string; lat?: number; lng?: number };

export const platformOf = (ua: string, maxTouchPoints = 0): Platform =>
  /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1) // iPadOS reports itself as a Mac
    ? "ios"
    : /Android/i.test(ua)
      ? "android"
      : "desktop";

/** Which apps to offer, in order, for each kind of device. "geo" is Android's own chooser: it lists every installed map app. */
const OPTIONS: Record<Platform, { app: App; label: string }[]> = {
  ios: [
    { app: "apple", label: "Apple Maps" },
    { app: "google", label: "Google Maps" },
    { app: "waze", label: "Waze" },
    { app: "osm", label: "OpenStreetMap" },
  ],
  android: [
    { app: "geo", label: "Any map app…" },
    { app: "google", label: "Google Maps" },
    { app: "waze", label: "Waze" },
    { app: "osm", label: "OpenStreetMap" },
  ],
  desktop: [
    { app: "google", label: "Google Maps" },
    { app: "apple", label: "Apple Maps" },
    { app: "waze", label: "Waze" },
    { app: "osm", label: "OpenStreetMap" },
  ],
};

/** The platform's options, with the user's last-used app first. */
export function optionsFor(platform: Platform, last?: string | null) {
  const list = OPTIONS[platform];
  const hit = list.find((o) => o.app === last);
  return hit ? [hit, ...list.filter((o) => o !== hit)] : list;
}

const valid = (lat: unknown, lng: unknown): lat is number =>
  typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * What to show on the map for an itinerary activity. Coordinates win when it has them. Otherwise the location text (or the
 * title) is searched, with the trip's destination added so "Cafe Central" finds the right city. Airports already name
 * themselves, so they are left alone.
 */
export function placeOf(a: { title: string; location?: string; lat?: number; lng?: number }, destination = ""): Place {
  const name = a.title.trim();
  const text = (a.location?.trim() || name).trim();
  const city = destination.trim();
  const needsCity = !valid(a.lat, a.lng) && city && !/\bairport\b/i.test(text) && !text.toLowerCase().includes(city.toLowerCase());
  return { name, query: needsCity ? `${text}, ${city}` : text, ...(valid(a.lat, a.lng) ? { lat: a.lat, lng: a.lng } : {}) };
}

const enc = encodeURIComponent;

export function mapUrl(app: App, p: Place): string {
  const c = valid(p.lat, p.lng) ? `${p.lat},${p.lng}` : null;
  switch (app) {
    case "google":
      return `https://www.google.com/maps/search/?api=1&query=${enc(c ?? p.query)}`;
    case "apple":
      return c ? `https://maps.apple.com/?ll=${enc(c)}&q=${enc(p.name || p.query)}` : `https://maps.apple.com/?q=${enc(p.query)}`;
    case "waze":
      return c ? `https://waze.com/ul?ll=${enc(c)}&navigate=yes` : `https://waze.com/ul?q=${enc(p.query)}&navigate=yes`;
    case "geo":
      return c ? `geo:${c}?q=${c}(${enc(p.name || p.query)})` : `geo:0,0?q=${enc(p.query)}`;
    case "osm":
      return c ? `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}` : `https://www.openstreetmap.org/search?query=${enc(p.query)}`;
  }
}

/** Text for "Copy location": coordinates when known, otherwise the search text. */
export const copyText = (p: Place) => (valid(p.lat, p.lng) ? `${p.lat}, ${p.lng}` : p.query);
