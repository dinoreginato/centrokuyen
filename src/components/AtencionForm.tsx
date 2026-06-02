import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Save, X, User, Stethoscope, DollarSign, Clock, Calendar, FileText, Repeat } from 'lucide-react'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { useAuth } from '@/contexts/AuthContext'
import { Profesional, Paciente, TipoAtencion } from '@/types/database'
import { atencionesService, profesionalesService, pacientesService, tiposAtencionService } from '@/utils/supabase'
import { addWeeks, format, parseISO } from 'date-fns'

const AtencionForm = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const { currentSucursal } = useSucursal()
  const { user } = useAuth()
  const isEditing = !!id
  
  // Ocultar precios para profesionales en Rengo
  const esProfesionalEnRengo = user?.rol === 'profesional' && currentSucursal?.nombre?.toLowerCase().includes('rengo')

  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [tiposAtencion, setTiposAtencion] = useState<TipoAtencion[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    profesional_id: '',
    paciente_id: '',
    fecha: '',
    hora: '',
    tipo_atencion: '',
    valor_cobrado: 0,
    pagado: false,
    numero_boleta: '',
    observaciones: '',
    recurrencia: 1 // 1 = Solo esta sesión, 4 = Plan Mensual (4 sesiones), etc.
  })

  // Estado para buscador de pacientes
  const [pacienteSearch, setPacienteSearch] = useState('')
  const [showPacienteOptions, setShowPacienteOptions] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [currentSucursal])

  useEffect(() => {
    if (isEditing) return
    const params = new URLSearchParams(location.search)
    const profesionalIdParam = params.get('profesional_id')
    const fechaParam = params.get('fecha')
    const horaParam = params.get('hora')
    const pacienteIdParam = params.get('paciente_id')
    setFormData(prev => {
      const next = { ...prev }
      if (fechaParam && !next.fecha) next.fecha = fechaParam
      if (horaParam && !next.hora) next.hora = horaParam
      if (pacienteIdParam && !next.paciente_id) next.paciente_id = pacienteIdParam
      if (profesionalIdParam && !next.profesional_id && user?.rol !== 'profesional') next.profesional_id = profesionalIdParam
      return next
    })
  }, [isEditing, location.search, user?.rol])

  useEffect(() => {
    if (isEditing) {
      loadAtencion()
    }
  }, [id])

  // Sincronizar nombre del paciente cuando cargan los datos o se edita
  useEffect(() => {
    if (formData.paciente_id && pacientes.length > 0) {
      const paciente = pacientes.find(p => p.id === formData.paciente_id)
      if (paciente) {
        setPacienteSearch(paciente.nombre)
      }
    }
  }, [formData.paciente_id, pacientes])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [profesionalesData, pacientesData, tiposData] = await Promise.all([
        profesionalesService.getAll(currentSucursal?.id),
        pacientesService.getAll(currentSucursal?.id),
        tiposAtencionService.getAll(currentSucursal?.id)
      ])

      let filteredProfesionales = profesionalesData
      if (user?.rol === 'profesional' && user.profesional_id) {
        filteredProfesionales = profesionalesData.filter(p => p.id === user.profesional_id)
        // Preseleccionar si es nueva atención
        if (!isEditing) {
          setFormData(prev => ({ ...prev, profesional_id: user.profesional_id! }))
        }
      }

      setProfesionales(filteredProfesionales)
      setPacientes(pacientesData)
      setTiposAtencion(tiposData)
    } catch (error) {
      toast.error('Error al cargar datos iniciales')
      console.error('Error loading initial data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAtencion = async () => {
    try {
      const atencion = await atencionesService.getById(id!)
      if (atencion) {
        setFormData({
          profesional_id: atencion.profesional_id,
          paciente_id: atencion.paciente_id,
          fecha: atencion.fecha,
          hora: atencion.hora.substring(0, 5),
          tipo_atencion: atencion.tipo_atencion,
          valor_cobrado: atencion.valor_cobrado,
          pagado: atencion.pagado,
          numero_boleta: atencion.numero_boleta || '',
          observaciones: atencion.observaciones,
          recurrencia: 1
        })
      }
    } catch (error) {
      toast.error('Error al cargar la atención')
      console.error('Error loading atencion:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.profesional_id) {
      toast.error('Debe seleccionar un profesional')
      return
    }

    if (!formData.paciente_id) {
      toast.error('Debe seleccionar un paciente')
      return
    }

    if (!formData.fecha) {
      toast.error('Debe seleccionar una fecha')
      return
    }

    if (!formData.hora) {
      toast.error('Debe seleccionar una hora')
      return
    }

    if (!formData.tipo_atencion) {
      toast.error('Debe seleccionar un tipo de atención')
      return
    }

    if (formData.valor_cobrado <= 0) {
      toast.error('El valor cobrado debe ser mayor a 0')
      return
    }

    if (!currentSucursal) {
      toast.error('Error: No hay sucursal activa seleccionada')
      return
    }

    try {
      setSaving(true)
      
      const dataToSave = {
        ...formData,
        sucursal_id: currentSucursal.id
      }

      if (isEditing) {
        // Al editar, solo modificamos la cita actual
        const { recurrencia, ...updateData } = dataToSave
        await atencionesService.update(id!, updateData)
        toast.success('Atención actualizada exitosamente')
      } else {
        // Si es nueva y tiene recurrencia, crear múltiples citas semanales
        const sesiones = formData.recurrencia || 1
        const { recurrencia, ...baseData } = dataToSave
        
        if (sesiones > 1) {
          const promesas = []
          let currentDate = parseISO(baseData.fecha)
          
          for (let i = 0; i < sesiones; i++) {
            const sesionData = {
              ...baseData,
              fecha: format(currentDate, 'yyyy-MM-dd'),
              observaciones: sesiones > 1 
                ? `${baseData.observaciones}\n(Sesión ${i + 1} de ${sesiones} - Plan Mensual)`
                : baseData.observaciones
            }
            promesas.push(atencionesService.create(sesionData))
            // Avanzar a la misma hora de la próxima semana
            currentDate = addWeeks(currentDate, 1)
          }
          
          await Promise.all(promesas)
          toast.success(`Se crearon ${sesiones} sesiones semanales exitosamente`)
        } else {
          await atencionesService.create(baseData)
          toast.success('Atención creada exitosamente')
        }
      }
      
      navigate('/agenda')
    } catch (error) {
      toast.error(`Error al ${isEditing ? 'actualizar' : 'crear'} la atención`)
      console.error('Error saving atencion:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
               type === 'number' ? parseFloat(value) || 0 : value
    }))
  }

  const handleTipoAtencionChange = (tipoId: string) => {
    const tipo = tiposAtencion.find(t => t.id === tipoId)
    setFormData(prev => ({
      ...prev,
      tipo_atencion: tipoId,
      valor_cobrado: tipo?.valor_base || 0
    }))
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
      </div>
    )
  }

  const generateTimeSlots = () => {
    const slots = []
    for (let i = 8; i <= 22; i++) {
      for (let j = 0; j < 60; j += 15) {
        // Stop at 22:00
        if (i === 22 && j > 0) break
        
        const hour = i.toString().padStart(2, '0')
        const minute = j.toString().padStart(2, '0')
        slots.push(`${hour}:${minute}`)
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {isEditing ? 'Editar Atención' : 'Nueva Atención'}
        </h1>
        <button
          onClick={() => navigate('/agenda')}
          className="text-gray-600 hover:text-gray-800 p-2"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="profesional_id" className="block text-sm font-medium text-gray-700 mb-2">
              Profesional *
            </label>
            <div className="relative">
              <Stethoscope className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <select
                id="profesional_id"
                name="profesional_id"
                value={formData.profesional_id}
                onChange={handleChange}
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
                disabled={user?.rol === 'profesional'}
              >
                <option value="">Seleccione un profesional</option>
                {profesionales.map(profesional => (
                  <option key={profesional.id} value={profesional.id}>
                    {profesional.nombre} - {profesional.especialidad}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="paciente_id" className="block text-sm font-medium text-gray-700 mb-2">
              Paciente *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={pacienteSearch}
                onChange={(e) => {
                  setPacienteSearch(e.target.value)
                  setShowPacienteOptions(true)
                  if (e.target.value === '') {
                     setFormData(prev => ({ ...prev, paciente_id: '' }))
                  }
                }}
                onFocus={() => setShowPacienteOptions(true)}
                onBlur={() => setTimeout(() => setShowPacienteOptions(false), 200)}
                placeholder="Buscar por nombre o RUT..."
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                autoComplete="off"
              />
              
              {showPacienteOptions && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {pacientes.filter(p => 
                    p.nombre.toLowerCase().includes(pacienteSearch.toLowerCase()) || 
                    p.rut.toLowerCase().includes(pacienteSearch.toLowerCase())
                  ).length > 0 ? (
                    pacientes.filter(p => 
                      p.nombre.toLowerCase().includes(pacienteSearch.toLowerCase()) || 
                      p.rut.toLowerCase().includes(pacienteSearch.toLowerCase())
                    ).map(paciente => (
                      <div
                        key={paciente.id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, paciente_id: paciente.id }))
                          setPacienteSearch(paciente.nombre)
                          setShowPacienteOptions(false)
                        }}
                      >
                        <div className="font-medium">{paciente.nombre}</div>
                        <div className="text-gray-500 text-xs">RUT: {paciente.rut}</div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-gray-500 text-sm">No se encontraron pacientes</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="fecha" className="block text-sm font-medium text-gray-700 mb-2">
              Fecha *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="date"
                id="fecha"
                name="fecha"
                value={formData.fecha}
                onChange={handleChange}
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="hora" className="block text-sm font-medium text-gray-700 mb-2">
              Hora *
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <select
                id="hora"
                name="hora"
                value={formData.hora}
                onChange={handleChange}
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue appearance-none"
                required
              >
                <option value="">Seleccione hora</option>
                {formData.hora && !timeSlots.includes(formData.hora) && (
                  <option value={formData.hora}>{formData.hora} hrs</option>
                )}
                {timeSlots.map(time => (
                  <option key={time} value={time}>
                    {time} hrs
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tipo_atencion" className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Atención *
            </label>
            <select
              id="tipo_atencion"
              name="tipo_atencion"
              value={formData.tipo_atencion}
              onChange={(e) => handleTipoAtencionChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
              required
            >
              <option value="">Seleccione un tipo</option>
              {tiposAtencion.map(tipo => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nombre} {esProfesionalEnRengo ? '' : `- $${tipo.valor_base}`}
                </option>
              ))}
            </select>
          </div>

          {!esProfesionalEnRengo && (
            <div>
              <label htmlFor="valor_cobrado" className="block text-sm font-medium text-gray-700 mb-2">
                Valor Cobrado *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  id="valor_cobrado"
                  name="valor_cobrado"
                  value={formData.valor_cobrado}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                  required
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="observaciones" className="block text-sm font-medium text-gray-700 mb-2">
            Observaciones
          </label>
          <textarea
            id="observaciones"
            name="observaciones"
            rows={4}
            value={formData.observaciones}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
            placeholder="Notas sobre la atención..."
          />
        </div>

        <div>
          <label htmlFor="numero_boleta" className="block text-sm font-medium text-gray-700 mb-2">
            Número de Boleta (Opcional)
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              id="numero_boleta"
              name="numero_boleta"
              value={formData.numero_boleta}
              onChange={handleChange}
              className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
              placeholder="Ingrese el número de boleta"
            />
          </div>
        </div>

        {!esProfesionalEnRengo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col justify-center">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="pagado"
                  name="pagado"
                  checked={formData.pagado}
                  onChange={handleChange}
                  className="h-4 w-4 text-medical-blue focus:ring-medical-blue border-gray-300 rounded"
                />
                <label htmlFor="pagado" className="ml-2 block text-sm text-gray-900">
                  Atención pagada
                </label>
              </div>
            </div>

            {!isEditing && (
              <div>
                <label htmlFor="recurrencia" className="block text-sm font-medium text-gray-700 mb-2">
                  Plan / Recurrencia
                </label>
                <div className="relative">
                  <Repeat className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <select
                    id="recurrencia"
                    name="recurrencia"
                    value={formData.recurrencia}
                    onChange={handleChange}
                    className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue appearance-none"
                  >
                    <option value={1}>Sesión Única</option>
                    <option value={4}>Plan Mensual (4 sesiones, 1 por semana)</option>
                    <option value={8}>Plan Bimestral (8 sesiones, 1 por semana)</option>
                    <option value={12}>Plan Trimestral (12 sesiones, 1 por semana)</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">Se agendarán automáticamente a la misma hora en las semanas siguientes.</p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/agenda')}
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

export default AtencionForm
