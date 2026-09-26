import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Save, X, User, Stethoscope, DollarSign, Clock, Calendar, FileText, Repeat } from 'lucide-react'
import { addWeeks, eachDayOfInterval, format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { useAuth } from '@/contexts/AuthContext'
import { Profesional, Paciente, TipoAtencion, Atencion, ProfesionalDisponibilidad } from '@/types/database'
import { atencionesService, profesionalDisponibilidadService, profesionalesService, pacientesService, tiposAtencionService } from '@/utils/supabase'
import { ESTADO_CITA_OPTIONS, getEstadoCitaLabel } from '@/utils/atencionEstado'
import { BLOQUEO_OPTIONS, buildBloqueoSlots, generateBloqueoTimeOptions, getBloqueoLabel, getNextBloqueoTime, getSuggestedBloqueoRange } from '@/utils/bloqueos'
import { hasPermission } from '@/utils/permissions'
import PageLoader from '@/components/ui/PageLoader'

type EstadoCita = NonNullable<Atencion['estado_cita']>
type TipoBloqueo = NonNullable<Atencion['tipo_bloqueo']>

const createPlanId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

type AtencionFormData = {
  profesional_id: string
  paciente_id: string
  fecha: string
  hora: string
  tipo_atencion: string
  valor_cobrado: number
  pagado: boolean
  numero_boleta: string
  observaciones: string
  recurrencia: number
  estado_cita: EstadoCita
  es_bloqueo: boolean
  tipo_bloqueo: TipoBloqueo
}

type BloqueoFormData = {
  fecha_fin: string
  hora_fin: string
  dia_completo: boolean
}

const AtencionForm = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const { currentCentro, currentSucursal } = useSucursal()
  const { user } = useAuth()
  const isEditing = !!id
  const reagendaId = !isEditing ? new URLSearchParams(location.search).get('reagenda_id') : null
  const isReagendaFlow = !!reagendaId
  const canViewFinancialFields = hasPermission(user, 'viewFinancialFields')
  const canSelectAnyProfessional = hasPermission(user, 'selectAnyProfessional')

  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [tiposAtencion, setTiposAtencion] = useState<TipoAtencion[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bloqueoDisponibilidad, setBloqueoDisponibilidad] = useState<ProfesionalDisponibilidad[]>([])

  const [formData, setFormData] = useState<AtencionFormData>({
    profesional_id: '',
    paciente_id: '',
    fecha: '',
    hora: '',
    tipo_atencion: '',
    valor_cobrado: 0,
    pagado: false,
    numero_boleta: '',
    observaciones: '',
    recurrencia: 1,
    estado_cita: 'por_confirmar',
    es_bloqueo: false,
    tipo_bloqueo: 'reunion'
  })
  const [bloqueoData, setBloqueoData] = useState<BloqueoFormData>({
    fecha_fin: '',
    hora_fin: '',
    dia_completo: false
  })

  const [pacienteSearch, setPacienteSearch] = useState('')
  const [showPacienteOptions, setShowPacienteOptions] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [currentSucursal])

  useEffect(() => {
    if (isEditing) {
      loadAtencion()
    }
  }, [id])

  useEffect(() => {
    if (isEditing) return

    const params = new URLSearchParams(location.search)
    const profesionalId = params.get('profesional_id')
    const fecha = params.get('fecha')
    const hora = params.get('hora')
    const pacienteId = params.get('paciente_id')
    const esBloqueo = params.get('es_bloqueo') === 'true'
    const fechaFin = params.get('fecha_fin')
    const horaFin = params.get('hora_fin')
    const diaCompleto = params.get('dia_completo') === 'true'

    if (!profesionalId && !fecha && !hora && !pacienteId && !esBloqueo && !fechaFin && !horaFin && !diaCompleto) {
      return
    }

    setFormData(prev => ({
      ...prev,
      profesional_id: canSelectAnyProfessional ? (profesionalId || prev.profesional_id) : prev.profesional_id,
      fecha: fecha || prev.fecha,
      hora: hora || prev.hora,
      paciente_id: pacienteId || prev.paciente_id,
      es_bloqueo: esBloqueo || prev.es_bloqueo
    }))
    setBloqueoData(prev => ({
      ...prev,
      fecha_fin: fechaFin || fecha || prev.fecha_fin,
      hora_fin: horaFin || (hora ? getNextBloqueoTime(hora) : prev.hora_fin),
      dia_completo: diaCompleto || prev.dia_completo
    }))
  }, [canSelectAnyProfessional, isEditing, location.search])

  useEffect(() => {
    if (isEditing || !formData.fecha) return

    setBloqueoData(prev => (
      prev.fecha_fin === formData.fecha || prev.fecha_fin
        ? prev
        : { ...prev, fecha_fin: formData.fecha }
    ))
  }, [formData.fecha, isEditing])

  useEffect(() => {
    if (!formData.es_bloqueo || !formData.profesional_id || !formData.fecha || !currentSucursal?.id) {
      setBloqueoDisponibilidad([])
      return
    }

    const loadBloqueoDisponibilidad = async () => {
      try {
        const diaSemana = parseISO(formData.fecha).getDay()
        const data = await profesionalDisponibilidadService.getByProfesional(
          formData.profesional_id,
          currentSucursal.id,
          diaSemana
        )
        setBloqueoDisponibilidad(data)
      } catch (error) {
        console.error('Error loading bloqueo disponibilidad:', error)
        setBloqueoDisponibilidad([])
      }
    }

    loadBloqueoDisponibilidad()
  }, [currentSucursal?.id, formData.es_bloqueo, formData.fecha, formData.profesional_id])

  useEffect(() => {
    if (!formData.es_bloqueo) return

    if (bloqueoData.dia_completo) {
      const suggestedRange = getSuggestedBloqueoRange(bloqueoDisponibilidad)

      setFormData(prev => (
        prev.hora === suggestedRange.horaInicio
          ? prev
          : { ...prev, hora: suggestedRange.horaInicio }
      ))
      setBloqueoData(prev => {
        const nextFechaFin = prev.fecha_fin || formData.fecha
        if (prev.hora_fin === suggestedRange.horaFin && prev.fecha_fin === nextFechaFin) {
          return prev
        }

        return {
          ...prev,
          hora_fin: suggestedRange.horaFin,
          fecha_fin: nextFechaFin
        }
      })
      return
    }

    if (formData.hora && !bloqueoData.hora_fin) {
      setBloqueoData(prev => ({
        ...prev,
        hora_fin: getNextBloqueoTime(formData.hora)
      }))
    }
  }, [bloqueoData.dia_completo, bloqueoData.hora_fin, bloqueoDisponibilidad, formData.es_bloqueo, formData.fecha, formData.hora])

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
        profesionalesService.getAll(currentSucursal?.id, currentCentro?.id),
        pacientesService.getAll(currentSucursal?.id, currentCentro?.id),
        tiposAtencionService.getAll(currentSucursal?.id, currentCentro?.id)
      ])

      let filteredProfesionales = profesionalesData
      if (!canSelectAnyProfessional && user?.profesional_id) {
        filteredProfesionales = profesionalesData.filter(p => p.id === user.profesional_id)
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
      if (!atencion) return

      const horaBase = atencion.hora.substring(0, 5)

      setFormData({
        profesional_id: atencion.profesional_id,
        paciente_id: atencion.paciente_id || '',
        fecha: atencion.fecha,
        hora: horaBase,
        tipo_atencion: atencion.tipo_atencion,
        valor_cobrado: atencion.valor_cobrado,
        pagado: atencion.pagado,
        numero_boleta: atencion.numero_boleta || '',
        observaciones: atencion.observaciones,
        recurrencia: 1,
        estado_cita: atencion.estado_cita || 'por_confirmar',
        es_bloqueo: !!atencion.es_bloqueo,
        tipo_bloqueo: atencion.tipo_bloqueo || 'reunion'
      })
      setBloqueoData({
        fecha_fin: atencion.fecha,
        hora_fin: getNextBloqueoTime(horaBase),
        dia_completo: false
      })
    } catch (error) {
      toast.error('Error al cargar la atención')
      console.error('Error loading atencion:', error)
    }
  }

  const handleBloqueoDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target

    setBloqueoData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : type === 'number'
        ? parseFloat(value) || 0
        : value
    }))
  }

  const handleTipoRegistroChange = (isBloqueo: boolean) => {
    setFormData(prev => ({
      ...prev,
      es_bloqueo: isBloqueo,
      paciente_id: isBloqueo ? '' : prev.paciente_id,
      tipo_atencion: isBloqueo ? getBloqueoLabel(prev.tipo_bloqueo) : prev.tipo_atencion,
      valor_cobrado: isBloqueo ? 0 : prev.valor_cobrado,
      pagado: isBloqueo ? true : prev.pagado,
      numero_boleta: isBloqueo ? '' : prev.numero_boleta,
      estado_cita: isBloqueo ? 'confirmada' : prev.estado_cita,
      recurrencia: 1
    }))

    if (isBloqueo) {
      setBloqueoData(prev => ({
        ...prev,
        fecha_fin: prev.fecha_fin || formData.fecha,
        hora_fin: prev.hora_fin || getNextBloqueoTime(formData.hora)
      }))
    }
  }

  const handleHoraChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      hora: value
    }))

    if (!bloqueoData.dia_completo) {
      setBloqueoData(prev => ({
        ...prev,
        hora_fin: !prev.hora_fin || prev.hora_fin <= value
          ? getNextBloqueoTime(value)
          : prev.hora_fin
      }))
    }
  }

  const handleTipoAtencionChange = (tipoId: string) => {
    const tipo = tiposAtencion.find(t => t.id === tipoId)
    setFormData(prev => ({
      ...prev,
      tipo_atencion: tipoId,
      valor_cobrado: tipo?.valor_base || 0
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.profesional_id) {
      toast.error('Debe seleccionar un profesional')
      return
    }

    if (!formData.es_bloqueo && !formData.paciente_id) {
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

    if (formData.es_bloqueo) {
      const fechaFinBloqueo = bloqueoData.fecha_fin || formData.fecha
      const horaFinBloqueo = bloqueoData.hora_fin || getNextBloqueoTime(formData.hora)

      if (!fechaFinBloqueo) {
        toast.error('Debe seleccionar la fecha final del bloqueo')
        return
      }

      if (fechaFinBloqueo < formData.fecha) {
        toast.error('La fecha final del bloqueo no puede ser anterior a la fecha inicial')
        return
      }

      if (!horaFinBloqueo) {
        toast.error('Debe seleccionar la hora final del bloqueo')
        return
      }

      if (buildBloqueoSlots(formData.hora, horaFinBloqueo).length === 0) {
        toast.error('El bloqueo debe abarcar al menos un bloque horario válido')
        return
      }
    }

    if (!formData.es_bloqueo && !formData.tipo_atencion) {
      toast.error('Debe seleccionar un tipo de atención')
      return
    }

    if (!formData.es_bloqueo && formData.valor_cobrado <= 0) {
      toast.error('El valor cobrado debe ser mayor a 0')
      return
    }

    if (!currentSucursal) {
      toast.error('Error: No hay sucursal activa seleccionada')
      return
    }

    try {
      setSaving(true)

      const normalizedData = formData.es_bloqueo
        ? {
            ...formData,
            paciente_id: null,
            tipo_atencion: getBloqueoLabel(formData.tipo_bloqueo),
            valor_cobrado: 0,
            pagado: true,
            estado_cita: 'confirmada' as EstadoCita,
            numero_boleta: '',
            recurrencia: 1
          }
        : {
            ...formData,
            pagado: formData.estado_cita === 'cancelada' || formData.estado_cita === 'reagendada'
              ? false
              : formData.pagado,
            numero_boleta: formData.estado_cita === 'cancelada' || formData.estado_cita === 'reagendada'
              ? ''
              : formData.numero_boleta
          }

      const dataToSave = {
        ...normalizedData,
        centro_id: currentCentro?.id || currentSucursal.centro_id,
        sucursal_id: currentSucursal.id
      }

      if (isEditing) {
        const { recurrencia, ...updateData } = dataToSave
        await atencionesService.update(id!, updateData)
        toast.success('Atención actualizada exitosamente')
      } else {
        const { recurrencia, ...baseData } = dataToSave

        if (formData.es_bloqueo) {
          const bloqueosCreados = await atencionesService.createBloqueosOperativos(baseData, {
            fechaFin: bloqueoData.fecha_fin || formData.fecha,
            horaFin: bloqueoData.hora_fin || getNextBloqueoTime(formData.hora)
          })

          toast.success(
            bloqueosCreados.length === 1
              ? 'Bloque creado exitosamente'
              : `Se crearon ${bloqueosCreados.length} bloques de agenda exitosamente`
          )
        } else {
          const sesiones = isReagendaFlow ? 1 : (formData.recurrencia || 1)
          const originalAtencionBase = reagendaId ? await atencionesService.getById(reagendaId) : null
          const originalAtencion = originalAtencionBase
            ? await atencionesService.ensureLegacyPlanMetadata(originalAtencionBase)
            : null
          const totalSesionesOriginal = originalAtencion?.total_sesiones || null
          const planTratamientoId = originalAtencion?.plan_tratamiento_id || (sesiones > 1 ? createPlanId() : null)

          if (sesiones > 1 && !isReagendaFlow) {
            const promesas = []
            let currentDate = parseISO(baseData.fecha)

            for (let i = 0; i < sesiones; i++) {
              const sesionData = {
                ...baseData,
                plan_tratamiento_id: planTratamientoId,
                numero_sesion: i + 1,
                total_sesiones: sesiones,
                fecha: format(currentDate, 'yyyy-MM-dd'),
                observaciones: baseData.observaciones
              }
              promesas.push(atencionesService.create(sesionData))
              currentDate = addWeeks(currentDate, 1)
            }

            await Promise.all(promesas)
            if (reagendaId) {
              await atencionesService.updateEstadoCita(reagendaId, 'reagendada')
            }
            toast.success(`Se crearon ${sesiones} sesiones semanales exitosamente`)
          } else {
            const nuevaAtencion = await atencionesService.create({
              ...baseData,
              plan_tratamiento_id: planTratamientoId,
              numero_sesion: planTratamientoId ? totalSesionesOriginal || 1 : null,
              total_sesiones: planTratamientoId ? totalSesionesOriginal || 1 : null
            })

            if (reagendaId) {
              await atencionesService.updateEstadoCita(reagendaId, 'reagendada')
              if (nuevaAtencion.plan_tratamiento_id) {
                await atencionesService.reindexPlanSessions(
                  nuevaAtencion.plan_tratamiento_id,
                  nuevaAtencion.sucursal_id,
                  nuevaAtencion.centro_id
                )
              }
            }

            toast.success('Atención creada exitosamente')
          }
        }
      }

      navigate('/agenda')
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : ''
      toast.error(
        rawMessage
          ? `Error al ${isEditing ? 'actualizar' : 'crear'} la atención: ${rawMessage}`
          : `Error al ${isEditing ? 'actualizar' : 'crear'} la atención`
      )
      console.error('Error saving atencion:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <PageLoader label="Cargando atención..." />
  }

  const timeOptions = generateBloqueoTimeOptions()
  const timeSlots = timeOptions.slice(0, -1)
  const horaFinOptions = formData.hora
    ? timeOptions.filter(time => time > formData.hora)
    : timeOptions.slice(1)
  const isBloqueoMode = formData.es_bloqueo
  const bloqueoLabel = getBloqueoLabel(formData.tipo_bloqueo)
  const estadoBloqueoLabel = getEstadoCitaLabel(formData.estado_cita)
  const citaInactiva = !isBloqueoMode && (formData.estado_cita === 'cancelada' || formData.estado_cita === 'reagendada')
  const bloqueoHorarioSugerido = getSuggestedBloqueoRange(bloqueoDisponibilidad)
  const bloqueoSlotsPreview = isBloqueoMode
    ? buildBloqueoSlots(formData.hora, bloqueoData.hora_fin || getNextBloqueoTime(formData.hora))
    : []
  const bloqueoDiasPreview = isBloqueoMode && formData.fecha && (bloqueoData.fecha_fin || formData.fecha) >= formData.fecha
    ? eachDayOfInterval({
        start: parseISO(formData.fecha),
        end: parseISO(bloqueoData.fecha_fin || formData.fecha)
      }).length
    : 0
  const bloqueoPreviewTotal = bloqueoSlotsPreview.length * bloqueoDiasPreview
  const disponibilidadBloqueoLabel = bloqueoDisponibilidad.length > 0
    ? bloqueoDisponibilidad
        .map(rango => `${rango.hora_inicio.substring(0, 5)} - ${rango.hora_fin.substring(0, 5)}`)
        .join(' · ')
    : 'Sin horario laboral configurado para ese día'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {isEditing ? 'Editar Registro' : 'Nuevo Registro'}
        </h1>
        <button
          onClick={() => navigate('/agenda')}
          className="text-gray-600 hover:text-gray-800 p-2"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {reagendaId && !isEditing && !isBloqueoMode && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
            Al guardar esta nueva hora, la cita original quedará marcada como <strong>Reagendada</strong>.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="es_bloqueo" className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de registro
            </label>
            <select
              id="es_bloqueo"
              name="es_bloqueo"
              value={formData.es_bloqueo ? 'true' : 'false'}
              onChange={(e) => handleTipoRegistroChange(e.target.value === 'true')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
            >
              <option value="false">Atención clínica</option>
              <option value="true">Bloque no clínico</option>
            </select>
          </div>

          {isBloqueoMode && (
            <div>
              <label htmlFor="tipo_bloqueo" className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de bloqueo
              </label>
              <select
                id="tipo_bloqueo"
                name="tipo_bloqueo"
                value={formData.tipo_bloqueo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
              >
                {BLOQUEO_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

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
                disabled={!canSelectAnyProfessional}
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

          {!isBloqueoMode ? (
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
                      pacientes
                        .filter(p =>
                          p.nombre.toLowerCase().includes(pacienteSearch.toLowerCase()) ||
                          p.rut.toLowerCase().includes(pacienteSearch.toLowerCase())
                        )
                        .map(paciente => (
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
          ) : (
            <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 text-sm text-orange-800">
              Este registro bloqueará el horario sin asociarlo a un paciente.
            </div>
          )}

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
              {isBloqueoMode ? 'Hora inicio *' : 'Hora *'}
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <select
                id="hora"
                name="hora"
                value={formData.hora}
                onChange={(e) => handleHoraChange(e.target.value)}
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue appearance-none disabled:bg-gray-100"
                required
                disabled={isBloqueoMode && bloqueoData.dia_completo && !isEditing}
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

          {isBloqueoMode && !isEditing && (
            <>
              <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                Puedes bloquear un tramo horario, todo el día o varios días seguidos. El sistema creará automáticamente los bloques horarios necesarios.
              </div>

              <div className="flex items-center rounded-lg border border-gray-200 px-4 py-3">
                <input
                  type="checkbox"
                  id="dia_completo"
                  name="dia_completo"
                  checked={bloqueoData.dia_completo}
                  onChange={handleBloqueoDataChange}
                  className="h-4 w-4 text-medical-blue focus:ring-medical-blue border-gray-300 rounded"
                />
                <label htmlFor="dia_completo" className="ml-2 block text-sm text-gray-900">
                  Bloquear jornada completa del día
                </label>
              </div>

              <div>
                <label htmlFor="fecha_fin" className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha final
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    id="fecha_fin"
                    name="fecha_fin"
                    value={bloqueoData.fecha_fin}
                    min={formData.fecha || undefined}
                    onChange={handleBloqueoDataChange}
                    className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="hora_fin" className="block text-sm font-medium text-gray-700 mb-2">
                  Hora final *
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <select
                    id="hora_fin"
                    name="hora_fin"
                    value={bloqueoData.hora_fin}
                    onChange={handleBloqueoDataChange}
                    className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue appearance-none disabled:bg-gray-100"
                    required={isBloqueoMode}
                    disabled={bloqueoData.dia_completo}
                  >
                    <option value="">Seleccione hora final</option>
                    {horaFinOptions.map(time => (
                      <option key={time} value={time}>
                        {time} hrs
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="font-medium text-slate-900">Horario laboral del día: {disponibilidadBloqueoLabel}</div>
                <div className="mt-1">
                  {bloqueoData.dia_completo
                    ? `Jornada sugerida: ${bloqueoHorarioSugerido.horaInicio} - ${bloqueoHorarioSugerido.horaFin}`
                    : 'Puedes ajustar manualmente la hora final para bloquear sólo el tramo que necesites.'}
                </div>
                <div className="mt-1">
                  Vista previa: {bloqueoPreviewTotal > 0
                    ? `${bloqueoPreviewTotal} bloque${bloqueoPreviewTotal === 1 ? '' : 's'} de 60 minutos`
                    : 'define un rango válido para ver cuántos bloques se crearán'}
                </div>
              </div>
            </>
          )}

          {isBloqueoMode && isEditing && (
            <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Estás editando un bloque individual de 60 minutos. Si necesitas cambiar un rango completo, crea un nuevo bloqueo operativo.
            </div>
          )}

          {!isBloqueoMode ? (
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
                required={!isBloqueoMode}
              >
                <option value="">Seleccione un tipo</option>
                {tiposAtencion.map(tipo => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre} {canViewFinancialFields ? `- $${tipo.valor_base}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Etiqueta del bloqueo
              </label>
              <input
                type="text"
                value={bloqueoLabel}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
              />
            </div>
          )}

          {canViewFinancialFields && !isBloqueoMode && (
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
                  required={!isBloqueoMode}
                />
              </div>
            </div>
          )}

          {isBloqueoMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado del bloqueo
              </label>
              <input
                type="text"
                value={estadoBloqueoLabel}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
              />
            </div>
          )}

          {!isBloqueoMode && (
            <div>
              <label htmlFor="estado_cita" className="block text-sm font-medium text-gray-700 mb-2">
                Estado de la cita
              </label>
              <select
                id="estado_cita"
                name="estado_cita"
                value={formData.estado_cita}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
              >
                {ESTADO_CITA_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {citaInactiva && (
            <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Esta cita no se considerará activa para cobros ni seguimientos mientras esté marcada como <strong>{getEstadoCitaLabel(formData.estado_cita)}</strong>.
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
            placeholder={isBloqueoMode ? 'Ej: reunión de equipo, licencia médica, almuerzo...' : 'Notas sobre la atención...'}
          />
        </div>

        {!isBloqueoMode && (
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
        )}

        {canViewFinancialFields && !isBloqueoMode && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col justify-center">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="pagado"
                  name="pagado"
                  checked={formData.pagado}
                  onChange={handleChange}
                  disabled={citaInactiva}
                  className="h-4 w-4 text-medical-blue focus:ring-medical-blue border-gray-300 rounded"
                />
                <label htmlFor="pagado" className="ml-2 block text-sm text-gray-900">
                  Atención pagada
                </label>
              </div>
            </div>

            {!isEditing && !isReagendaFlow && (
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

            {!isEditing && isReagendaFlow && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
                Si esta cita pertenece a un plan de varias sesiones, la nueva hora quedará como la última sesión pendiente del plan.
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
