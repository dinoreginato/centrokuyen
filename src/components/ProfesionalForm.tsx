import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, X, Plus, Trash2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { profesionalesService, tiposAtencionService, profesionalComisionesService, profesionalDisponibilidadService } from '@/utils/supabase'
import { TipoAtencion, ProfesionalComision, ProfesionalDisponibilidad } from '@/types/database'
import PageLoader from '@/components/ui/PageLoader'

type DisponibilidadFormRow = {
  dia_semana: number
  activo: boolean
  hora_inicio: string
  hora_fin: string
}

const DIAS_SEMANA: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' }
]

const buildInitialDisponibilidad = (): DisponibilidadFormRow[] =>
  DIAS_SEMANA.map((dia) => ({
    dia_semana: dia.value,
    activo: false,
    hora_inicio: '09:00',
    hora_fin: '18:00'
  }))

const mapDisponibilidadToForm = (rows: ProfesionalDisponibilidad[]): DisponibilidadFormRow[] =>
  buildInitialDisponibilidad().map((base) => {
    const row = rows.find((item) => item.dia_semana === base.dia_semana)

    if (!row) return base

    return {
      dia_semana: base.dia_semana,
      activo: true,
      hora_inicio: row.hora_inicio.substring(0, 5),
      hora_fin: row.hora_fin.substring(0, 5)
    }
  })

