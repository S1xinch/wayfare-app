'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { Provider } from 'react-redux'
import { CURRENCIES, currencyName } from '@/lib/currencies'
import { useCurrency } from '@/lib/money'
import { initAccount } from './account'
import { loadTrips } from './boot'
import { store } from './store'
import 'leaflet/dist/leaflet.css'
import './wayfare.css'

/** Client-only host for the trips area: Redux store, offline data, sync. Renders nothing until local trips are loaded so SSR and first paint agree. The theme is site-wide (header menu), not set here. */
export default function Shell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const { cur, setCurrency } = useCurrency()
  useEffect(() => {
    loadTrips().then(() => { setReady(true); initAccount() })
  }, [])
  return (
    <Provider store={store}>
      <div className="wf">
        <div className="wf-toolbar">
          <label>Currency
            <select className="input" value={cur} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{currencyName(c)}</option>)}
            </select>
          </label>
        </div>
        {ready ? children : <p role="status">Loading your trips…</p>}
      </div>
    </Provider>
  )
}
