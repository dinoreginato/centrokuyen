import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, User, Lock, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { centroConfigService } from '@/utils/supabase'

const Login = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [nombreCentro, setNombreCentro] = useState('Sistema Clínico Multi-Centro')

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await centroConfigService.getConfig()
        if (config) {
          if (config.logo_url) {
            setLogoUrl(config.logo_url)
          }
          if (config.nombre) setNombreCentro(config.nombre)
        }
      } catch (e) {
        console.error('Error loading config', e)
      }
    }
    loadConfig()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.email || !formData.password) {
      toast.error('Por favor complete todos los campos')
      return
    }

    try {
      setLoading(true)
      await login(formData.email, formData.password)
      toast.success('Inicio de sesión exitoso')
      navigate('/')
    } catch (error: any) {
      toast.error(error.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="max-w-md w-full">
        {/* Logo o título */}
        <div className="text-center mb-8">
          <div className="bg-medical-blue text-white rounded-full p-4 inline-flex items-center justify-center mb-4">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-full object-cover bg-white" />
            ) : (
              <Activity className="h-12 w-12" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-800 sm:text-3xl">{nombreCentro}</h1>
          <p className="text-gray-600 mt-2">Sistema de Gestión Médica</p>
        </div>

        {/* Tarjeta de login */}
        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">Iniciar Sesión</h2>
            <p className="text-gray-600 text-sm mt-1">Accede al sistema con tus credenciales</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-medical-blue focus:border-medical-blue"
                  placeholder="usuario@centrokuyen.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-medical-blue focus:border-medical-blue"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-medical-blue hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  Iniciar Sesión
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ¿Problemas para acceder? Contacte al administrador del sistema.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Acceso seguro para centros, sucursales y usuarios operativos.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
