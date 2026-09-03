import { useState, useEffect } from 'react'
import { Menu, User, LogOut, MapPin, Building2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useSucursal } from '@/contexts/SucursalContext'
import Notifications from '@/components/Notifications'
import { Atencion } from '@/types/database'
import { atencionesService } from '@/utils/supabase'
import { getRoleLabel } from '@/utils/permissions'

interface HeaderProps {
  onMenuToggle: () => void
}

const Header = ({ onMenuToggle }: HeaderProps) => {
  const { user, logout } = useAuth()
  const {
    currentCentro,
    setCentro,
    centros,
    currentSucursal,
    setSucursal,
    sucursales,
    canSelectCentro,
    canSelectSucursal
  } = useSucursal()
  const [appointments, setAppointments] = useState<Atencion[]>([])
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    loadAppointments()
    
    // Set up interval to refresh appointments every 5 minutes
    const interval = setInterval(() => {
      loadAppointments()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [currentCentro?.id, currentSucursal?.id])

  const loadAppointments = async () => {
    try {
      const today = new Date()
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      
      const startDate = today.toISOString().split('T')[0]
      const endDate = nextWeek.toISOString().split('T')[0]
      
      const data = await atencionesService.getByDateRange(
        startDate,
        endDate,
        currentSucursal?.id,
        currentCentro?.id
      )
      setAppointments(data)
    } catch (error) {
      console.error('Error loading appointments for notifications:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Sesión cerrada exitosamente')
    } catch (error) {
      toast.error('Error al cerrar sesión')
    }
  }

  return (
    <header className="border-b border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-xl border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-800 sm:text-2xl">
              {currentCentro?.nombre || 'Sistema de Gestión'}
            </h1>
            <p className="hidden text-sm text-gray-500 sm:block">
              Gestión multi-centro y multi-sucursal
            </p>
          </div>
        </div>
        
        <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row xl:items-center">
          <div className="grid gap-3 sm:grid-cols-2 xl:flex">
            {canSelectCentro ? (
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <Building2 className="h-4 w-4 shrink-0 text-gray-500" />
                <select
                  value={currentCentro?.id || ''}
                  onChange={(e) => {
                    const centro = centros.find(item => item.id === e.target.value)
                    if (centro) setCentro(centro)
                  }}
                  className="min-w-0 flex-1 bg-transparent font-medium outline-none"
                >
                  {centros.map(centro => (
                    <option key={centro.id} value={centro.id}>
                      {centro.nombre}
                    </option>
                  ))}
                </select>
              </label>
            ) : currentCentro ? (
              <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate font-medium">{currentCentro.nombre}</span>
              </div>
            ) : null}

            {canSelectSucursal ? (
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <MapPin className="h-4 w-4 shrink-0 text-gray-500" />
                <select
                  value={currentSucursal?.id || ''}
                  onChange={(e) => {
                    const sucursal = sucursales.find(item => item.id === e.target.value)
                    if (sucursal) setSucursal(sucursal)
                  }}
                  className="min-w-0 flex-1 bg-transparent font-medium outline-none"
                >
                  {sucursales.map(sucursal => (
                    <option key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </option>
                  ))}
                </select>
              </label>
            ) : currentSucursal ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate font-medium">{currentSucursal.nombre}</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3">
            <Notifications appointments={appointments} />
            
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 rounded-xl border border-gray-200 p-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="bg-medical-blue text-white rounded-full p-2">
                  <User className="h-4 w-4" />
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium text-gray-900">{user?.nombre}</p>
                  <p className="text-xs text-gray-500">{getRoleLabel(user)}</p>
                </div>
                <ChevronDown className="hidden h-4 w-4 text-gray-400 sm:block" />
              </button>
              
              {showUserMenu && (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-lg">
                  <div className="p-2">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg p-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
