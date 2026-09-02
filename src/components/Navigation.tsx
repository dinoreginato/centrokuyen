import { Link, useLocation } from 'react-router-dom'
import { X, Home, Users, UserPlus, Calendar, FileText, DollarSign, Settings, Activity, Shield, CreditCard, Search, Clock, Building2, MapPin } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSucursal } from '@/contexts/SucursalContext'

interface NavigationProps {
  mobileOpen?: boolean
  onClose?: () => void
}

const Navigation = ({ mobileOpen = false, onClose }: NavigationProps) => {
  const location = useLocation()
  const { user } = useAuth()
  const { currentCentro, currentSucursal } = useSucursal()
  const isDalcahue = currentSucursal?.nombre?.toLowerCase().includes('dalcahue')
  const nombreCentro = currentCentro?.nombre || 'Sistema Clínico'
  const logoUrl = currentCentro?.logo_url || null

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard', roles: ['admin', 'profesional', 'usuario'] },
    { path: '/profesionales', icon: Users, label: 'Profesionales', roles: ['admin'] },
    { path: '/pacientes', icon: UserPlus, label: 'Pacientes', roles: isDalcahue ? ['admin', 'profesional'] : ['admin'] },
    { path: '/agenda', icon: Calendar, label: 'Agenda', roles: ['admin', 'profesional', 'usuario'] },
    { path: '/atenciones-por-paciente', icon: Search, label: 'Atenciones', roles: ['admin', 'profesional'] },
    { path: '/disponibilidad', icon: Clock, label: 'Disponibilidad', roles: ['admin', 'profesional'] },
    { path: '/pagos-pendientes', icon: CreditCard, label: 'Pagos Pendientes', roles: ['admin'] },
    { path: '/reportes', icon: FileText, label: 'Reportes', roles: ['admin'] },
    { path: '/costos', icon: DollarSign, label: 'Costos', roles: ['admin'] },
    { path: '/usuarios', icon: Shield, label: 'Usuarios', roles: ['admin'] },
    { path: '/configuracion', icon: Settings, label: 'Configuración', roles: ['admin'] },
  ]

  const filteredItems = navItems.filter(item => {
    if (!user) return false
    return item.roles.includes(user.rol)
  })

  const navContent = (
    <div className="flex h-full flex-col bg-medical-blue text-white">
      <div className="flex items-center justify-between border-b border-blue-700 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-10 w-10 rounded-xl bg-white object-cover p-1"
            />
          ) : (
            <div className="rounded-xl bg-blue-700 p-2">
              <Activity className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-blue-100">Centro activo</p>
            <h1 className="truncate text-base font-bold" title={nombreCentro}>{nombreCentro}</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-blue-100 hover:bg-blue-700 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="border-b border-blue-700 px-4 py-3 text-sm text-blue-100">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span className="truncate">{nombreCentro}</span>
        </div>
        {currentSucursal && (
          <div className="mt-2 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="truncate">{currentSucursal.nombre}</span>
          </div>
        )}
      </div>
      
      <ul className="flex-1 space-y-2 overflow-y-auto p-4">
        {filteredItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          
          return (
            <li key={item.path}>
              <Link
                to={item.path}
                onClick={onClose}
                className={`flex items-center rounded-xl px-3 py-3 transition-colors ${
                  isActive 
                    ? 'bg-blue-700 text-white' 
                    : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                }`}
              >
                <Icon className="mr-3 h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )

  return (
    <>
      <nav className="hidden h-screen w-72 shrink-0 lg:block">
        {navContent}
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar navegación"
            onClick={onClose}
            className="absolute inset-0 bg-black/50"
          />
          <nav className="absolute inset-y-0 left-0 w-[88vw] max-w-72 shadow-2xl">
            {navContent}
          </nav>
        </div>
      )}
    </>
  )
}

export default Navigation
