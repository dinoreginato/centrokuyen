import { useState, useEffect } from 'react'
import { Edit, Trash2, Plus, MapPin, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { Sucursal } from '@/types/database'
import { sucursalesService } from '@/utils/supabase'

export default function SucursalesList() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ nombre: '', direccion: '', telefono: '' })
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    loadSucursales()
  }, [])

  const loadSucursales = async () => {
    try {
      setLoading(true)
      const data = await sucursalesService.getAll()
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
    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    try {
      if (isCreating) {
        await sucursalesService.create({
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
      // Recargar la página para actualizar el contexto global si es necesario
      // O idealmente actualizar el contexto, pero un reload simple funciona para cambios de config raros
      setTimeout(() => window.location.reload(), 1000) 
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
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      toast.error('Error al eliminar sucursal')
    }
  }

  if (loading) return <div>Cargando sucursales...</div>

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-medical-blue" />
          Gestión de Sucursales
        </h2>
        {!isCreating && !editingId && (
          <button
            onClick={handleCreate}
            className="bg-medical-blue text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Sucursal</span>
          </button>
        )}
      </div>

      {isCreating && (
        <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-blue-200">
          <h3 className="font-medium mb-3">Nueva Sucursal</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              placeholder="Nombre de la sucursal"
              className="border p-2 rounded"
              value={formData.nombre}
              onChange={e => setFormData({...formData, nombre: e.target.value})}
            />
            <input
              placeholder="Dirección"
              className="border p-2 rounded"
              value={formData.direccion}
              onChange={e => setFormData({...formData, direccion: e.target.value})}
            />
            <input
              placeholder="Teléfono"
              className="border p-2 rounded"
              value={formData.telefono}
              onChange={e => setFormData({...formData, telefono: e.target.value})}
            />
          </div>
          <div className="flex space-x-2">
            <button onClick={handleSave} className="bg-green-600 text-white px-3 py-1 rounded flex items-center">
              <Save className="h-4 w-4 mr-1" /> Guardar
            </button>
            <button onClick={handleCancel} className="bg-gray-500 text-white px-3 py-1 rounded flex items-center">
              <X className="h-4 w-4 mr-1" /> Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dirección</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sucursales.map(sucursal => (
              <tr key={sucursal.id}>
                <td className="px-6 py-4">
                  {editingId === sucursal.id ? (
                    <input
                      className="border p-1 rounded w-full"
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
                      className="border p-1 rounded w-full"
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
                      className="border p-1 rounded w-full"
                      value={formData.telefono}
                      onChange={e => setFormData({...formData, telefono: e.target.value})}
                    />
                  ) : (
                    <span className="text-gray-500">{sucursal.telefono}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {editingId === sucursal.id ? (
                    <div className="flex justify-end space-x-2">
                      <button onClick={handleSave} className="text-green-600 hover:text-green-800">
                        <Save className="h-5 w-5" />
                      </button>
                      <button onClick={handleCancel} className="text-gray-600 hover:text-gray-800">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end space-x-2">
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
