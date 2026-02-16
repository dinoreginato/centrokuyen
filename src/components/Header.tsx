import { useState, useEffect } from 'react'
import { User, LogOut, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useSucursal } from '@/contexts/SucursalContext'
import Notifications from '@/components/Notifications'
import { Atencion } from '@/types/database'
import { atencionesService } from '@/utils/supabase'

const Header = () => {
  const { user, logout } = useAuth()
  const { currentSucursal, setSucursal, sucursales } = useSucursal()
  const [appointments, setAppointments] = useState<Atencion[]>([])
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    loadAppointments()
    
    // Set up interval to refresh appointments every 5 minutes
    const interval = setInterval(() => {
      loadAppointments()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const loadAppointments = async () => {
    try {
      const today = new Date()
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      
      const startDate = today.toISOString().split('T')[0]
      const endDate = nextWeek.toISOString().split('T')[0]
      
      const data = await atencionesService.getByDateRange(startDate, endDate)
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
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-800">Centro Kuyen</h1>
          <span className="text-sm text-gray-500 hidden md:inline">Sistema de Gestión</span>
          
          {/* Selector de Sucursal */}
          <div className="ml-4 pl-4 border-l border-gray-300">
            {user?.rol === 'admin' && !user?.sucursal_id ? (
              <div className="flex items-center bg-gray-50 rounded-lg px-2 py-1 border border-gray-200">
                <MapPin className="h-4 w-4 text-gray-500 mr-2" />
                <select 
                  value={currentSucursal?.id || ''}
                  onChange={(e) => {
                    const s = sucursales.find(suc => suc.id === e.target.value)
                    if(s) setSucursal(s)
                  }}
                  className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer"
                >
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            ) : (
              currentSucursal && (
                <div className="flex items-center text-sm text-blue-800 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                  <MapPin className="h-3 w-3 mr-1" />
                  <span className="font-medium">{currentSucursal.nombre}</span>
                </div>
              )
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <Notifications appointments={appointments} />
          
          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="bg-medical-blue text-white rounded-full p-2">
                <User className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{user?.nombre}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.rol}</p>
              </div>
            </button>
            
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-2 p-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
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
    </header>
  )
}

export default Header