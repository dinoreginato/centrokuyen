import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, User, Shield, MapPin, Stethoscope, X } from 'lucide-react'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { Usuario, Sucursal, Profesional } from '@/types/database'
import { usuariosService, sucursalesService, profesionalesService } from '@/utils/supabase'

export default function UsuariosList() {
  const { currentSucursal } = useSucursal()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'usuario' as 'admin' | 'profesional' | 'usuario',
    sucursal_id: '',
    profesional_id: ''
  })
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    loadData()
  }, [currentSucursal])

  const loadData = async () => {
    try {
      setLoading(true)
      const [usuariosData, sucursalesData, profesionalesData] = await Promise.all([
        usuariosService.getAll(),
        sucursalesService.getAll(),
        profesionalesService.getAll(currentSucursal?.id)
      ])
      setUsuarios(usuariosData)
      setSucursales(sucursalesData)
      setProfesionales(profesionalesData)
    } catch (error) {
      toast.error('Error al cargar datos')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingId(null)
    setIsSuperAdmin(false)
    setFormData({
      nombre: '',
      email: '',
      password: '',
      rol: 'usuario',
      sucursal_id: sucursales.length > 0 ? sucursales[0].id : '',
      profesional_id: ''
    })
    setShowForm(true)
  }

  const handleEdit = (usuario: Usuario) => {
    setEditingId(usuario.id)
    const isSuper = usuario.rol === 'admin' && !usuario.sucursal_id
    setIsSuperAdmin(isSuper)
    setFormData({
      nombre: usuario.nombre,
      email: usuario.email,
      password: '', // No mostramos la contraseña actual
      rol: usuario.rol as any,
      sucursal_id: usuario.sucursal_id || (sucursales.length > 0 ? sucursales[0].id : ''),
      profesional_id: usuario.profesional_id || ''
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nombre || !formData.email || (!isSuperAdmin && !formData.sucursal_id)) {
      toast.error('Complete los campos obligatorios')
      return
    }

    if (!editingId && !formData.password) {
      toast.error('La contraseña es obligatoria para nuevos usuarios')
      return
    }

    try {
      const dataToSave: any = {
        nombre: formData.nombre,
        email: formData.email,
        rol: formData.rol,
        sucursal_id: isSuperAdmin ? null : formData.sucursal_id,
        profesional_id: formData.rol === 'profesional' ? formData.profesional_id : null
      }

      // Solo enviar password si se escribió algo (para editar)
      if (formData.password) {
        dataToSave.password_hash = formData.password // En producción usar hash real
      }

      if (editingId) {
        await usuariosService.update(editingId, dataToSave)
        toast.success('Usuario actualizado')
      } else {
        await usuariosService.create(dataToSave)
        toast.success('Usuario creado')
      }
      
      setShowForm(false)
      loadData()
    } catch (error) {
      toast.error('Error al guardar usuario')
      console.error(error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este usuario?')) return
    try {
      await usuariosService.delete(id)
      toast.success('Usuario eliminado')
      loadData()
    } catch (error) {
      toast.error('Error al eliminar usuario')
    }
  }

  const getSucursalName = (id?: string) => {
    return sucursales.find(s => s.id === id)?.nombre || 'Sin sucursal'
  }

  if (loading) return <div className="p-6">Cargando usuarios...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Usuarios</h1>
        <button
          onClick={handleCreate}
          className="bg-medical-blue hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  className="w-full border rounded-md p-2"
                  value={formData.nombre}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="w-full border rounded-md p-2"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingId ? 'Contraseña (dejar en blanco para mantener)' : 'Contraseña'}
                </label>
                <input
                  type="password"
                  className="w-full border rounded-md p-2"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={formData.rol}
                    onChange={e => {
                      const newRol = e.target.value as any
                      setFormData({...formData, rol: newRol})
                      if (newRol !== 'admin') setIsSuperAdmin(false)
                    }}
                  >
                    <option value="usuario">Recepcionista / Usuario</option>
                    <option value="profesional">Profesional</option>
                    <option value="admin">Administrador</option>
                  </select>

                  {/* Checkbox de Super Admin - Movido aquí para visibilidad directa */}
                  {formData.rol === 'admin' && (
                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-md">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSuperAdmin}
                          onChange={e => setIsSuperAdmin(e.target.checked)}
                          className="h-5 w-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                        />
                        <span className="font-bold text-purple-800">Acceso Global (Super Admin)</span>
                      </label>
                      <p className="text-xs text-purple-600 mt-1 ml-7">
                        Marca esto si el usuario debe gestionar TODAS las sucursales.
                      </p>
                    </div>
                  )}
                </div>

                {/* Eliminamos el bloque anterior y ajustamos la lógica de visualización */}
                {!isSuperAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal Asignada</label>
                    <select
                      className="w-full border rounded-md p-2"
                      value={formData.sucursal_id}
                      onChange={e => setFormData({...formData, sucursal_id: e.target.value})}
                      required={!isSuperAdmin}
                    >
                      {sucursales.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {formData.rol === 'profesional' && (
                <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                  <label className="block text-sm font-medium text-blue-800 mb-1">
                    Vincular con Profesional
                  </label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={formData.profesional_id}
                    onChange={e => setFormData({...formData, profesional_id: e.target.value})}
                    required={formData.rol === 'profesional'}
                  >
                    <option value="">Seleccione un profesional...</option>
                    {profesionales.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} - {p.especialidad}</option>
                    ))}
                  </select>
                  <p className="text-xs text-blue-600 mt-1">
                    Esto permitirá que el usuario vea su agenda personal.
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-medical-blue text-white rounded-md hover:bg-blue-700"
                >
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sucursal</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {usuarios.map(usuario => (
              <tr key={usuario.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="bg-gray-100 rounded-full p-2 mr-3">
                      <User className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{usuario.nombre}</div>
                      <div className="text-sm text-gray-500">{usuario.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    usuario.rol === 'admin' ? 'bg-purple-100 text-purple-800' :
                    usuario.rol === 'profesional' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {usuario.rol === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                    {usuario.rol === 'profesional' && <Stethoscope className="w-3 h-3 mr-1" />}
                    {usuario.rol === 'admin' && !usuario.sucursal_id ? 'Super Admin' : (usuario.rol.charAt(0).toUpperCase() + usuario.rol.slice(1))}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                    {getSucursalName(usuario.sucursal_id)}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handleEdit(usuario)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(usuario.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
