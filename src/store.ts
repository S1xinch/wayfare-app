import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux'
import { get, set } from 'idb-keyval'
import type { Trip } from './types'

export const uid = () => crypto.randomUUID()

const slice = createSlice({
  name: 'trips',
  initialState: [] as Trip[],
  reducers: {
    setTrips: (_, a: PayloadAction<Trip[]>) => a.payload,
    addTrip: (s, a: PayloadAction<Trip>) => { s.unshift(a.payload) },
    deleteTrip: (s, a: PayloadAction<string>) => s.filter((t) => t.id !== a.payload),
    updateTrip: (s, a: PayloadAction<Partial<Trip> & { id: string }>) => {
      const t = s.find((x) => x.id === a.payload.id)
      if (t) Object.assign(t, a.payload, { updatedAt: new Date().toISOString() })
    },
  },
})
export const { setTrips, addTrip, deleteTrip, updateTrip } = slice.actions

export const store = configureStore({ reducer: { trips: slice.reducer } })
export type RootState = ReturnType<typeof store.getState>
export const useAppDispatch = () => useDispatch<typeof store.dispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

// Persistence: IndexedDB via idb-keyval; localStorage fallback if IDB is unavailable (e.g. private mode).
// Never write before the initial load finishes, or an empty store would clobber saved data.
let loaded = false
const save = (t: Trip[]) => set('trips', t).catch(() => { try { localStorage.trips = JSON.stringify(t) } catch { /* quota */ } })
export async function initStore() {
  let t: Trip[] | undefined
  try { t = await get('trips') } catch { /* fall through */ }
  if (!t) try { t = JSON.parse(localStorage.trips ?? '[]') } catch { t = [] }
  store.dispatch(setTrips(t ?? []))
  loaded = true
}
store.subscribe(() => { if (loaded) save(store.getState().trips) })

export function newTrip(p: Pick<Trip, 'name' | 'destination' | 'startDate' | 'endDate' | 'budget'>): Trip {
  const days: Trip['itinerary'] = []
  const end = new Date(p.endDate + 'T00:00:00Z')
  for (let d = new Date(p.startDate + 'T00:00:00Z'); d <= end && days.length < 366; d.setUTCDate(d.getUTCDate() + 1))
    days.push({ id: uid(), date: d.toISOString().slice(0, 10), activities: [] })
  const now = new Date().toISOString()
  return { ...p, id: uid(), itinerary: days, packingList: [], expenses: [], notes: '', createdAt: now, updatedAt: now }
}
