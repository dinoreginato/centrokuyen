import { useState, useEffect } from 'react'
import { Edit, Trash2, Plus, MapPin, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { Sucursal } from '@/types/database'
import { useSucursal } from '@/contexts/SucursalContext'
import { sucursalesService } from '@/utils/supabase'

export default function SucursalesList() {
  const { currentCentro } = useSucursal()
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ nombre: '', direccion: '', telefono: '' })
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    loadSucursales()
  }, [currentCentro?.id])

  const loadSucursales = async () => {
    try {
      setLoading(true)

      if (!currentCentro?.id) {
        setSucursales([])
        return
      }

      const data = await sucursalesService.getAll(currentCentro.id)
      setSucursales(data)
    } catch (error) {
      toast.error('Error al cargar sucursales')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (sucursal: Sucursal) => {
    setEditingId(sucursal.id)
    setFormData({
      nombre: sucursal.nombre,
      direccion: sucursal.direccion || '',
      telefono: sucursal.telefono || ''
    })
    setIsCreating(false)
  }

  const handleCreate = () => {
    setEditingId(null)
    setFormData({ nombre: '', direccion: '', telefono: '' })
    setIsCreating(true)
  }

  const handleCancel = () => {
    setEditingId(null)
    setIsCreating(false)
    setFormData({ nombre: '', direccion: '', telefono: '' })
  }

  const handleSave = async () => {
    if (!currentCentro?.id) {
      toast.error('Seleccione un centro para gestionar sucursales')
      return
    }

    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    try {
      if (isCreating) {
        await sucursalesService.create({
          centro_id: currentCentro.id,
          nombre: formData.nombre,
          direccion: formData.direccion,
          telefono: formData.telefono,
          activo: true
        })
        toast.success('Sucursal creada exitosamente')
      } else if (editingId) {
        await sucursalesService.update(editingId, {
          nombre: formData.nombre,
          direccion: formData.direccion,
          telefono: formData.telefono
        })
        toast.success('Sucursal actualizada exitosamente')
      }

      handleCancel()
      loadSucursales()
      setTimeout(() => window.location.reload(), 600)
    } catch (error) {
      toast.error('Error al guardar sucursal')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de desactivar esta sucursal?')) return

    try {
      await sucursalesService.delete(id)
      toast.success('Sucursal desactivada')
      loadSucursales()
      setTimeout(() => window.location.reload(), 600)
    } catch (error) {
      toast.error('Error al eliminar sucursal')
    }
  }

  if (loading) return <div>Cargando sucursales...</div>

  if (!currentCentro) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        Seleccione un centro para administrar sus sucursales.
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center text-xl font-semibold text-gray-800">
            <MapPin className="mr-2 h-5 w-5 text-medical-blue" />
            Gestión de Sucursales
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Centro activo: <span className="font-medium text-gray-700">{currentCentro.nombre}</span>
          </p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={handleCreate}
            className="flex items-center justify-center gap-2 rounded-lg bg-medical-blue px-4 py-2 text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Sucursal</span>
          </button>
        )}
      </div>

      {isCreating && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-gray-50 p-4">
          <h3 className="mb-3 font-medium">Nueva Sucursal</h3>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <input
              placeholder="Nombre de la sucursal"
              className="rounded border p-2"
              value={formData.nombre}
              onChange={e => setFormData({...formData, nombre: e.target.value})}
            />
            <input
              placeholder="Dirección"
              className="rounded border p-2"
              value={formData.direccion}
              onChange={e => setFormData({...formData, direccion: e.target.value})}
            />
            <input
              placeholder="Teléfono"
              className="rounded border p-2"
              value={formData.telefono}
              onChange={e => setFormData({...formData, telefono: e.target.value})}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleSave} className="flex items-center rounded bg-green-600 px-3 py-1 text-white">
              <Save className="mr-1 h-4 w-4" /> Guardar
            </button>
            <button onClick={handleCancel} className="flex items-center rounded bg-gray-500 px-3 py-1 text-white">
              <X className="mr-1 h-4 w-4" /> Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:hidden">
        {sucursales.map(sucursal => (
          <div key={sucursal.id} className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">{sucursal.nombre}</p>
                <p className="mt-1 text-sm text-gray-500">{sucursal.direccion || 'Sin dirección'}</p>
                <p className="text-sm text-gray-500">{sucursal.telefono || 'Sin teléfono'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(sucursal)} className="text-blue-600 hover:text-blue-800">
                  <Edit className="h-5 w-5" />
                </button>
                <button onClick={() => handleDelete(sucursal.id)} className="text-red-600 hover:text-red-800">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Dirección</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Teléfono</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sucursales.map(sucursal => (
              <tr key={sucursal.id}>
                <td className="px-6 py-4">
                  {editingId === sucursal.id ? (
                    <input
                      className="w-full rounded border p-1"
                      value={formData.nombre}
                      onChange={e => setFormData({...formData, nombre: e.target.value})}
                    />
                  ) : (
                    <span className="font-medium text-gray-900">{sucursal.nombre}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId === sucursal.id ? (
                    <input
                      className="w-full rounded border p-1"
                      value={formData.direccion}
                      onChange={e => setFormData({...formData, direccion: e.target.value})}
                    />
                  ) : (
                    <span className="text-gray-500">{sucursal.direccion}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId === sucursal.id ? (
                    <input
                      className="w-full rounded border p-1"
                      value={formData.telefono}
                      onChange={e => setFormData({...formData, telefono: e.target.value})}
                    />
                  ) : (
                    <span className="text-gray-500">{sucursal.telefono}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {editingId === sucursal.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={handleSave} className="text-green-600 hover:text-green-800">
                        <Save className="h-5 w-5" />
                      </button>
                      <button onClick={handleCancel} className="text-gray-600 hover:text-gray-800">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEdit(sucursal)} className="text-blue-600 hover:text-blue-800">
                        <Edit className="h-5 w-5" />
                      </button>
                      <button onClick={() => handleDelete(sucursal.id)} className="text-red-600 hover:text-red-800">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
