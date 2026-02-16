import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Save, Building, Phone, CreditCard, Upload, Users } from 'lucide-react'
import { toast } from 'sonner'
import { CentroConfig } from '@/types/database'
import { centroConfigService } from '@/utils/supabase'
import SucursalesList from './SucursalesList'

const Configuracion = () => {
  const [config, setConfig] = useState<CentroConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    cuit: '',
    logo_url: ''
  })
  const [logoPreview, setLogoPreview] = useState<string>('')

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      setLoading(true)
      const configData = await centroConfigService.getConfig()
      if (configData) {
        setConfig(configData)
        setFormData({
          nombre: configData.nombre,
          direccion: configData.direccion || '',
          telefono: configData.telefono || '',
          cuit: configData.cuit || '',
          logo_url: configData.logo_url || ''
        })
        setLogoPreview(configData.logo_url || '')
      }
    } catch (error) {
      toast.error('Error al cargar la configuración')
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nombre.trim()) {
      toast.error('El nombre del centro es requerido')
      return
    }

    try {
      setSaving(true)
      
      if (config) {
        await centroConfigService.update(config.id, formData)
        toast.success('Configuración actualizada exitosamente')
      } else {
        await centroConfigService.create(formData)
        toast.success('Configuración creada exitosamente')
      }
      
      // Recargar configuración
      await loadConfig()
    } catch (error) {
      toast.error('Error al guardar la configuración')
      console.error('Error saving config:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB límite
        toast.error('El logo no puede superar los 5MB')
        return
      }
      
      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        setLogoPreview(result)
        setFormData(prev => ({
          ...prev,
          logo_url: result
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Configuración del Centro Kuyen</h1>
        <div className="text-sm text-gray-500">
          Última actualización: {config ? new Date(config.updated_at).toLocaleDateString() : 'Nunca'}
        </div>
      </div>

      {/* Información general */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center mb-4">
          <Building className="h-6 w-6 text-medical-blue mr-2" />
          <h2 className="text-lg font-semibold text-gray-800">Información General</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ... inputs ... */}
          {/* Mantenemos el form de arriba igual */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Centro Kuyen *
              </label>
              <input
                type="text"
                id="nombre"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                placeholder="Centro Kuyen"
                required
              />
            </div>

            <div>
              <label htmlFor="cuit" className="block text-sm font-medium text-gray-700 mb-2">
                CUIT
              </label>
              <input
                type="text"
                id="cuit"
                name="cuit"
                value={formData.cuit}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                placeholder="XX-XXXXXXXX-X"
              />
            </div>
          </div>

          <div>
            <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 mb-2">
              Dirección
            </label>
            <textarea
              id="direccion"
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
              placeholder="Calle Principal 123, Ciudad, Provincia"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  id="telefono"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                  placeholder="(011) 1234-5678"
                />
              </div>
            </div>

            <div>
              <label htmlFor="logo" className="block text-sm font-medium text-gray-700 mb-2">
                Logo del Centro
              </label>
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-16 w-16 rounded-lg object-cover border border-gray-300"
                    />
                  ) : (
                    <div className="h-16 w-16 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Upload className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    id="logo"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-medical-blue file:text-white hover:file:bg-blue-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF hasta 5MB</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={loadConfig}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-medical-blue hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Gestión de Sucursales */}
      <SucursalesList />

      {/* Configuración de pagos */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center mb-4">
          <CreditCard className="h-6 w-6 text-medical-green mr-2" />
          <h2 className="text-lg font-semibold text-gray-800">Configuración de Pagos</h2>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-2">
            Los pagos a profesionales se configuran individualmente en cada perfil de profesional.
          </p>
          <p className="text-sm text-gray-600">
            Puedes establecer pagos por porcentaje (%) o monto fijo ($) por atención.
          </p>
          <Link
            to="/profesionales"
            className="inline-flex items-center mt-3 text-medical-blue hover:text-blue-700 text-sm font-medium"
          >
            <Users className="h-4 w-4 mr-1" />
            Gestionar Profesionales
          </Link>
        </div>
      </div>

      {/* Información del sistema */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Información del Sistema</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Versión del Sistema:</p>
            <p className="font-medium">v1.0.0</p>
          </div>
          <div>
            <p className="text-gray-600">Última Actualización:</p>
            <p className="font-medium">{new Date().toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-600">Base de Datos:</p>
            <p className="font-medium">PostgreSQL (Supabase)</p>
          </div>
          <div>
            <p className="text-gray-600">Módulos Activos:</p>
            <p className="font-medium">Gestión completa operativa</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Configuracion