import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit, Trash2, User, MapPin, Phone, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { Paciente } from '@/types/database'
import { pacientesService } from '@/utils/supabase'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const PacientesList = () => {
  const { currentCentro, currentSucursal } = useSucursal()
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pacienteToDelete, setPacienteToDelete] = useState<Paciente | null>(null)
  const itemsPerPage = 9

  useEffect(() => {
    loadPacientes()
  }, [currentSucursal])

  const loadPacientes = async () => {
    try {
      setLoading(true)
      const data = await pacientesService.getAll(currentSucursal?.id, currentCentro?.id)
      setPacientes(data)
    } catch (error) {
      toast.error('Error al cargar pacientes')
      console.error('Error loading pacientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const deletePaciente = async (id: string) => {
    try {
      await pacientesService.delete(id)
      toast.success('Paciente eliminado exitosamente')
      setPacienteToDelete(null)
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

  const totalPages = Math.ceil(filteredPacientes.length / itemsPerPage)
  const paginatedPacientes = filteredPacientes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Reset page when searching
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  if (loading) {
    return <PageLoader label="Cargando pacientes..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Pacientes</h1>
        <Link
          to="/pacientes/nuevo"
          className="bg-medical-green hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors sm:w-auto"
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
          <div className="mt-2 text-sm text-gray-500">
            {filteredPacientes.length} resultado(s) encontrados
          </div>
        </div>

        {filteredPacientes.length === 0 ? (
          <EmptyState
            icon={User}
            title={searchTerm ? 'Sin pacientes coincidentes' : 'No hay pacientes registrados'}
            description={searchTerm ? 'Prueba con otro nombre, RUT o dirección para encontrar pacientes.' : 'Cuando registres pacientes nuevos, aparecerán aquí con acceso rápido a edición.'}
            action={!searchTerm ? (
              <Link
                to="/pacientes/nuevo"
                className="inline-flex items-center gap-2 rounded-lg bg-medical-green px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                <Plus className="h-4 w-4" />
                <span>Crear primer paciente</span>
              </Link>
            ) : undefined}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedPacientes.map((paciente) => (
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
                      onClick={() => setPacienteToDelete(paciente)}
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

        {totalPages > 1 && (
          <div className="mt-6 flex flex-wrap justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
            >
              Anterior
            </button>
            <span className="text-gray-600">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pacienteToDelete}
        title="Eliminar paciente"
        description={pacienteToDelete ? `Vas a desactivar a ${pacienteToDelete.nombre}. El paciente dejará de aparecer en los listados activos.` : ''}
        confirmLabel="Eliminar paciente"
        cancelLabel="Cancelar"
        tone="danger"
        onCancel={() => setPacienteToDelete(null)}
        onConfirm={() => {
          if (pacienteToDelete) {
            void deletePaciente(pacienteToDelete.id)
          }
        }}
      />
    </div>
  )
}

export default PacientesList
