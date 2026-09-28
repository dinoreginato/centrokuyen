import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { cleanupLegacyServiceWorkers, installAppVersionWatchers, syncAppVersion } from '@/utils/appVersion'
import './index.css'

void cleanupLegacyServiceWorkers()

void syncAppVersion()
installAppVersionWatchers()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
