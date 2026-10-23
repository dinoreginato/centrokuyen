import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { pacientesService } from '@/utils/supabase'

const PacienteForm = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { currentCentro, currentSucursal, loading: loadingSucursal } = useSucursal()
  const isEditing = !!id

  const [formData, setFormData] = useState({
    nombre: '',
    rut: '',
    fecha_nacimiento: '',
    telefono: '',
    email: '',
    direccion: '',
    notas: ''
  })

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEditing) {
      loadPaciente()
    }
  }, [id])

  const loadPaciente = async () => {
    try {
      setLoading(true)
      const paciente = await pacientesService.getById(id!)
      if (paciente) {
        setFormData({
          nombre: paciente.nombre,
          rut: paciente.rut,
          fecha_nacimiento: paciente.fecha_nacimiento || '',
          telefono: paciente.telefono,
          email: paciente.email,
          direccion: paciente.direccion,
          notas: paciente.notas
        })
      }
    } catch (error) {
      toast.error('Error al cargar el paciente')
      console.error('Error loading paciente:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isEditing && loadingSucursal) {
      toast.error('Todavía se está cargando el centro y la sucursal. Intenta nuevamente en unos segundos.')
      return
    }
    
    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    if (!formData.rut.trim()) {
      toast.error('El RUT es requerido')
      return
    }

    // Validar RUT único
    try {
      const existingPacientes = await pacientesService.getAll(currentSucursal?.id, currentCentro?.id)
      const rutExists = existingPacientes.some(p => 
        p.rut === formData.rut && p.id !== id
      )
      
      if (rutExists) {
        toast.error('Ya existe un paciente con este RUT')
        return
      }
    } catch (error) {
      console.error('Error checking RUT:', error)
    }

    try {
      setSaving(true)

      const centroId = currentCentro?.id || currentSucursal?.centro_id || null
      const sucursalId = currentSucursal?.id || null

      if (!isEditing && !centroId) {
        throw new Error('No se pudo determinar el centro actual para guardar el paciente')
      }

      const payload = {
        nombre: formData.nombre.trim(),
        rut: formData.rut.trim(),
        fecha_nacimiento: formData.fecha_nacimiento || null,
        telefono: formData.telefono.trim(),
        email: formData.email.trim(),
        direccion: formData.direccion.trim(),
        notas: formData.notas.trim()
      }
      
      if (isEditing) {
        await pacientesService.update(id!, payload)
        toast.success('Paciente actualizado exitosamente')
      } else {
        await pacientesService.create({
          ...payload,
          activo: true,
          centro_id: centroId,
          sucursal_id: sucursalId
        })
        toast.success('Paciente creado exitosamente')
      }
      
      navigate('/pacientes')
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : `Error al ${isEditing ? 'actualizar' : 'crear'} el paciente`
      toast.error(message)
      console.error('Error saving paciente:', error)
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

  if (loading || (!isEditing && loadingSucursal)) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-green"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {isEditing ? 'Editar Paciente' : 'Nuevo Paciente'}
        </h1>
        <button
          onClick={() => navigate('/pacientes')}
          className="text-gray-600 hover:text-gray-800 p-2"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre completo *
            </label>
            <input
              type="text"
              id="nombre"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-green focus:border-medical-green"
              required
            />
          </div>

          <div>
            <label htmlFor="rut" className="block text-sm font-medium text-gray-700 mb-2">
              RUT *
            </label>
            <input
              type="text"
              id="rut"
              name="rut"
              value={formData.rut}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-green focus:border-medical-green"
              placeholder="Ej: 12.345.678-9"
              required
            />
          </div>

          <div>
            <label htmlFor="fecha_nacimiento" className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de nacimiento
            </label>
            <input
              type="date"
              id="fecha_nacimiento"
              name="fecha_nacimiento"
              value={formData.fecha_nacimiento}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-green focus:border-medical-green"
            />
          </div>

          <div>
            <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-2">
              Teléfono
            </label>
            <input
              type="tel"
              id="telefono"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-green focus:border-medical-green"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-green focus:border-medical-green"
            />
          </div>
        </div>

        <div>
          <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 mb-2">
            Dirección
          </label>
          <input
            type="text"
            id="direccion"
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-green focus:border-medical-green"
            placeholder="Ej: Calle Principal 123, Ciudad"
          />
        </div>

        <div>
          <label htmlFor="notas" className="block text-sm font-medium text-gray-700 mb-2">
            Notas médicas
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={4}
            value={formData.notas}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-green focus:border-medical-green"
            placeholder="Información adicional sobre el paciente..."
          />
        </div>

        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/pacientes')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || (!isEditing && loadingSucursal)}
            className="bg-medical-green hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center space-x-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Guardando...' : 'Guardar'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

export default PacienteForm
