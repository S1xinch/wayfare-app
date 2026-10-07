export type Side = {
  airport: string;
  iata: string;
  terminal: string;
  gate: string;
  baggage: string;
  scheduled: string;
  estimated: string;
  actual: string;
};
export type FlightStatus = {
  flight: string;
  date: string;
  status: string; // scheduled | active | landed | cancelled | incident | diverted
  delayMin: number;
  airline: string;
  dep: Side;
  arr: Side;
};

/** "DL 742", "dl742", "DL-742" or "DL0742" -> "DL742"; null if it is not an airline code plus number. Takes the first leg of "DL 742, DL 99". */
export function flightCode(s: string) {
  const m = /^([A-Z0-9]{2})[\s.-]*(\d{1,4}[A-Z]?)$/i.exec(s.split(",")[0].trim());
  return m ? `${m[1]}${m[2].replace(/^0+(?=\d)/, "")}`.toUpperCase() : null;
}

/** Does a flight number such as "BA 117" match what the user typed ("ba117", "BA-117", "BA0117", "117")? Spaces, dashes, case and leading zeros are ignored. */
export function sameFlight(flightNumber: string, query: string) {
  const norm = (s: string) => s.replace(/[\s.-]+/g, "").toUpperCase().replace(/^([A-Z][A-Z0-9]|[A-Z0-9][A-Z])0+(?=\d)/, "$1");
  const q = norm(query);
  return q.length > 0 && norm(flightNumber).includes(q);
}

const str = (v: unknown) => String(v ?? "").trim();
/* eslint-disable @typescript-eslint/no-explicit-any */
const side = (s: any): Side => ({
  airport: str(s?.airport),
  iata: str(s?.iata),
  terminal: str(s?.terminal),
  gate: str(s?.gate),
  baggage: str(s?.baggage),
  scheduled: str(s?.scheduled),
  estimated: str(s?.estimated),
  actual: str(s?.actual),
});

/** Pick the record for the travel date (real-time data is for today), else the most recent one. */
export function pickFlight(rows: any[], date: string) {
  const list = Array.isArray(rows) ? rows : [];
  return list.find((r) => r?.flight_date === date) ?? list[0] ?? null;
}

export function normalizeStatus(row: any): FlightStatus {
  const delay = Number(row?.arrival?.delay ?? row?.departure?.delay ?? 0);
  return {
    flight: str(row?.flight?.iata),
    date: str(row?.flight_date),
    status: str(row?.flight_status) || "unknown",
    delayMin: Number.isFinite(delay) ? delay : 0,
    airline: str(row?.airline?.name),
    dep: side(row?.departure),
    arr: side(row?.arrival),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
