import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit, Trash2, User, MapPin, Phone, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { Paciente } from '@/types/database'
import { pacientesService } from '@/utils/supabase'

const PacientesList = () => {
  const { currentSucursal } = useSucursal()
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadPacientes()
  }, [currentSucursal])

  const loadPacientes = async () => {
    try {
      setLoading(true)
      const data = await pacientesService.getAll(currentSucursal?.id)
      setPacientes(data)
    } catch (error) {
      toast.error('Error al cargar pacientes')
      console.error('Error loading pacientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const deletePaciente = async (id: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este paciente?')) {
      return
    }

    try {
      await pacientesService.delete(id)
      toast.success('Paciente eliminado exitosamente')
      loadPacientes()
    } catch (error) {
      toast.error('Error al eliminar paciente')
      console.error('Error deleting paciente:', error)
    }
  }

  const filteredPacientes = pacientes.filter(paciente =>
    paciente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    paciente.rut.toLowerCase().includes(searchTerm.toLowerCase()) ||
    paciente.direccion.toLowerCase().includes(searchTerm.toLowerCase())
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
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Pacientes</h1>
        <Link
          to="/pacientes/nuevo"
          className="bg-medical-green hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Nuevo Paciente</span>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre, RUT o dirección..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-transparent"
          />
        </div>

        {filteredPacientes.length === 0 ? (
          <div className="text-center py-8">
            <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'No se encontraron pacientes' : 'No hay pacientes registrados'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPacientes.map((paciente) => (
              <div key={paciente.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="bg-medical-green text-white rounded-full p-2">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{paciente.nombre}</h3>
                      <p className="text-sm text-gray-600">RUT: {paciente.rut}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Link
                      to={`/pacientes/${paciente.id}`}
                      className="text-blue-600 hover:text-blue-800 p-1"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => deletePaciente(paciente.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {paciente.email && (
                    <div className="flex items-center text-gray-600">
                      <Mail className="h-4 w-4 mr-2" />
                      <span>{paciente.email}</span>
                    </div>
                  )}
                  {paciente.telefono && (
                    <div className="flex items-center text-gray-600">
                      <Phone className="h-4 w-4 mr-2" />
                      <span>{paciente.telefono}</span>
                    </div>
                  )}
                  {paciente.direccion && (
                    <div className="flex items-center text-gray-600">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{paciente.direccion}</span>
                    </div>
                  )}
                </div>

                {paciente.notas && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      <strong>Notas:</strong> {paciente.notas}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default PacientesList