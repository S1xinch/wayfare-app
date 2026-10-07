'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Provider } from 'react-redux'
import type { Flight } from '@/lib/normalize'
import { openTrips } from './boot'
import Modal from './components/Modal'
import { store, uid, updateTrip, useAppDispatch, useAppSelector } from './store'
import type { Activity, Day } from './types'

/** "8:15 PM" or "08:15" -> "08:15" for the itinerary's time field; '' if unparseable. */
const to24 = (s: string) => {
  const m = /(\d{1,2}):(\d{2})\s*([ap]m)?/i.exec(s)
  if (!m) return ''
  const h = m[3] ? (Number(m[1]) % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0) : Number(m[1])
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

/** One itinerary activity per flight segment, each filed under its leg's date. */
const activitiesFor = (f: Flight) =>
  f.legs.flatMap((l) =>
    l.segments.map((s) => ({
      date: l.date,
      act: {
        id: uid(),
        time: to24(s.depart),
        title: `${s.flightNumber}: ${s.from} to ${s.to}`,
        location: `${s.from} airport`,
        description: [s.airline, s.aircraft, s.arrive && `arrives ${s.arrive}`].filter(Boolean).join(', '),
      } satisfies Activity,
    })),
  )

function Picker({ flight }: { flight: Flight }) {
  const dispatch = useAppDispatch()
  const trips = useAppSelector((s) => s.trips)
  const [open, setOpen] = useState(false)
  const [tripId, setTripId] = useState('')
  const [dayId, setDayId] = useState('')
  const [done, setDone] = useState<{ id: string; name: string; n: number } | null>(null)

  const trip = trips.find((t) => t.id === (tripId || trips[0]?.id))
  const items = activitiesFor(flight)
  const matches = (d: Day) => items.some((i) => i.date === d.date)
  const fallback = trip?.itinerary.find((d) => d.id === dayId) ?? trip?.itinerary.find(matches) ?? trip?.itinerary[0]

  async function show() {
    setDone(null)
    setOpen(true)
    await openTrips() // loads on-device trips (and syncs) when this page was reached without visiting /trips first
  }

  function add() {
    if (!trip || !fallback) return
    let n = 0
    const itinerary = trip.itinerary.map((d) => {
      // legs dated inside the trip go on their own day; anything else goes on the chosen day
      const mine = items.filter((i) => (trip.itinerary.some((x) => x.date === i.date) ? i.date === d.date : d.id === fallback.id))
      const fresh = mine.filter((i) => !d.activities.some((a) => a.title === i.act.title)) // clicking twice must not duplicate
      n += fresh.length
      return fresh.length ? { ...d, activities: [...d.activities, ...fresh.map((i) => i.act)] } : d
    })
    if (n) dispatch(updateTrip({ id: trip.id, itinerary }))
    setDone({ id: trip.id, name: trip.name, n })
  }

  return (
    <>
      <button type="button" className="btn btn-plain" onClick={show}>Add to trip</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add to trip">
        {done ? (
          <div role="status">
            <p className="mb-4">{done.n ? `Added ${flight.flightNumber || 'this flight'} to ${done.name}.` : `${done.name} already has this flight.`}</p>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-plain" onClick={() => setOpen(false)}>Close</button>
              <Link className="btn" href={`/trips/${done.id}`}>Open trip</Link>
            </div>
          </div>
        ) : !trips.length ? (
          <p>You have no trips yet. <Link href="/trips" className="underline">Create one</Link>, then come back to add this flight.</p>
        ) : (
          <div className="grid gap-4">
            <p>{flight.legs.flatMap((l) => l.segments.map((s) => s.flightNumber)).join(', ')}</p>
            <div>
              <label htmlFor="att-trip">Trip</label>
              <select id="att-trip" className="input" value={trip?.id} onChange={(e) => { setTripId(e.target.value); setDayId('') }}>
                {trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="att-day">Day</label>
              <select id="att-day" className="input" value={fallback?.id} onChange={(e) => setDayId(e.target.value)}>
                {trip?.itinerary.map((d) => <option key={d.id} value={d.id}>{d.date}</option>)}
              </select>
              <p className="mt-1 text-sm">Flights dated within the trip go on their own day. Others go on the day chosen here.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-plain" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="btn" onClick={add} disabled={!fallback}>Add to itinerary</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

/** "Add to trip" for a flight result: files each segment into a trip's itinerary. Trips live on this device (and sync when signed in). */
export default function AddToTrip({ flight }: { flight: Flight }) {
  return <Provider store={store}><Picker flight={flight} /></Provider>
}
