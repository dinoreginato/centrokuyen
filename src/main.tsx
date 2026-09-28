import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

declare const __APP_VERSION__: string

const APP_VERSION_STORAGE_KEY = 'centrokuyen-app-version'
const APP_VERSION_RELOAD_PREFIX = 'centrokuyen-app-version-reload'

const cleanupLegacyServiceWorkers = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))

    if ('caches' in window) {
      const cacheKeys = await caches.keys()
      await Promise.all(cacheKeys.map((key) => caches.delete(key)))
    }
  } catch (error) {
    console.error('Error cleaning legacy service workers:', error)
  }
}

void cleanupLegacyServiceWorkers()

const syncAppVersion = async () => {
  if (typeof window === 'undefined') {
    return
  }

  const currentVersion = __APP_VERSION__
  localStorage.setItem(APP_VERSION_STORAGE_KEY, currentVersion)

  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
      },
    })

    if (!response.ok) {
      return
    }

    const payload = await response.json() as { version?: string }
    const remoteVersion = payload.version?.trim()

    if (!remoteVersion || remoteVersion === currentVersion) {
      return
    }

    const reloadMarker = `${APP_VERSION_RELOAD_PREFIX}:${remoteVersion}`
    if (sessionStorage.getItem(reloadMarker) === '1') {
      return
    }

    sessionStorage.setItem(reloadMarker, '1')
    await cleanupLegacyServiceWorkers()

    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.set('app_version', remoteVersion)
    window.location.replace(nextUrl.toString())
  } catch (error) {
    console.error('Error checking app version:', error)
  }
}

void syncAppVersion()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
