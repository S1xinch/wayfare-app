import { Link } from 'react-router-dom'

const Back = () => <Link to="/" className="underline">← Back</Link>

export function Privacy() {
  return (
    <article className="max-w-prose space-y-4">
      <Back />
      <h1>Privacy Policy</h1>
      <p>Tripsy stores everything on your device, in your browser’s IndexedDB. Nothing is sent to a server, and there are no accounts, analytics or trackers.</p>
      <p>The map view loads tiles from OpenStreetMap when you are online; that request reveals your IP address and the area you view to OpenStreetMap, as with any map.</p>
      <p>The Ideas tab, only when you press “Find ideas”, sends your trip’s destination text to OpenStreetMap’s Nominatim and Overpass services to look up the location and nearby sights. Nothing else about your trip is sent.</p>
      <p>Exports are files you save yourself. Clearing your browser’s site data deletes all trips, so export a backup first.</p>
    </article>
  )
}

export function Terms() {
  return (
    <article className="max-w-prose space-y-4">
      <Back />
      <h1>Terms of Service</h1>
      <p>Tripsy is provided “as is”, without warranty of any kind. You are responsible for your own data and backups.</p>
      <p>Budgets and totals are for planning only and are not financial advice. To the extent permitted by law, the authors are not liable for any loss arising from use of the app.</p>
    </article>
  )
}
