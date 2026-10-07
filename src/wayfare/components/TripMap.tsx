import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Trip } from '../types'

// circleMarker avoids Leaflet's default PNG icon path issues under bundlers.
export default function TripMap({ trip }: { trip: Trip }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const pts = trip.itinerary.flatMap((d) => d.activities).filter((a) => a.lat != null && a.lng != null)
    const map = L.map(el.current!).setView(pts.length ? [pts[0].lat!, pts[0].lng!] : [20, 0], pts.length ? 12 : 2)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map)
    pts.forEach((a) => {
      const pop = document.createElement('span')
      pop.textContent = `${a.time} ${a.title}` // textContent: user text never parsed as HTML
      L.circleMarker([a.lat!, a.lng!], { radius: 8, color: '#2b6777', fillOpacity: 0.8 }).bindPopup(pop).addTo(map)
    })
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts.map((a) => [a.lat!, a.lng!] as [number, number])), { padding: [30, 30] })
    return () => { map.remove() }
  }, [trip.itinerary])
  return <div ref={el} role="region" aria-label="Activity map" className="h-[400px] rounded-lg border border-neutral-200 dark:border-[#2b4852]" />
}
