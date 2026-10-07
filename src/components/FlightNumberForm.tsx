"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { flightCode } from "@/lib/flightstatus";

/** "Find a flight by number": resolves the route, then opens the normal results filtered to that flight on that date. */
export default function FlightNumberForm() {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const code = flightCode(String(fd.get("flight") ?? ""));
    const date = String(fd.get("fdate") ?? "");
    if (!code) return setErr("Enter a flight number like BA 117.");
    if (!date) return setErr("Choose the date of the flight.");
    setErr("");
    setBusy(true);
    const r = await fetch(`/api/flightnumber?flight=${encodeURIComponent(code)}&date=${date}`);
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? (r.status >= 500 ? "Flight number lookup is unavailable right now. Try again later." : "Could not look that up."));
    if (!j.found) return setErr(`We could not find ${code} in today's live schedule, so we cannot tell its route. Search by route above instead.`);
    router.push(`/results?${new URLSearchParams({ o: j.o, d: j.d, dep: date, pax: "1", cabin: "economy", fn: code })}`);
  }

  return (
    <form onSubmit={submit} noValidate className="card grid max-w-4xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" aria-labelledby="fn-title">
      <h2 id="fn-title" className="text-lg sm:col-span-3">Find a flight by number</h2>
      <div>
        <label htmlFor="flight">Flight number</label>
        <input id="flight" name="flight" className="input uppercase" placeholder="BA 117" autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-invalid={!!err} />
      </div>
      <div>
        <label htmlFor="fdate">Date of the flight</label>
        <input id="fdate" name="fdate" type="date" min={today} className="input" />
      </div>
      <button className="btn" disabled={busy}>{busy ? "Looking up…" : "Find flight"}</button>
      {err && <p role="alert" className="err sm:col-span-3">{err}</p>}
    </form>
  );
}
