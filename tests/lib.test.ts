import assert from "node:assert/strict";
import { test } from "node:test";
import { searchAirports, toAirport, type AirportRow } from "../src/lib/airports.ts";
import { dealInfo } from "../src/lib/deals.ts";
import { flightCode, normalizeStatus, pickFlight, sameFlight } from "../src/lib/flightstatus.ts";
import { fromFli } from "../src/lib/fromfli.ts";
import { parseParams } from "../src/lib/links.ts";
import { hourOf, normalize } from "../src/lib/normalize.ts";

// Trimmed from a real Bright Data "Google Flights discover" row (JFK -> LAX, one way).
const row = {
  itinerary_id: "ABC",
  pricing: { best_total_price: 294, currency: "USD", typical_range_low: 205, typical_range_high: 710 },
  providers: [
    { provider_name: "Delta", provider_type: "Airline", primary_price: 349, link: "https://www.google.com/travel/clk/f?u=b" },
    { provider_name: "Delta", provider_type: "Airline", primary_price: 294, link: "https://www.google.com/travel/clk/f?u=a" },
  ],
  legs: [
    {
      leg_title: "Departing flight  Thu, Dec 17",
      date: "2026-12-17T00:00:00.000Z",
      emissions_text: "244 kg CO2e",
      amenity_badges: ["Free Wi-Fi"],
      stops: "0",
      origin_airport: "JFK",
      destination_airport: "LAX",
      depart_local: "7",
      arrive_local: "10:15",
      segments: [
        {
          airline_name: "Delta", marketing_code: "DL", flight_number: "742", aircraft_name: "Boeing 767",
          depart_time: "7", depart_airport_iata: "JFK", arrive_time: "10:15", arrive_airport_iata: "LAX",
          segment_travel_time_text: "Travel time: 6 hr 15 min", layover_after: null,
        },
      ],
    },
  ],
};

test("normalize reads a Bright Data itinerary row", () => {
  const [f] = normalize([row]);
  assert.equal(f.price, 294);
  assert.equal(f.currency, "USD");
  assert.equal(f.airline, "Delta");
  assert.equal(f.flightNumber, "DL 742");
  assert.equal(f.departure, "7:00");
  assert.equal(f.arrival, "10:15");
  assert.equal(f.durationMin, 375);
  assert.equal(f.stops, 0);
  assert.equal(f.emissionsKg, 244);
  assert.equal(f.aircraft, "Boeing 767");
  assert.equal(f.typicalHigh, 710);
  assert.equal(f.bookingProvider, "Delta");
  assert.equal(f.bookingUrl, "https://www.google.com/travel/clk/f?u=a"); // cheapest provider
});

test("normalize skips error rows and rejects non-https booking links", () => {
  assert.equal(normalize([{ error: "Parse error", error_code: "parse_error" }, { nope: 1 }]).length, 0);
  const bad = { ...row, providers: [{ provider_name: "X", primary_price: 100, link: "javascript:alert(1)" }] };
  assert.equal(normalize([bad])[0].bookingUrl, "");
  assert.equal(hourOf("2026-12-01T18:05:00"), 18);
  assert.equal(hourOf("7:05 PM"), 19);
});

test("searchAirports matches city, name, code and metro, main airport first", () => {
  const list = (
    [
      ["EWR", "Newark Liberty International Airport", "Newark", "US", 2],
      ["LGA", "LaGuardia Airport", "New York", "US", 2],
      ["JFK", "John F. Kennedy International Airport", "New York", "US", 2],
      ["LHR", "London Heathrow Airport", "London", "GB", 2],
      ["ZRH", "Zürich Airport", "Zürich", "CH", 2],
    ] as AirportRow[]
  ).map(toAirport);
  const codes = (q: string) => searchAirports(list, q).map((a) => a.code);
  assert.deepEqual(codes("new york"), ["JFK", "EWR", "LGA"]); // JFK first; EWR found through the metro name
  assert.deepEqual(codes("nyc"), ["JFK", "EWR", "LGA"]);
  assert.equal(codes("heathrow")[0], "LHR");
  assert.equal(codes("lhr")[0], "LHR");
  assert.equal(codes("zurich")[0], "ZRH"); // accent-insensitive
  assert.equal(codes("switz")[0], "ZRH"); // country name
  assert.deepEqual(codes("j"), []); // needs 2+ characters
});

test("dealInfo flags <=90% of 30d avg, needs 3 samples", () => {
  const now = Date.now();
  const day = 864e5;
  const hist = [100, 100, 100, 100].map((price, i) => ({ price, ts: now - (i + 1) * day }));
  assert.equal(dealInfo(90, hist, now).isDeal, true);
  assert.equal(dealInfo(91, hist, now).isDeal, false);
  assert.equal(dealInfo(110, hist, now).isHigh, true);
  assert.equal(dealInfo(50, hist.slice(0, 2), now).isDeal, false);
  assert.equal(dealInfo(1, [], now).avg30, null);
});

