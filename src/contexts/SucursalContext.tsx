import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Sucursal } from '@/types/database'
import { supabase } from '@/utils/supabase'
import { useAuth } from './AuthContext'

interface SucursalContextType {
  currentSucursal: Sucursal | null
  setSucursal: (sucursal: Sucursal) => void
  sucursales: Sucursal[]
  loading: boolean
}

const SucursalContext = createContext<SucursalContextType | undefined>(undefined)

export const SucursalProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const [currentSucursal, setCurrentSucursal] = useState<Sucursal | null>(null)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)

  // Cargar lista de sucursales al inicio
  useEffect(() => {
    loadSucursales()
  }, [])

  // Sincronizar sucursal con el usuario
  useEffect(() => {
    if (user && sucursales.length > 0) {
      // Si el usuario tiene una sucursal asignada (sea admin o usuario), forzarla
      if (user.sucursal_id) {
        const assigned = sucursales.find(s => s.id === user.sucursal_id)
        if (assigned) {
          // Solo actualizar si es diferente para evitar loops infinitos
          if (currentSucursal?.id !== assigned.id) {
            setCurrentSucursal(assigned)
          }
        }
      } else {
        // Si no tiene sucursal asignada (Super Admin), asegurar que haya alguna seleccionada
        if (!currentSucursal) {
          setCurrentSucursal(sucursales[0])
        }
      }
    }
  }, [user, sucursales, currentSucursal])

  const loadSucursales = async () => {
    try {
      const { data, error } = await supabase
        .from('sucursales')
        .select('*')
        .eq('activo', true)
        .order('nombre')
      
      if (error) throw error
      
      if (data) {
        setSucursales(data)
        // Por defecto seleccionar la primera si no hay usuario aun
        if (data.length > 0 && !currentSucursal) {
          setCurrentSucursal(data[0])
        }
      }
    } catch (error) {
      console.error('Error loading sucursales:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSetSucursal = (sucursal: Sucursal) => {
    // Permitir cambio. Si el usuario tiene sucursal fija, el useEffect lo revertirá automáticamente.
    // Esto evita problemas de sincronización de estado donde !user.sucursal_id podría evaluar mal temporalmente.
    if (user?.rol === 'admin') {
      setCurrentSucursal(sucursal)
    }
  }

  return (
    <SucursalContext.Provider value={{ 
      currentSucursal, 
      setSucursal: handleSetSucursal, 
      sucursales, 
      loading 
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
