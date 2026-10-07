import assert from "node:assert/strict";
import { test } from "node:test";
import { copyText, mapUrl, optionsFor, placeOf, platformOf } from "../src/lib/maps.ts";

test("platformOf: phones, iPad in desktop mode, Android, desktop", () => {
  assert.equal(platformOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1"), "ios");
  assert.equal(platformOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15", 5), "ios"); // iPadOS
  assert.equal(platformOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15", 0), "desktop"); // a real Mac
  assert.equal(platformOf("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"), "android");
  assert.equal(platformOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"), "desktop");
});

test("optionsFor: each platform leads with its own app, and the last-used app moves to the top", () => {
  assert.deepEqual(optionsFor("ios").map((o) => o.app), ["apple", "google", "waze", "osm"]);
  assert.deepEqual(optionsFor("android").map((o) => o.app), ["geo", "google", "waze", "osm"]); // geo = the system's "open with" chooser
  assert.deepEqual(optionsFor("desktop").map((o) => o.app), ["google", "apple", "waze", "osm"]);
  assert.deepEqual(optionsFor("ios", "waze").map((o) => o.app), ["waze", "apple", "google", "osm"]);
  assert.deepEqual(optionsFor("ios", "geo").map((o) => o.app), ["apple", "google", "waze", "osm"]); // not offered on iOS: ignored
  assert.deepEqual(optionsFor("desktop", null).map((o) => o.app), ["google", "apple", "waze", "osm"]);
});

test("placeOf: coordinates win; text searches get the trip's destination unless already there or an airport", () => {
  assert.deepEqual(placeOf({ title: "Belem Tower", location: "Lisbon", lat: 38.69, lng: -9.21 }, "Lisbon"), { name: "Belem Tower", query: "Lisbon", lat: 38.69, lng: -9.21 });
  assert.equal(placeOf({ title: "Lunch", location: "Cafe Central" }, "Vienna").query, "Cafe Central, Vienna");
  assert.equal(placeOf({ title: "Lunch", location: "Cafe Central, Vienna" }, "Vienna").query, "Cafe Central, Vienna"); // no duplicate city
  assert.equal(placeOf({ title: "Walk", location: "" }, "Rome").query, "Walk, Rome"); // falls back to the title
  assert.equal(placeOf({ title: "JQ 657: CBR to BNE", location: "Canberra Airport" }, "Brisbane").query, "Canberra Airport"); // airports name themselves
  assert.equal(placeOf({ title: "Hike", location: "Mt Fuji" }).query, "Mt Fuji"); // no destination known
  assert.equal(placeOf({ title: "x", location: "Park", lat: 200, lng: 5 }, "Oslo").lat, undefined); // out-of-range coordinates are ignored
  assert.equal(placeOf({ title: "x", location: "Park", lat: Number.NaN, lng: 5 }, "Oslo").query, "Park, Oslo");
});

test("mapUrl: a working link for every app, with and without coordinates", () => {
  const at = { name: "Eiffel Tower", query: "Paris", lat: 48.8584, lng: 2.2945 };
  const text = { name: "Cafe & Bar", query: "Cafe & Bar, Vienna" };
  assert.equal(mapUrl("google", at), "https://www.google.com/maps/search/?api=1&query=48.8584%2C2.2945");
  assert.equal(mapUrl("google", text), "https://www.google.com/maps/search/?api=1&query=Cafe%20%26%20Bar%2C%20Vienna");
  assert.equal(mapUrl("apple", at), "https://maps.apple.com/?ll=48.8584%2C2.2945&q=Eiffel%20Tower");
  assert.equal(mapUrl("apple", text), "https://maps.apple.com/?q=Cafe%20%26%20Bar%2C%20Vienna");
  assert.equal(mapUrl("waze", at), "https://waze.com/ul?ll=48.8584%2C2.2945&navigate=yes");
  assert.equal(mapUrl("waze", text), "https://waze.com/ul?q=Cafe%20%26%20Bar%2C%20Vienna&navigate=yes");
  assert.equal(mapUrl("geo", at), "geo:48.8584,2.2945?q=48.8584,2.2945(Eiffel%20Tower)");
  assert.equal(mapUrl("geo", text), "geo:0,0?q=Cafe%20%26%20Bar%2C%20Vienna");
  assert.equal(mapUrl("osm", at), "https://www.openstreetmap.org/?mlat=48.8584&mlon=2.2945#map=17/48.8584/2.2945");
  assert.equal(mapUrl("osm", text), "https://www.openstreetmap.org/search?query=Cafe%20%26%20Bar%2C%20Vienna");
});

test("copyText: coordinates when known, else the search text", () => {
  assert.equal(copyText({ name: "a", query: "q", lat: 1.5, lng: -2 }), "1.5, -2");
  assert.equal(copyText({ name: "a", query: "Some Place, Rome" }), "Some Place, Rome");
});