test("flight status: code parsing, picking the travel day, normalising", () => {
  assert.equal(flightCode("DL 742"), "DL742");
  assert.equal(flightCode("dl742, DL 99"), "DL742"); // first leg of a connection
  assert.equal(flightCode("not a flight"), null);
  assert.equal(flightCode("BA117"), "BA117"); // no space
  assert.equal(flightCode("  ba   117 "), "BA117"); // extra spaces
  assert.equal(flightCode("BA-117"), "BA117");
  assert.equal(flightCode("ba0117"), "BA117"); // leading zeros
  assert.equal(flightCode("U2 1234"), "U21234"); // airline code with a digit
  assert.equal(flightCode("BA"), null);
  const rows = [
    { flight_date: "2026-10-06", flight_status: "landed", departure: { iata: "JFK" }, arrival: { iata: "LAX" }, flight: { iata: "DL742" } },
    {
      flight_date: "2026-10-07",
      flight_status: "active",
      airline: { name: "Delta" },
      flight: { iata: "DL742" },
      departure: { iata: "JFK", terminal: "4", gate: "B22", delay: 12, scheduled: "2026-10-07T07:00:00+00:00" },
      arrival: { iata: "LAX", delay: 20, baggage: "4" },
    },
  ];
  const s = normalizeStatus(pickFlight(rows, "2026-10-07"));
  assert.equal(s.status, "active");
  assert.equal(s.delayMin, 20); // arrival delay wins
  assert.equal(s.dep.gate, "B22");
  assert.equal(s.arr.baggage, "4");
  assert.equal(s.airline, "Delta");
  assert.equal(pickFlight(rows, "2030-01-01")?.flight_date, "2026-10-06"); // no match: first row
  assert.equal(pickFlight([], "2026-10-07"), null);
});

test("fromFli maps one-way and round-trip rows from the direct search", () => {
  const leg = (al: string, no: string, from: string, to: string, dep: string, arr: string, dur: number) => ({
    airline: al, flight_number: no, departure_airport: from, arrival_airport: to,
    departure_datetime: new Date(dep), arrival_datetime: new Date(arr), duration: dur,
    aircraft: "Boeing 737", legroom_short: "30 in",
    amenities: { wifi: true, wifi_tier: "free", power: true, usb_power: null }, co2_emissions_g: 228000,
  });
  const out = {
    legs: [leg("B6", "1524", "JFK", "LAX", "2026-12-21T07:30:00Z", "2026-12-21T10:45:00Z", 375)],
    price: 510, currency: "USD", duration: 375, stops: 0, co2_emissions_g: 228000, primary_airline: "B6", primary_airline_name: "JetBlue",
  };
  const ret = { ...out, legs: [leg("B6", "1525", "LAX", "JFK", "2026-12-28T10:00:00Z", "2026-12-28T18:20:00Z", 320)], price: 579, duration: 320 };
  const url = () => "https://www.google.com/travel/flights/booking?tfs=x";

  const [one] = fromFli([out], url);
  assert.equal(one.price, 510);
  assert.equal(one.airline, "JetBlue");
  assert.equal(one.flightNumber, "B6 1524");
  assert.equal(one.departure, "07:30"); // local clock time, 24-hour
  assert.equal(one.arrival, "10:45");
  assert.equal(one.emissionsKg, 228);
  assert.equal(one.aircraft, "Boeing 737");
  assert.ok(one.amenities.includes("Free Wi-Fi"));
  assert.equal(one.bookingProvider, "Google Flights");
  assert.equal(one.legs.length, 1);

  const [rt] = fromFli([[out, ret]], url);
  assert.equal(rt.price, 579); // the return half carries the round-trip total
  assert.equal(rt.legs.length, 2);
  assert.equal(rt.legs[1].title, "Return");
  assert.equal(rt.legs[1].date, "2026-12-28");

  assert.equal(fromFli([{ ...out, price: 0 }], url).length, 0); // unpriced rows are skipped
  assert.equal(fromFli([out, out], url).length, 1); // duplicates collapse
  assert.equal(fromFli([out], () => "http://insecure")[0].bookingUrl, ""); // only https links are kept
});

test("sameFlight matches flight numbers ignoring spaces and case", () => {
  assert.equal(sameFlight("BA 117", "ba117"), true);
  assert.equal(sameFlight("BA 117", "BA 117"), true);
  assert.equal(sameFlight("BA 117", "BA-117"), true);
  assert.equal(sameFlight("BA 117", "BA0117"), true);
  assert.equal(sameFlight("BA 0117", "ba117"), true);
  assert.equal(sameFlight("BA 1170", "BA 117"), true); // prefix of a longer number: still shown, the user can refine
  assert.equal(sameFlight("BA 117", "AA 117"), false);
  assert.equal(sameFlight("BA 117", "  "), false); // an empty query never matches (the filter treats it as "off")
});

test("parseParams validates", () => {
  const q = (o: Record<string, string>) => parseParams((k) => o[k] ?? null);
  const future = "2999-01-01";
  assert.equal(typeof q({ o: "jfk", d: "lax", dep: future }), "object");
  assert.equal(typeof q({ o: "jfk", d: "jfk", dep: future }), "string");
  assert.equal(typeof q({ o: "jf", d: "lax", dep: future }), "string");
  assert.equal(typeof q({ o: "jfk", d: "lax", dep: future, ret: "2998-01-01" }), "string");
  assert.equal(typeof q({ o: "jfk", d: "lax", dep: future, pax: "12" }), "string");
});