const ProfesionalForm = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { currentCentro, currentSucursal } = useSucursal()
  const isEditing = !!id

  const [formData, setFormData] = useState({
    nombre: '',
    especialidad: '',
    email: '',
    telefono: '',
    porcentaje_pago: 70,
    monto_fijo_pago: 0,
    activo: true
  })

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [tiposAtencion, setTiposAtencion] = useState<TipoAtencion[]>([])
  const [comisiones, setComisiones] = useState<ProfesionalComision[]>([])
  const [newComision, setNewComision] = useState({ tipo_atencion_id: '', porcentaje: '' })
  const [disponibilidad, setDisponibilidad] = useState<DisponibilidadFormRow[]>(buildInitialDisponibilidad())
  const [profesionalSucursalId, setProfesionalSucursalId] = useState<string | null>(currentSucursal?.id || null)

  useEffect(() => {
    if (isEditing) {
      loadProfesional()
    } else {
      // Cargar tipos de atención para cuando se cree
      loadTiposAtencion()
    }
  }, [id])

  const loadTiposAtencion = async () => {
    try {
      const data = await tiposAtencionService.getAll(currentSucursal?.id, currentCentro?.id)
      setTiposAtencion(data)
    } catch (error) {
      console.error('Error cargando tipos de atención:', error)
    }
  }

  const loadProfesional = async () => {
    try {
      setLoading(true)
      const [profesional, tiposData, comisionesData, disponibilidadData] = await Promise.all([
        profesionalesService.getById(id!),
        tiposAtencionService.getAll(currentSucursal?.id, currentCentro?.id),
        profesionalComisionesService.getAll(id!),
        profesionalDisponibilidadService.getByProfesional(id!, currentSucursal?.id)
      ])
      
      setTiposAtencion(tiposData)
      setComisiones(comisionesData)

      if (profesional) {
        setProfesionalSucursalId(profesional.sucursal_id || currentSucursal?.id || null)
        setFormData({
          nombre: profesional.nombre,
          especialidad: profesional.especialidad,
          email: profesional.email || '',
          telefono: profesional.telefono || '',
          porcentaje_pago: profesional.porcentaje_pago,
          monto_fijo_pago: profesional.monto_fijo_pago,
          activo: profesional.activo
        })
        setDisponibilidad(mapDisponibilidadToForm(disponibilidadData))
      }
    } catch (error) {
      toast.error('Error al cargar el profesional')
      console.error('Error loading profesional:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddComision = async () => {
    if (!newComision.tipo_atencion_id || !newComision.porcentaje) {
      toast.error('Complete los campos de la comisión')
      return
    }
    
    // Verificar duplicados
    if (comisiones.some(c => c.tipo_atencion_id === newComision.tipo_atencion_id)) {
        toast.error('Ya existe una configuración para este tipo de atención')
        return
    }

    try {
      await profesionalComisionesService.create({
        profesional_id: id!,
        tipo_atencion_id: newComision.tipo_atencion_id,
        porcentaje: parseFloat(newComision.porcentaje),
        monto_fijo: 0
      })
      
      const updatedComisiones = await profesionalComisionesService.getAll(id!)
      setComisiones(updatedComisiones)
      setNewComision({ tipo_atencion_id: '', porcentaje: '' })
      toast.success('Comisión agregada')
    } catch (error) {
      toast.error('Error al agregar comisión')
      console.error(error)
    }
  }

  const handleDeleteComision = async (comisionId: string) => {
    try {
      await profesionalComisionesService.delete(comisionId)
      setComisiones(prev => prev.filter(c => c.id !== comisionId))
      toast.success('Comisión eliminada')
    } catch (error) {
      toast.error('Error al eliminar comisión')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    if (!formData.especialidad.trim()) {
      toast.error('La especialidad es requerida')
      return
    }

    try {
      setSaving(true)
      
      const email = formData.email?.trim() || null
      const telefono = formData.telefono?.trim() || null
      
      const profesionalData = {
        ...formData,
        email: email === '' ? null : email,
        telefono: telefono === '' ? null : telefono,
        centro_id: currentCentro?.id || currentSucursal?.centro_id || null,
        sucursal_id: currentSucursal?.id || null
      }

      const disponibilidadActiva = disponibilidad
        .filter((item) => item.activo)
        .map((item) => ({
          dia_semana: item.dia_semana,
          hora_inicio: `${item.hora_inicio}:00`,
          hora_fin: `${item.hora_fin}:00`
        }))

      const disponibilidadInvalida = disponibilidad
        .filter((item) => item.activo)
        .find((item) => item.hora_inicio >= item.hora_fin)

      if (disponibilidadInvalida) {
        const dia = DIAS_SEMANA.find((item) => item.value === disponibilidadInvalida.dia_semana)?.label || 'día seleccionado'
        throw new Error(`El horario de ${dia} tiene una hora de inicio mayor o igual a la hora de término`)
      }

      const sucursalDisponibilidadId = profesionalData.sucursal_id || profesionalSucursalId

      if (disponibilidadActiva.length > 0 && !sucursalDisponibilidadId) {
        throw new Error('Debes tener una sucursal activa para guardar la disponibilidad del profesional')
      }

      let profesionalId = id

      if (isEditing) {
        await profesionalesService.update(id!, profesionalData)
        profesionalId = id!
        toast.success('Profesional actualizado exitosamente')
      } else {
        const nuevoProfesional = await profesionalesService.create(profesionalData)
        profesionalId = nuevoProfesional.id
        setProfesionalSucursalId(nuevoProfesional.sucursal_id || currentSucursal?.id || null)
        toast.success('Profesional creado exitosamente')
      }

      if (profesionalId && sucursalDisponibilidadId) {
        await profesionalDisponibilidadService.replaceForProfesional(
          profesionalId,
          sucursalDisponibilidadId,
          disponibilidadActiva
        )
      }
      
      navigate('/profesionales')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al guardar profesional'
      toast.error(`Error: ${errorMessage}`)
      console.error('Error saving profesional:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
               type === 'number' ? parseFloat(value) || 0 : value
    }))
  }

  const handleDisponibilidadToggle = (diaSemana: number, activo: boolean) => {
    setDisponibilidad((prev) =>
      prev.map((item) =>
        item.dia_semana === diaSemana
          ? { ...item, activo }
          : item
      )
    )
  }

  const handleDisponibilidadTimeChange = (
    diaSemana: number,
    field: 'hora_inicio' | 'hora_fin',
    value: string
  ) => {
    setDisponibilidad((prev) =>
      prev.map((item) =>
        item.dia_semana === diaSemana
          ? { ...item, [field]: value }
          : item
      )
    )
  }

  if (loading) {
    return <PageLoader label="Cargando profesional..." />
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {isEditing ? 'Editar Profesional' : 'Nuevo Profesional'}
        </h1>
        <button
          onClick={() => navigate('/profesionales')}
          className="text-gray-600 hover:text-gray-800 p-2"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre completo *
            </label>
            <input
              type="text"
              id="nombre"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
              required
            />
          </div>

          <div>
            <label htmlFor="especialidad" className="block text-sm font-medium text-gray-700 mb-2">
              Especialidad *
            </label>
            <input
              type="text"
              id="especialidad"
              name="especialidad"
              value={formData.especialidad}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
            />
          </div>

          <div>
            <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-2">
              Teléfono
            </label>
            <input
              type="tel"
              id="telefono"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Configuración de Pago</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="porcentaje_pago" className="block text-sm font-medium text-gray-700 mb-2">
                Porcentaje de pago (%)
              </label>
              <input
                type="number"
                id="porcentaje_pago"
                name="porcentaje_pago"
                value={formData.porcentaje_pago}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
              />
              <p className="text-sm text-gray-500 mt-1">
                Porcentaje que el profesional recibe por cada atención
              </p>
            </div>

            <div>
              <label htmlFor="monto_fijo_pago" className="block text-sm font-medium text-gray-700 mb-2">
                Monto fijo de pago ($)
              </label>
              <input
                type="number"
                id="monto_fijo_pago"
                name="monto_fijo_pago"
                value={formData.monto_fijo_pago}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
              />
              <p className="text-sm text-gray-500 mt-1">
                Monto fijo que el profesional recibe por cada atención
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-medium text-gray-800">Disponibilidad Semanal</h3>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            Define el rango horario en que cada profesional atiende. Fuera de ese horario, la agenda marcará el bloque como no agendable.
          </p>

          <div className="space-y-3">
            {DIAS_SEMANA.map((dia) => {
              const row = disponibilidad.find((item) => item.dia_semana === dia.value)

              if (!row) return null

              return (
                <div
                  key={dia.value}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 md:grid-cols-[180px_1fr_1fr]"
                >
                  <label className="flex items-center gap-3 text-sm font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={row.activo}
                      onChange={(e) => handleDisponibilidadToggle(dia.value, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-medical-blue focus:ring-medical-blue"
                    />
                    <span>{dia.label}</span>
                  </label>

                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                      Desde
                    </label>
                    <input
                      type="time"
                      value={row.hora_inicio}
                      onChange={(e) => handleDisponibilidadTimeChange(dia.value, 'hora_inicio', e.target.value)}
                      disabled={!row.activo}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-medical-blue focus:ring-medical-blue disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                      Hasta
                    </label>
                    <input
                      type="time"
                      value={row.hora_fin}
                      onChange={(e) => handleDisponibilidadTimeChange(dia.value, 'hora_fin', e.target.value)}
                      disabled={!row.activo}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-medical-blue focus:ring-medical-blue disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Comisiones Específicas por Tipo de Atención</h3>
          
          {!isEditing ? (
            <p className="text-sm text-gray-500 italic">Guarde el profesional primero para configurar excepciones específicas.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Atención</label>
                  <select
                    value={newComision.tipo_atencion_id}
                    onChange={(e) => setNewComision({ ...newComision, tipo_atencion_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                  >
                    <option value="">Seleccione tipo de atención...</option>
                    {tiposAtencion.map(tipo => (
                      <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-1">% Comisión</label>
                  <input
                    type="number"
                    value={newComision.porcentaje}
                    onChange={(e) => setNewComision({ ...newComision, porcentaje: e.target.value })}
                    min="0"
                    max="100"
                    placeholder="Ej: 60"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddComision}
                  className="bg-green-600 text-white p-2 rounded-md hover:bg-green-700 mb-0.5"
                  title="Agregar excepción"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {comisiones.length > 0 && (
                <div className="mt-4 border border-gray-200 rounded-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo Atención</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Porcentaje</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {comisiones.map((comision) => (
                        <tr key={comision.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comision.tipos_atencion?.nombre || 'Desconocido'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comision.porcentaje}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              type="button"
                              onClick={() => handleDeleteComision(comision.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Eliminar excepción"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="activo"
            name="activo"
            checked={formData.activo}
            onChange={handleChange}
            className="h-4 w-4 text-medical-blue focus:ring-medical-blue border-gray-300 rounded"
          />
          <label htmlFor="activo" className="ml-2 block text-sm text-gray-900">
            Profesional activo
          </label>
        </div>

        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/profesionales')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-medical-blue hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center space-x-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Guardando...' : 'Guardar'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

export default ProfesionalForm
