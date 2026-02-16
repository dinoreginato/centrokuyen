import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit, Trash2, User, Mail, Phone, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { Profesional } from '@/types/database'
import { profesionalesService } from '@/utils/supabase'
import { formatCLP } from '@/utils/currency'

const ProfesionalesList = () => {
  const { currentSucursal } = useSucursal()
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadProfesionales()
  }, [currentSucursal])

  const loadProfesionales = async () => {
    try {
      setLoading(true)
      const data = await profesionalesService.getAll(currentSucursal?.id)
      setProfesionales(data)
    } catch (error) {
      toast.error('Error al cargar profesionales')
      console.error('Error loading profesionales:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteProfesional = async (id: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este profesional?')) {
      return
    }

    try {
      await profesionalesService.delete(id)
      toast.success('Profesional eliminado exitosamente')
      loadProfesionales()
    } catch (error) {
      toast.error('Error al eliminar profesional')
      console.error('Error deleting profesional:', error)
    }
  }

  const filteredProfesionales = profesionales.filter(prof =>
    prof.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prof.especialidad.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (prof.email && prof.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Profesionales</h1>
        <Link
          to="/profesionales/nuevo"
          className="bg-medical-blue hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Nuevo Profesional</span>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre, especialidad o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-transparent"
          />
        </div>

        {filteredProfesionales.length === 0 ? (
          <div className="text-center py-8">
            <Stethoscope className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'No se encontraron profesionales' : 'No hay profesionales registrados'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProfesionales.map((profesional) => (
              <div key={profesional.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="bg-medical-blue text-white rounded-full p-2">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{profesional.nombre}</h3>
                      <p className="text-sm text-gray-600">{profesional.especialidad}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Link
                      to={`/profesionales/${profesional.id}`}
                      className="text-blue-600 hover:text-blue-800 p-1"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => deleteProfesional(profesional.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-600">
                    <Mail className="h-4 w-4 mr-2" />
                    <span>{profesional.email || 'Sin email'}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Phone className="h-4 w-4 mr-2" />
                    <span>{profesional.telefono || 'Sin teléfono'}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-sm">
                    <p className="text-gray-600">Configuración de pago:</p>
                    {profesional.porcentaje_pago > 0 ? (
                      <p className="font-medium text-green-600">{profesional.porcentaje_pago}% por atención</p>
                    ) : profesional.monto_fijo_pago > 0 ? (
                      <p className="font-medium text-green-600">{formatCLP(profesional.monto_fijo_pago)} fijo por atención</p>
                    ) : (
                      <p className="text-gray-500">Sin configuración de pago</p>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    profesional.activo 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {profesional.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfesionalesList