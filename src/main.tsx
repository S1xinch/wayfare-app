import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { store, initStore } from './store'
import App from './App'
import './index.css'

registerSW({ immediate: true })
initStore().then(() =>
  createRoot(document.getElementById('root')!).render(
    <Provider store={store}><HashRouter><App /></HashRouter></Provider>,
  ),
)
