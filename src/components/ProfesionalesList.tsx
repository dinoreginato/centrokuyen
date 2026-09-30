import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit, Trash2, User, Mail, Phone, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { Profesional } from '@/types/database'
import { profesionalesService } from '@/utils/supabase'
import { formatCLP } from '@/utils/currency'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const ProfesionalesList = () => {
  const { currentCentro, currentSucursal } = useSucursal()
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [profesionalToDelete, setProfesionalToDelete] = useState<Profesional | null>(null)
  const itemsPerPage = 9

  useEffect(() => {
    loadProfesionales()
  }, [currentSucursal])

  const loadProfesionales = async () => {
    try {
      setLoading(true)
      const data = await profesionalesService.getAll(currentSucursal?.id, currentCentro?.id)
      setProfesionales(data)
    } catch (error) {
      toast.error('Error al cargar profesionales')
      console.error('Error loading profesionales:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteProfesional = async (id: string) => {
    try {
      await profesionalesService.delete(id)
      toast.success('Profesional eliminado exitosamente')
      setProfesionalToDelete(null)
      loadProfesionales()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al eliminar profesional'
      toast.error(message)
      console.error('Error deleting profesional:', error)
    }
  }

  const filteredProfesionales = profesionales.filter(prof =>
    prof.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prof.especialidad.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (prof.email && prof.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const totalPages = Math.ceil(filteredProfesionales.length / itemsPerPage)
  const paginatedProfesionales = filteredProfesionales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Reset page when searching
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  if (loading) {
    return <PageLoader label="Cargando profesionales..." />
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
          <div className="mt-2 text-sm text-gray-500">
            {filteredProfesionales.length} resultado(s) encontrados
          </div>
        </div>

        {filteredProfesionales.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title={searchTerm ? 'Sin profesionales coincidentes' : 'No hay profesionales registrados'}
            description={searchTerm ? 'Prueba con otro nombre, especialidad o email para encontrar profesionales.' : 'Crea profesionales para administrar pagos, agenda y disponibilidad desde una sola ficha.'}
            action={!searchTerm ? (
              <Link
                to="/profesionales/nuevo"
                className="inline-flex items-center gap-2 rounded-lg bg-medical-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                <span>Crear primer profesional</span>
              </Link>
            ) : undefined}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedProfesionales.map((profesional) => (
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
                      onClick={() => setProfesionalToDelete(profesional)}
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

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center items-center space-x-2">
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
        open={!!profesionalToDelete}
        title="Eliminar profesional"
        description={profesionalToDelete ? `Vas a eliminar a ${profesionalToDelete.nombre}. Solo debería hacerse si ya no atenderá en el sistema.` : ''}
        confirmLabel="Eliminar profesional"
        cancelLabel="Cancelar"
        tone="danger"
        onCancel={() => setProfesionalToDelete(null)}
        onConfirm={() => {
          if (profesionalToDelete) {
            void deleteProfesional(profesionalToDelete.id)
          }
        }}
      />
    </div>
  )
}

export default ProfesionalesList
