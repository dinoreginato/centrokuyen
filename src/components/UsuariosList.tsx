import { useState, useEffect, useMemo } from 'react'
import { Plus, Edit, Trash2, User, Shield, MapPin, Stethoscope, X, Building2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { Centro, Usuario, Sucursal, Profesional } from '@/types/database'
import { centrosService, usuariosService, sucursalesService, profesionalesService } from '@/utils/supabase'

export default function UsuariosList() {
  const { currentCentro, currentSucursal } = useSucursal()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [centros, setCentros] = useState<Centro[]>([])
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
    centro_id: '',
    sucursal_id: '',
    profesional_id: ''
  })
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false)

  useEffect(() => {
    loadData()
  }, [currentCentro?.id, currentSucursal?.id])

  const sucursalesDelCentro = useMemo(() => {
    if (!formData.centro_id) return []
    return sucursales.filter(sucursal => sucursal.centro_id === formData.centro_id)
  }, [formData.centro_id, sucursales])

  const profesionalesDelCentro = useMemo(() => {
    if (!formData.centro_id) return []
    return profesionales.filter(profesional => profesional.centro_id === formData.centro_id)
  }, [formData.centro_id, profesionales])

  useEffect(() => {
    if (isGlobalAdmin) return
    if (!formData.centro_id || sucursalesDelCentro.length === 0) return
    if (sucursalesDelCentro.some(sucursal => sucursal.id === formData.sucursal_id)) return

    setFormData(prev => ({
      ...prev,
      sucursal_id: sucursalesDelCentro[0]?.id || ''
    }))
  }, [formData.centro_id, formData.sucursal_id, isGlobalAdmin, sucursalesDelCentro])

  const loadData = async () => {
    try {
      setLoading(true)
      const [usuariosData, centrosData, sucursalesData, profesionalesData] = await Promise.all([
        usuariosService.getAll(),
        centrosService.getAll(),
        sucursalesService.getAll(),
        profesionalesService.getAll()
      ])
      setUsuarios(usuariosData)
      setCentros(centrosData)
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
    const defaultCentroId = currentCentro?.id || centros[0]?.id || ''
    const defaultSucursalId = sucursales.find(sucursal => sucursal.centro_id === defaultCentroId)?.id || ''
    setEditingId(null)
    setIsGlobalAdmin(false)
    setFormData({
      nombre: '',
      email: '',
      password: '',
      rol: 'usuario',
      centro_id: defaultCentroId,
      sucursal_id: defaultSucursalId,
      profesional_id: ''
    })
    setShowForm(true)
  }

  const handleEdit = (usuario: Usuario) => {
    setEditingId(usuario.id)
    const centroId = usuario.centro_id || sucursales.find(sucursal => sucursal.id === usuario.sucursal_id)?.centro_id || ''
    const isGlobal = usuario.rol === 'admin' && !usuario.centro_id && !usuario.sucursal_id
    setIsGlobalAdmin(isGlobal)
    setFormData({
      nombre: usuario.nombre,
      email: usuario.email,
      password: '',
      rol: usuario.rol as any,
      centro_id: centroId,
      sucursal_id: usuario.sucursal_id || '',
      profesional_id: usuario.profesional_id || ''
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nombre || !formData.email) {
      toast.error('Complete los campos obligatorios')
      return
    }

    if (!isGlobalAdmin && !formData.centro_id) {
      toast.error('Debe asignar un centro al usuario')
      return
    }

    if (!isGlobalAdmin && !formData.sucursal_id) {
      toast.error('Debe asignar una sucursal al usuario')
      return
    }

    if (!editingId && !formData.password) {
      toast.error('La contraseña es obligatoria para nuevos usuarios')
      return
    }

    try {
      const dataToSave: {
        nombre: string
        email: string
        rol: 'admin' | 'profesional' | 'usuario'
        centro_id: string | null
        sucursal_id: string | null
        profesional_id: string | null
        password?: string
      } = {
        nombre: formData.nombre,
        email: formData.email,
        rol: formData.rol,
        centro_id: isGlobalAdmin ? null : formData.centro_id,
        sucursal_id: isGlobalAdmin ? null : formData.sucursal_id,
        profesional_id: formData.rol === 'profesional' ? formData.profesional_id : null
      }

      // Solo enviar password si se escribió algo (para editar)
      if (formData.password) {
        dataToSave.password = formData.password
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
      const message = error instanceof Error ? error.message : 'Error al guardar usuario'
      toast.error(message)
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

  const getSucursalName = (id?: string | null) => {
    return sucursales.find(s => s.id === id)?.nombre || 'Sin sucursal'
  }

  const getCentroName = (id?: string | null) => {
    return centros.find(centro => centro.id === id)?.nombre || 'Sin centro'
  }

  if (loading) return <div className="p-6">Cargando usuarios...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Usuarios</h1>
        <button
          onClick={handleCreate}
          className="flex items-center justify-center gap-2 rounded-lg bg-medical-blue px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-md border p-2"
                    value={formData.nombre}
                    onChange={e => setFormData({...formData, nombre: e.target.value})}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    required
                    className="w-full rounded-md border p-2"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {editingId ? 'Contraseña (dejar en blanco para mantener)' : 'Contraseña'}
                </label>
                <input
                  type="password"
                  className="w-full rounded-md border p-2"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                  <select
                    className="w-full rounded-md border p-2"
                    value={formData.rol}
                    onChange={e => {
                      const newRol = e.target.value as any
                      setFormData({...formData, rol: newRol, profesional_id: newRol === 'profesional' ? formData.profesional_id : ''})
                      if (newRol !== 'admin') setIsGlobalAdmin(false)
                    }}
                  >
                    <option value="usuario">Recepcionista / Usuario</option>
                    <option value="profesional">Profesional</option>
                    <option value="admin">Administrador</option>
                  </select>

                  {formData.rol === 'admin' && (
                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-md">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isGlobalAdmin}
                          onChange={e => setIsGlobalAdmin(e.target.checked)}
                          className="h-5 w-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                        />
                        <span className="font-bold text-purple-800">Administrador Global</span>
                      </label>
                      <p className="text-xs text-purple-600 mt-1 ml-7">
                        Marca esto si el usuario debe gestionar todos los centros y todas las sucursales.
                      </p>
                    </div>
                  )}
                </div>

                {!isGlobalAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Centro Asignado</label>
                    <select
                      className="w-full rounded-md border p-2"
                      value={formData.centro_id}
                      onChange={e => setFormData({...formData, centro_id: e.target.value, sucursal_id: ''})}
                      required={!isGlobalAdmin}
                    >
                      <option value="">Seleccione un centro...</option>
                      {centros.map(centro => (
                        <option key={centro.id} value={centro.id}>{centro.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {!isGlobalAdmin && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal Asignada</label>
                    <select
                      className="w-full rounded-md border p-2"
                      value={formData.sucursal_id}
                      onChange={e => setFormData({...formData, sucursal_id: e.target.value})}
                      required={!isGlobalAdmin}
                    >
                      <option value="">Seleccione una sucursal...</option>
                      {sucursalesDelCentro.map(sucursal => (
                        <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    <p className="font-medium text-slate-800">Alcance operativo</p>
                    <p className="mt-1">Centro: {getCentroName(formData.centro_id) || 'Sin centro'}</p>
                    <p>Sucursal: {getSucursalName(formData.sucursal_id) || 'Sin sucursal'}</p>
                  </div>
                </div>
              )}

              {formData.rol === 'profesional' && (
                <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                  <label className="block text-sm font-medium text-blue-800 mb-1">
                    Vincular con Profesional
                  </label>
                  <select
                    className="w-full rounded-md border p-2"
                    value={formData.profesional_id}
                    onChange={e => setFormData({...formData, profesional_id: e.target.value})}
                    required={formData.rol === 'profesional'}
                  >
                    <option value="">Seleccione un profesional...</option>
                    {profesionalesDelCentro.map(p => (
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

      <div className="grid gap-4 md:hidden">
        {usuarios.map(usuario => (
          <div key={usuario.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-gray-100 p-2">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{usuario.nombre}</div>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{usuario.email}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(usuario)} className="p-1 text-blue-600 hover:text-blue-800" title="Editar">
                  <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(usuario.id)} className="p-1 text-red-600 hover:text-red-800" title="Eliminar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-400" />
                <span>
                  {usuario.rol === 'admin' && !usuario.centro_id && !usuario.sucursal_id
                    ? 'Administrador Global'
                    : usuario.rol.charAt(0).toUpperCase() + usuario.rol.slice(1)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span>{getCentroName(usuario.centro_id)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{getSucursalName(usuario.sucursal_id)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-lg bg-white shadow-md md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Centro</th>
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
                    {usuario.rol === 'admin' && !usuario.centro_id && !usuario.sucursal_id ? 'Administrador Global' : (usuario.rol.charAt(0).toUpperCase() + usuario.rol.slice(1))}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Building2 className="mr-1 h-4 w-4 text-gray-400" />
                    {getCentroName(usuario.centro_id)}
                  </div>
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
