import { useRef, useState } from 'react'
import { uid, updateTrip, useAppDispatch } from '../store'
import type { Trip } from '../types'
import { dailyBudget, fetchElements, rank, type Idea } from '../suggest'
import { fmt } from '../pages/Home'

export default function Ideas({ trip }: { trip: Trip }) {
  const dispatch = useAppDispatch()
  const [ideas, setIdeas] = useState<Idea[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [dayId, setDayId] = useState(trip.itinerary[0]?.id ?? '')
  const ctl = useRef<AbortController>(undefined)
  const daily = dailyBudget(trip, new Date().toISOString().slice(0, 10))

  async function find() {
    ctl.current?.abort()
    const c = (ctl.current = new AbortController())
    const timer = setTimeout(() => c.abort(), 25000)
    setBusy(true); setErr('')
    try { setIdeas(rank(await fetchElements(trip.destination, c.signal), daily)) }
    catch (e) { setErr(!navigator.onLine ? 'You are offline. Connect to find ideas.' : c.signal.aborted ? 'That took too long. Try again.' : (e as Error).message) }
    finally { clearTimeout(timer); setBusy(false) }
  }

  function add(i: Idea) {
    const act = { id: uid(), time: '10:00', title: i.name, location: trip.destination, description: i.kind, lat: i.lat, lng: i.lng }
    dispatch(updateTrip({ id: trip.id, itinerary: trip.itinerary.map((d) => d.id === dayId ? { ...d, activities: [...d.activities, act].sort((a, b) => a.time.localeCompare(b.time)) } : d) }))
  }

  return (
    <section>
      <div className="card mb-5">
        <p>Daily budget left: <strong className="mono">{fmt(daily)}</strong></p>
        <p className="caption">Budget minus expenses so far, spread over the days left. Assumes expenses are in the same currency as the budget. Prices are rough USD estimates by category, not live prices.</p>
        <p className="caption mb-3">“Find ideas” sends “{trip.destination}” to OpenStreetMap services.</p>
        <button className="btn" onClick={find} disabled={busy || daily <= 0}>{busy ? 'Searching…' : 'Find ideas'}</button>
        {daily <= 0 && <p className="mt-2 text-danger">No budget left to suggest from.</p>}
      </div>
      {err && <p role="alert" className="mb-4 text-danger">{err}</p>}
      {ideas && ideas.length === 0 && <p>Nothing fits your daily budget nearby.</p>}
      {ideas && ideas.length > 0 && (
        <>
          <label className="label mb-3 max-w-xs">Add to day
            <select className="input mt-1 font-normal" value={dayId} onChange={(e) => setDayId(e.target.value)}>
              {trip.itinerary.map((d) => <option key={d.id} value={d.id}>{d.date}</option>)}
            </select>
          </label>
          <ul className="space-y-2">
            {ideas.map((i) => (
              <li key={i.id} className="card flex items-center justify-between gap-3 !py-3">
                <div>
                  <strong>{i.name}</strong>
                  <p className="caption">{i.kind} · {i.cost === 0 ? (i.known ? 'Free' : 'Likely free') : `~${fmt(i.cost, 'USD')}${i.known ? '' : ' (est.)'}`}</p>
                </div>
                <button className="btn btn-secondary" disabled={!dayId} onClick={() => add(i)} aria-label={`Add ${i.name} to itinerary`}>Add</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
