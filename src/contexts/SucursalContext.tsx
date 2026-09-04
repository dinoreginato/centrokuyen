import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Centro, Sucursal } from '@/types/database'
import { useAuth } from './AuthContext'
import { centrosService, sucursalesService } from '@/utils/supabase'

interface SucursalContextType {
  currentCentro: Centro | null
  setCentro: (centro: Centro) => void
  centros: Centro[]
  currentSucursal: Sucursal | null
  setSucursal: (sucursal: Sucursal) => void
  sucursales: Sucursal[]
  loading: boolean
  canSelectCentro: boolean
  canSelectSucursal: boolean
}

const SucursalContext = createContext<SucursalContextType | undefined>(undefined)

const SELECTED_CENTRO_STORAGE_KEY = 'selected_centro_id'
const SELECTED_SUCURSAL_STORAGE_KEY = 'selected_sucursal_id'

export const SucursalProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const [currentCentro, setCurrentCentro] = useState<Centro | null>(null)
  const [centros, setCentros] = useState<Centro[]>([])
  const [allSucursales, setAllSucursales] = useState<Sucursal[]>([])
  const [currentSucursal, setCurrentSucursal] = useState<Sucursal | null>(null)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)

  const resetTenantState = () => {
    setCurrentCentro(null)
    setCentros([])
    setAllSucursales([])
    setCurrentSucursal(null)
    setSucursales([])
    localStorage.removeItem(SELECTED_CENTRO_STORAGE_KEY)
    localStorage.removeItem(SELECTED_SUCURSAL_STORAGE_KEY)
  }

  useEffect(() => {
    void loadTenantData()
  }, [user?.id, user?.centro_id, user?.sucursal_id])

  const loadTenantData = async () => {
    if (!user) {
      resetTenantState()
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      let centrosData: Centro[] = []
      let sucursalesData: Sucursal[] = []

      if (user.sucursal_id) {
        const sucursal = await sucursalesService.getById(user.sucursal_id)
        sucursalesData = sucursal ? [sucursal] : []

        const centroId = sucursal?.centro_id || user.centro_id || null
        if (centroId) {
          const centro = await centrosService.getById(centroId)
          centrosData = centro ? [centro] : []
        }
      } else if (user.centro_id) {
        const [centro, scopedSucursales] = await Promise.all([
          centrosService.getById(user.centro_id),
          sucursalesService.getAll(user.centro_id)
        ])

        centrosData = centro ? [centro] : []
        sucursalesData = scopedSucursales
      } else {
        ;[centrosData, sucursalesData] = await Promise.all([
          centrosService.getAll(),
          sucursalesService.getAll()
        ])
      }

      const sucursalFija = user?.sucursal_id
        ? sucursalesData.find(sucursal => sucursal.id === user.sucursal_id) || null
        : null

      const centrosPermitidos = centrosData.filter(centro => {
        if (sucursalFija) {
          return centro.id === sucursalFija.centro_id
        }

        if (user?.centro_id) {
          return centro.id === user.centro_id
        }

        return true
      })

      const savedCentroId = localStorage.getItem(SELECTED_CENTRO_STORAGE_KEY)
      const nextCentro =
        (sucursalFija && centrosPermitidos.find(centro => centro.id === sucursalFija.centro_id)) ||
        centrosPermitidos.find(centro => centro.id === user?.centro_id) ||
        centrosPermitidos.find(centro => centro.id === savedCentroId) ||
        centrosPermitidos[0] ||
        null

      const sucursalesPermitidas = nextCentro
        ? sucursalesData.filter(sucursal => {
            if (sucursal.centro_id !== nextCentro.id) return false
            if (user?.sucursal_id) return sucursal.id === user.sucursal_id
            return true
          })
        : []

      const savedSucursalId = localStorage.getItem(SELECTED_SUCURSAL_STORAGE_KEY)
      const nextSucursal =
        (sucursalFija && sucursalesPermitidas.find(sucursal => sucursal.id === sucursalFija.id)) ||
        sucursalesPermitidas.find(sucursal => sucursal.id === savedSucursalId) ||
        sucursalesPermitidas[0] ||
        null

      setCentros(centrosPermitidos)
      setAllSucursales(sucursalesData)
      setCurrentCentro(nextCentro)
      setSucursales(sucursalesPermitidas)
      setCurrentSucursal(nextSucursal)

      if (nextCentro) {
        localStorage.setItem(SELECTED_CENTRO_STORAGE_KEY, nextCentro.id)
      } else {
        localStorage.removeItem(SELECTED_CENTRO_STORAGE_KEY)
      }

      if (nextSucursal) {
        localStorage.setItem(SELECTED_SUCURSAL_STORAGE_KEY, nextSucursal.id)
      } else {
        localStorage.removeItem(SELECTED_SUCURSAL_STORAGE_KEY)
      }
    } catch (error) {
      console.error('Error loading tenant data:', error)
      resetTenantState()
    } finally {
      setLoading(false)
    }
  }

  const canSelectCentro = !user?.centro_id && !user?.sucursal_id
  const canSelectSucursal = !user?.sucursal_id

  const handleSetCentro = (centro: Centro) => {
    if (!canSelectCentro) return

    const filteredSucursales = allSucursales
      .filter(sucursal => sucursal.centro_id === centro.id)

    setCurrentCentro(centro)
    setSucursales(filteredSucursales)
    setCurrentSucursal(filteredSucursales[0] || null)
    localStorage.setItem(SELECTED_CENTRO_STORAGE_KEY, centro.id)

    if (filteredSucursales[0]) {
      localStorage.setItem(SELECTED_SUCURSAL_STORAGE_KEY, filteredSucursales[0].id)
    } else {
      localStorage.removeItem(SELECTED_SUCURSAL_STORAGE_KEY)
    }
  }

  const handleSetSucursal = (sucursal: Sucursal) => {
    if (!canSelectSucursal) return
    setCurrentSucursal(sucursal)
    localStorage.setItem(SELECTED_SUCURSAL_STORAGE_KEY, sucursal.id)
  }

  return (
    <SucursalContext.Provider value={{ 
      currentCentro,
      setCentro: handleSetCentro,
      centros,
      currentSucursal, 
      setSucursal: handleSetSucursal, 
      sucursales, 
      loading,
      canSelectCentro,
      canSelectSucursal
    }}>
      {children}
    </SucursalContext.Provider>
  )
}

export const useSucursal = () => {
  const context = useContext(SucursalContext)
  if (context === undefined) {
    throw new Error('useSucursal must be used within a SucursalProvider')
  }
  return context
}
