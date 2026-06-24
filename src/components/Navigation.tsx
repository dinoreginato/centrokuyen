import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSucursal } from '@/contexts/SucursalContext'
import { centroConfigService } from '@/utils/supabase'
import { 
  Home, 
  Users, 
  UserPlus, 
  Calendar, 
  FileText, 
  DollarSign, 
  Settings,
  Activity,
  Shield,
  CreditCard,
  Search,
  Clock
} from 'lucide-react'

const Navigation = () => {
  const location = useLocation()
  const { user } = useAuth()
  const { currentSucursal } = useSucursal()
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [nombreCentro, setNombreCentro] = useState('Centro Kuyen')

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await centroConfigService.getConfig()
        if (config) {
          if (config.logo_url) setLogoUrl(config.logo_url)
          if (config.nombre) setNombreCentro(config.nombre)
        }
      } catch (e) {
        console.error('Error loading config', e)
      }
    }
    loadConfig()
  }, [])

  const isDalcahue = currentSucursal?.nombre?.toLowerCase().includes('dalcahue')

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

  return (
    <nav className="bg-medical-blue text-white w-64 min-h-screen p-4">
      <div className="flex items-center mb-8 px-2">
        {logoUrl ? (
          <img 
            src={logoUrl} 
            alt="Logo" 
            className="h-10 w-10 mr-3 rounded-lg object-cover bg-white p-1" 
          />
        ) : (
          <Activity className="h-8 w-8 mr-3" />
        )}
        <h1 className="text-xl font-bold truncate" title={nombreCentro}>{nombreCentro}</h1>
      </div>
      
      <ul className="space-y-2">
        {filteredItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          
          return (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center p-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-700 text-white' 
                    : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 mr-3" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default Navigation
