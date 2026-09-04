import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Save, Building, Phone, CreditCard, Users, Plus, CheckCircle2, Pencil, Trash2, History, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { auditService, centrosService } from '@/utils/supabase'
import { AuditLog } from '@/types/database'
import SucursalesList from './SucursalesList'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import PageLoader from '@/components/ui/PageLoader'

const Configuracion = () => {
  const { currentCentro, centros, setCentro } = useSucursal()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [creatingCentro, setCreatingCentro] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loadingAudit, setLoadingAudit] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [auditFilters, setAuditFilters] = useState({
    tableName: 'todos',
    action: 'todos',
    actorQuery: '',
    search: ''
  })
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    cuit: '',
    logo_url: ''
  })

  useEffect(() => {
    if (currentCentro) {
      setFormData({
        nombre: currentCentro.nombre || '',
        direccion: currentCentro.direccion || '',
        telefono: currentCentro.telefono || '',
        cuit: currentCentro.cuit || '',
        logo_url: currentCentro.logo_url || ''
      })
      setCreatingCentro(false)
    } else if (centros.length === 0) {
      setCreatingCentro(true)
    }

    setLoading(false)
  }, [currentCentro, centros])

  useEffect(() => {
    loadAuditLogs()
  }, [auditFilters])

  const loadAuditLogs = async () => {
    try {
      setLoadingAudit(true)
      const logs = await auditService.getRecent(50, auditFilters)
      setAuditLogs(logs)
    } catch (error) {
      console.error('Error loading audit logs:', error)
    } finally {
      setLoadingAudit(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nombre.trim()) {
      toast.error('El nombre del centro es requerido')
      return
    }

    try {
      setSaving(true)

      if (creatingCentro || !currentCentro) {
        await centrosService.create({
          ...formData,
          activo: true
        })
        toast.success('Centro creado exitosamente')
      } else {
        await centrosService.update(currentCentro.id, formData)
        toast.success('Centro actualizado exitosamente')
      }

      setTimeout(() => window.location.reload(), 600)
    } catch (error) {
      toast.error('Error al guardar la configuración')
      console.error('Error saving config:', error)
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

  const handleNewCentro = () => {
    setCreatingCentro(true)
    setFormData({
      nombre: '',
      direccion: '',
      telefono: '',
      cuit: '',
      logo_url: ''
    })
  }

  const loadCurrentCentroIntoForm = () => {
    if (!currentCentro) return

    setFormData({
      nombre: currentCentro.nombre || '',
      direccion: currentCentro.direccion || '',
      telefono: currentCentro.telefono || '',
      cuit: currentCentro.cuit || '',
      logo_url: currentCentro.logo_url || ''
    })
    setCreatingCentro(false)
  }

  const handleDeleteCentro = async () => {
    if (!currentCentro) {
      toast.error('Selecciona un centro para eliminar')
      return
    }

    if (centros.length <= 1) {
      toast.error('No puedes eliminar el único centro disponible')
      return
    }

    try {
      setDeleting(true)
      await centrosService.delete(currentCentro.id)
      toast.success('Centro eliminado exitosamente')
      setShowDeleteDialog(false)
      setTimeout(() => window.location.reload(), 600)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar el centro'
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  const formatAuditAction = (log: AuditLog) => {
    if (log.table_name === 'atenciones' && log.metadata?.estado_cita_nuevo) {
      return `Cambio de estado a ${String(log.metadata.estado_cita_nuevo).replace('_', ' ')}`
    }

    switch (log.action) {
      case 'INSERT':
        return 'Creación'
      case 'UPDATE':
        return 'Edición'
      case 'SOFT_DELETE':
        return 'Eliminación lógica'
      default:
        return log.action
    }
  }

  const formatAuditEntity = (log: AuditLog) => {
    switch (log.table_name) {
      case 'atenciones':
        return 'Atención'
      case 'pacientes':
        return 'Paciente'
      case 'profesionales':
        return 'Profesional'
      case 'costos':
        return 'Costo'
      case 'usuarios':
        return 'Usuario'
      case 'centros':
        return 'Centro'
      case 'sucursales':
        return 'Sucursal'
      case 'tipos_atencion':
        return 'Tipo de atención'
      case 'profesional_comisiones':
        return 'Comisión profesional'
      default:
        return log.table_name
    }
  }

  if (loading) {
    return <PageLoader label="Cargando configuración del centro..." />
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Configuración Multi-Centro</h1>
        <div className="text-sm text-gray-500">
          {creatingCentro
            ? 'Creando un nuevo centro'
            : `Centro activo: ${currentCentro?.nombre || 'Sin seleccionar'}`}
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Centros disponibles</h2>
            <p className="text-sm text-gray-500">Selecciona un centro para editarlo, administrar sus sucursales o eliminarlo si no tiene datos asociados.</p>
          </div>
          <button
            type="button"
            onClick={handleNewCentro}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-medical-blue px-4 py-2 text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Centro</span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {centros.map(centro => (
            <button
              key={centro.id}
              type="button"
              onClick={() => setCentro(centro)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                currentCentro?.id === centro.id && !creatingCentro
                  ? 'border-blue-200 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${currentCentro?.id === centro.id && !creatingCentro ? 'text-blue-600' : 'text-gray-300'}`} />
                <span className="font-medium">{centro.nombre}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{centro.telefono || 'Sin teléfono'}</p>
              <p className="mt-2 text-xs font-medium text-medical-blue">
                {currentCentro?.id === centro.id && !creatingCentro ? 'Centro seleccionado para edición' : 'Haz clic para editar este centro'}
              </p>
            </button>
          ))}
        </div>

        {!creatingCentro && currentCentro && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Centro seleccionado</p>
                <p className="text-sm text-slate-600">{currentCentro.nombre}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={loadCurrentCentroIntoForm}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Pencil className="h-4 w-4" />
                  <span>Editar Centro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleting || saving || centros.length <= 1}
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{deleting ? 'Eliminando...' : 'Eliminar Centro'}</span>
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Solo se puede eliminar un centro si no tiene sucursales, usuarios, profesionales, pacientes, atenciones, costos ni tipos de atención asociados.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center">
            <Building className="h-6 w-6 text-medical-blue mr-2" />
            <h2 className="text-lg font-semibold text-gray-800">
              {creatingCentro ? 'Nuevo Centro' : 'Editar Centro'}
            </h2>
          </div>
          {!creatingCentro && currentCentro && (
            <p className="text-sm text-gray-500">
              Editando: <span className="font-medium text-gray-700">{currentCentro.nombre}</span>
            </p>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Centro *
              </label>
              <input
                type="text"
                id="nombre"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                placeholder="Ej: Centro Kuyen Rengo"
                required
              />
            </div>

            <div>
              <label htmlFor="cuit" className="block text-sm font-medium text-gray-700 mb-2">
                CUIT
              </label>
              <input
                type="text"
                id="cuit"
                name="cuit"
                value={formData.cuit}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                placeholder="XX-XXXXXXXX-X"
              />
            </div>
          </div>

          <div>
            <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 mb-2">
              Dirección
            </label>
            <textarea
              id="direccion"
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
              placeholder="Calle Principal 123, Ciudad, Provincia"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  id="telefono"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                  placeholder="(011) 1234-5678"
                />
              </div>
            </div>

            <div>
              <label htmlFor="logo_url" className="block text-sm font-medium text-gray-700 mb-2">
                URL del Logo
              </label>
              <input
                type="url"
                id="logo_url"
                name="logo_url"
                value={formData.logo_url}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                placeholder="https://..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Puedes pegar una URL pública del logo de este centro.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                if (currentCentro) {
                  loadCurrentCentroIntoForm()
                  setCreatingCentro(false)
                } else {
                  handleNewCentro()
                }
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-medical-blue hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Guardando...' : creatingCentro ? 'Crear Centro' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>

      <SucursalesList />

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center mb-4">
          <CreditCard className="h-6 w-6 text-medical-green mr-2" />
          <h2 className="text-lg font-semibold text-gray-800">Configuración de Pagos</h2>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-2">
            Los pagos a profesionales se configuran individualmente en cada perfil de profesional.
          </p>
          <p className="text-sm text-gray-600">
            Puedes establecer pagos por porcentaje (%) o monto fijo ($) por atención.
          </p>
          <Link
            to="/profesionales"
            className="inline-flex items-center mt-3 text-medical-blue hover:text-blue-700 text-sm font-medium"
          >
            <Users className="h-4 w-4 mr-1" />
            Gestionar Profesionales
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Información del Sistema</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Versión del Sistema:</p>
            <p className="font-medium">v1.0.0</p>
          </div>
          <div>
            <p className="text-gray-600">Última Actualización:</p>
            <p className="font-medium">{new Date().toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-600">Base de Datos:</p>
            <p className="font-medium">PostgreSQL (Supabase)</p>
          </div>
          <div>
            <p className="text-gray-600">Módulos Activos:</p>
            <p className="font-medium">Multi-centro, multi-sucursal y operación móvil</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center">
            <History className="mr-2 h-6 w-6 text-slate-700" />
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Bitácora Reciente</h2>
              <p className="text-sm text-gray-500">Últimos cambios sensibles registrados en el sistema.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadAuditLogs}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            disabled={loadingAudit}
          >
            <RefreshCw className={`h-4 w-4 ${loadingAudit ? 'animate-spin' : ''}`} />
            <span>{loadingAudit ? 'Actualizando...' : 'Actualizar bitácora'}</span>
          </button>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <label className="relative md:col-span-2">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={auditFilters.search}
              onChange={(e) => setAuditFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Buscar por entidad o registro"
              className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-medical-blue focus:ring-medical-blue"
            />
          </label>

          <select
            value={auditFilters.tableName}
            onChange={(e) => setAuditFilters(prev => ({ ...prev, tableName: e.target.value }))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-medical-blue focus:ring-medical-blue"
          >
            <option value="todos">Todas las entidades</option>
            <option value="atenciones">Atenciones</option>
            <option value="pacientes">Pacientes</option>
            <option value="profesionales">Profesionales</option>
            <option value="usuarios">Usuarios</option>
            <option value="costos">Costos</option>
            <option value="centros">Centros</option>
            <option value="sucursales">Sucursales</option>
            <option value="tipos_atencion">Tipos de atención</option>
          </select>

          <select
            value={auditFilters.action}
            onChange={(e) => setAuditFilters(prev => ({ ...prev, action: e.target.value }))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-medical-blue focus:ring-medical-blue"
          >
            <option value="todos">Todas las acciones</option>
            <option value="INSERT">Creación</option>
            <option value="UPDATE">Edición</option>
            <option value="SOFT_DELETE">Eliminación lógica</option>
          </select>

          <input
            type="text"
            value={auditFilters.actorQuery}
            onChange={(e) => setAuditFilters(prev => ({ ...prev, actorQuery: e.target.value }))}
            placeholder="Filtrar por actor o email"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-medical-blue focus:ring-medical-blue md:col-span-2"
          />

          <button
            type="button"
            onClick={() => setAuditFilters({ tableName: 'todos', action: 'todos', actorQuery: '', search: '' })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Limpiar filtros
          </button>

          <div className="flex items-center justify-end text-sm text-gray-500 md:col-span-1">
            {auditLogs.length} evento(s)
          </div>
        </div>

        {loadingAudit ? (
          <PageLoader compact label="Actualizando bitácora..." />
        ) : auditLogs.length === 0 ? (
          <EmptyState
            icon={History}
            title="Sin eventos para los filtros actuales"
            description="Prueba cambiando la búsqueda, la entidad o la acción para encontrar registros en la bitácora."
          />
        ) : (
          <div className="space-y-3">
            {auditLogs.map(log => (
              <div key={log.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {formatAuditEntity(log)}: {formatAuditAction(log)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {log.actor_name || log.actor_email || 'Usuario desconocido'}
                      {log.actor_role ? ` · ${log.actor_role}` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-gray-600 md:grid-cols-2">
                  <p>Entidad: <span className="font-medium text-gray-800">{log.table_name}</span></p>
                  <p>Registro: <span className="font-medium text-gray-800">{log.record_id}</span></p>
                  {log.actor_email && <p>Email: <span className="font-medium text-gray-800">{log.actor_email}</span></p>}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <p>Detalle: <span className="font-medium text-gray-800">{JSON.stringify(log.metadata)}</span></p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        title="Eliminar centro"
        description={currentCentro ? `Vas a eliminar el centro "${currentCentro.nombre}". Esta acción solo funciona si no tiene datos asociados.` : 'Selecciona un centro para eliminar.'}
        confirmLabel="Eliminar centro"
        cancelLabel="Cancelar"
        tone="danger"
        loading={deleting}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteCentro}
      />
    </div>
  )
}

export default Configuracion
