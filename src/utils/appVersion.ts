declare const __APP_VERSION__: string

export const APP_UPDATE_EVENT = 'app-update-available'

const APP_VERSION_STORAGE_KEY = 'centrokuyen-app-version'
const APP_VERSION_RELOAD_PREFIX = 'centrokuyen-app-version-reload'

export const getCurrentAppVersion = () => __APP_VERSION__

export const formatAppVersionLabel = (version?: string | null) => {
  if (!version) {
    return 'Sin dato'
  }

  const parsedDate = new Date(version)
  if (Number.isNaN(parsedDate.getTime())) {
    return version
  }

  return parsedDate.toLocaleString('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export const cleanupLegacyServiceWorkers = async () => {
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

const emitAppUpdateAvailable = (remoteVersion: string) => {
  window.dispatchEvent(new CustomEvent(APP_UPDATE_EVENT, {
    detail: {
      version: remoteVersion,
      currentVersion: __APP_VERSION__,
    },
  }))
}

export const fetchRemoteAppVersion = async () => {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
      },
    })

    if (!response.ok) {
      return null
    }

    const payload = await response.json() as { version?: string }
    return payload.version?.trim() || null
  } catch (error) {
    console.error('Error checking app version:', error)
    return null
  }
}

export const syncAppVersion = async () => {
  if (typeof window === 'undefined') {
    return
  }

  const currentVersion = __APP_VERSION__
  localStorage.setItem(APP_VERSION_STORAGE_KEY, currentVersion)

  try {
    const remoteVersion = await fetchRemoteAppVersion()

    if (!remoteVersion || remoteVersion === currentVersion) {
      return
    }

    emitAppUpdateAvailable(remoteVersion)
  } catch (error) {
    console.error('Error checking app version:', error)
  }
}

export const installAppVersionWatchers = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.addEventListener('focus', () => {
    void syncAppVersion()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void syncAppVersion()
    }
  })

  window.setInterval(() => {
    void syncAppVersion()
  }, 5 * 60 * 1000)
}

export const applyAppUpdate = async (targetVersion?: string) => {
  const reloadMarker = `${APP_VERSION_RELOAD_PREFIX}:${targetVersion || 'latest'}`
  if (sessionStorage.getItem(reloadMarker) === '1') {
    return
  }

  sessionStorage.setItem(reloadMarker, '1')
  await cleanupLegacyServiceWorkers()

  const nextUrl = new URL(window.location.href)
  if (targetVersion) {
    nextUrl.searchParams.set('app_version', targetVersion)
  } else {
    nextUrl.searchParams.set('app_version', String(Date.now()))
  }
  window.location.replace(nextUrl.toString())
}
