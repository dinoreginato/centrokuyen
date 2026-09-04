import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Stethoscope, DollarSign, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { TipoAtencion } from '@/types/database'
import { tiposAtencionService } from '@/utils/supabase'
import { formatCLP } from '@/utils/currency'
import TipoAtencionForm from './TipoAtencionForm'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const TiposAtencionList = () => {
  const { currentCentro, currentSucursal } = useSucursal()
  const [tipos, setTipos] = useState<TipoAtencion[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTipo, setEditingTipo] = useState<TipoAtencion | undefined>()
  const [tipoToDelete, setTipoToDelete] = useState<TipoAtencion | null>(null)

  useEffect(() => {
    loadTipos()
  }, [currentSucursal])

  const loadTipos = async () => {
    try {
      setLoading(true)
      const data = await tiposAtencionService.getAllAdmin(currentSucursal?.id, currentCentro?.id)
      setTipos(data)
    } catch (error) {
      toast.error('Error al cargar tipos de atención')
      console.error('Error loading tipos:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteTipo = async (id: string) => {
    try {
      await tiposAtencionService.delete(id)
      toast.success('Tipo de atención eliminado exitosamente')
      setTipoToDelete(null)
      loadTipos()
    } catch (error) {
      toast.error('Error al eliminar tipo de atención')
      console.error('Error deleting tipo:', error)
    }
  }

  const handleNewTipo = () => {
    setEditingTipo(undefined)
    setShowForm(true)
  }

  const handleEditTipo = (tipo: TipoAtencion) => {
    setEditingTipo(tipo)
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingTipo(undefined)
    loadTipos()
  }

  const handleFormCancel = () => {
    setShowForm(false)
    setEditingTipo(undefined)
  }

  if (loading) {
    return <PageLoader label="Cargando tipos de atención..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Tipos de Atención</h1>
        <button
          onClick={handleNewTipo}
          className="bg-medical-blue hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Nuevo Tipo</span>
        </button>
      </div>

      {tipos.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8">
          <EmptyState
            icon={Stethoscope}
            title="No hay tipos de atención registrados"
            description="Crea el primer tipo para normalizar valores base, descripciones y uso en agenda y reportes."
            action={(
              <button
                onClick={handleNewTipo}
                className="rounded-md bg-medical-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Crear primer tipo de atención
              </button>
            )}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tipos.map((tipo) => (
            <div key={tipo.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-medical-blue text-white rounded-full p-2">
                    <Stethoscope className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{tipo.nombre}</h3>
                    <p className="text-sm text-gray-600">
                      {tipo.activo ? 'Activo' : 'Inactivo'}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditTipo(tipo)}
                    className="text-blue-600 hover:text-blue-800 p-1"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setTipoToDelete(tipo)}
                    className="text-red-600 hover:text-red-800 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center text-gray-600">
                  <DollarSign className="h-4 w-4 mr-2" />
                  <span className="font-medium">{formatCLP(tipo.valor_base)}</span>
                </div>

                {tipo.descripcion && (
                  <div className="flex items-start text-gray-600">
                    <FileText className="h-4 w-4 mr-2 mt-0.5" />
                    <span className="text-sm">{tipo.descripcion}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-200">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    tipo.activo 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {tipo.activo ? 'En uso' : 'No disponible'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de formulario */}
      {showForm && (
        <TipoAtencionForm
          tipo={editingTipo}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      <ConfirmDialog
        open={!!tipoToDelete}
        title="Eliminar tipo de atención"
        description={tipoToDelete ? `Vas a eliminar "${tipoToDelete.nombre}". Las atenciones históricas seguirán registradas, pero este tipo dejará de estar disponible.` : ''}
        confirmLabel="Eliminar tipo"
        cancelLabel="Cancelar"
        tone="danger"
        onCancel={() => setTipoToDelete(null)}
        onConfirm={() => {
          if (tipoToDelete) {
            void deleteTipo(tipoToDelete.id)
          }
        }}
      />
    </div>
  )
}

export default TiposAtencionList
