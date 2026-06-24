import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Clock, Save, User } from 'lucide-react'
import { toast } from 'sonner'
import { eachDayOfInterval, endOfWeek, format, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'
import { useSucursal } from '@/contexts/SucursalContext'
import { Atencion, Profesional, ProfesionalDisponibilidad } from '@/types/database'
import { profesionalesService, profesionalDisponibilidadService, atencionesService } from '@/utils/supabase'

type DayConfig = { enabled: boolean; start: string; end: string }
type SlotRow = { hora: string; atencion: Atencion | null }

const SESSION_MINUTES = 60

const DIAS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' }
]

const createDefaultConfig = (): Record<number, DayConfig> => ({
  0: { enabled: false, start: '09:00', end: '18:00' },
  1: { enabled: false, start: '09:00', end: '18:00' },
  2: { enabled: false, start: '09:00', end: '18:00' },
  3: { enabled: false, start: '09:00', end: '18:00' },
  4: { enabled: false, start: '09:00', end: '18:00' },
  5: { enabled: false, start: '09:00', end: '18:00' },
  6: { enabled: false, start: '09:00', end: '18:00' }
})

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.substring(0, 5).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const toHHMM = (minutes: number) => {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

const normalizeStartToHour = (minutes: number) => Math.ceil(minutes / 60) * 60
const normalizeEndToHour = (minutes: number) => Math.floor(minutes / 60) * 60

const Disponibilidad = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentSucursal } = useSucursal()

  const [loading, setLoading] = useState(true)
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [selectedProfesionalId, setSelectedProfesionalId] = useState('')
  const [mode, setMode] = useState<'agendar' | 'config'>('agendar')

  const [schedule, setSchedule] = useState<Record<number, DayConfig>>(createDefaultConfig())
  const [savingSchedule, setSavingSchedule] = useState(false)

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [agendaView, setAgendaView] = useState<'day' | 'week'>('week')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [ocupadosByFecha, setOcupadosByFecha] = useState<Record<string, Atencion[]>>({})
  const [selectedSlot, setSelectedSlot] = useState<{ fecha: string; hora: string } | null>(null)

  const isAdmin = user?.rol === 'admin'

  useEffect(() => {
    loadProfesionales()
  }, [currentSucursal])

  useEffect(() => {
    if (user?.rol === 'profesional' && user.profesional_id) {
      setSelectedProfesionalId(user.profesional_id)
    }
  }, [user?.rol, user?.profesional_id])

  useEffect(() => {
    if (!selectedProfesionalId || !currentSucursal?.id) {
      setSchedule(createDefaultConfig())
      setOcupadosByFecha({})
      setSelectedSlot(null)
      return
    }
    loadSchedule()
  }, [selectedProfesionalId, currentSucursal?.id])

  useEffect(() => {
    if (!selectedProfesionalId || !currentSucursal?.id || !selectedDate) {
      setOcupadosByFecha({})
      setSelectedSlot(null)
      return
    }
    loadOcupados()
  }, [selectedProfesionalId, selectedDate, currentSucursal?.id, agendaView])

  const loadProfesionales = async () => {
    if (!currentSucursal?.id) return
    try {
      setLoading(true)
      const data = await profesionalesService.getAll(currentSucursal.id)
      const filtered = user?.rol === 'profesional' && user.profesional_id
        ? data.filter(p => p.id === user.profesional_id)
        : data

      setProfesionales(filtered)
      if (!selectedProfesionalId && filtered.length > 0) {
        setSelectedProfesionalId(filtered[0].id)
      }
    } catch (e) {
      toast.error('Error al cargar profesionales')
      console.error('Error loading profesionales:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadSchedule = async () => {
    if (!currentSucursal?.id) return
    try {
      const items = await profesionalDisponibilidadService.getByProfesionalId(selectedProfesionalId, currentSucursal.id)
      const base = createDefaultConfig()
      for (const item of items) {
        base[item.dia_semana] = {
          enabled: true,
          start: item.hora_inicio.substring(0, 5),
          end: item.hora_fin.substring(0, 5)
        }
      }
      setSchedule(base)
    } catch (e: any) {
      const msg = String(e?.message || '')
      if (msg.toLowerCase().includes('profesional_disponibilidad') && msg.toLowerCase().includes('does not exist')) {
        toast.error('Falta crear la tabla de disponibilidad en Supabase (SQL)')
      } else {
        toast.error('Error al cargar disponibilidad')
      }
      console.error('Error loading disponibilidad:', e)
      setSchedule(createDefaultConfig())
    }
  }

  const loadOcupados = async () => {
    if (!currentSucursal?.id) return
    try {
      setLoadingSlots(true)
      const baseDate = new Date(`${selectedDate}T00:00:00`)
      const start = agendaView === 'week' ? startOfWeek(baseDate, { weekStartsOn: 1 }) : baseDate
      const end = agendaView === 'week' ? endOfWeek(baseDate, { weekStartsOn: 1 }) : baseDate
      const startStr = format(start, 'yyyy-MM-dd')
      const endStr = format(end, 'yyyy-MM-dd')

      const atenciones = await atencionesService.getByProfesionalAndDateRange(
        selectedProfesionalId,
        startStr,
        endStr,
        currentSucursal.id
      )

      const map: Record<string, Atencion[]> = {}
      for (const atencion of atenciones) {
        if (!map[atencion.fecha]) map[atencion.fecha] = []
        map[atencion.fecha].push(atencion)
      }
      setOcupadosByFecha(map)
    } catch (e) {
      toast.error('Error al cargar agenda del día')
      console.error('Error loading ocupados:', e)
      setOcupadosByFecha({})
    } finally {
      setLoadingSlots(false)
    }
  }

  const getSlotRowsForDate = (fecha: string): SlotRow[] => {
    const day = new Date(`${fecha}T00:00:00`)
    const weekday = day.getDay()
    const cfg = schedule[weekday]

    if (!cfg?.enabled) return []

    const startMin = normalizeStartToHour(toMinutes(cfg.start))
    const endMin = normalizeEndToHour(toMinutes(cfg.end))
    if (endMin - startMin < SESSION_MINUTES) return []

    const ocupados = ocupadosByFecha[fecha] || []
    const rows: SlotRow[] = []

    for (let m = startMin; m + SESSION_MINUTES <= endMin; m += SESSION_MINUTES) {
      const slotStart = m
      const slotEnd = m + SESSION_MINUTES

      const atencion = ocupados.find(item => {
        const atencionStart = toMinutes(item.hora)
        const atencionEnd = atencionStart + SESSION_MINUTES
        return slotStart < atencionEnd && atencionStart < slotEnd
      }) || null

      rows.push({
        hora: toHHMM(m),
        atencion
      })
    }

    return rows
  }

  const weekDays = useMemo(() => {
    const baseDate = new Date(`${selectedDate}T00:00:00`)
    const start = startOfWeek(baseDate, { weekStartsOn: 1 })
    const end = endOfWeek(baseDate, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [selectedDate])

  const saveSchedule = async () => {
    if (!currentSucursal?.id) {
      toast.error('No hay sucursal activa seleccionada')
      return
    }
    if (!selectedProfesionalId) {
      toast.error('Debes seleccionar un profesional')
      return
    }

    try {
      setSavingSchedule(true)
      const items: Omit<ProfesionalDisponibilidad, 'id' | 'created_at' | 'updated_at'>[] = []

      for (const dia of DIAS) {
        const cfg = schedule[dia.value]
        if (!cfg.enabled) continue

        const startMin = toMinutes(cfg.start)
        const endMin = toMinutes(cfg.end)
        if (endMin <= startMin) {
          throw new Error(`Horario inválido en ${dia.label}`)
        }

        items.push({
          profesional_id: selectedProfesionalId,
          sucursal_id: currentSucursal.id,
          dia_semana: dia.value,
          hora_inicio: cfg.start,
          hora_fin: cfg.end
        })
      }

      await profesionalDisponibilidadService.replaceSchedule(selectedProfesionalId, currentSucursal.id, items)
      toast.success('Disponibilidad guardada')
      await loadSchedule()
    } catch (e: any) {
      const msg = String(e?.message || '')
      const lower = msg.toLowerCase()
      if (lower.includes('profesional_disponibilidad') && lower.includes('does not exist')) {
        toast.error('Falta crear la tabla de disponibilidad en Supabase (SQL)')
      } else if (lower.includes('row-level security') || lower.includes('permission denied')) {
        toast.error('Permisos insuficientes en Supabase para guardar disponibilidad')
      } else if (msg) {
        toast.error(msg)
      } else {
        toast.error('Error al guardar disponibilidad')
      }
      console.error('Error saving disponibilidad:', e)
    } finally {
      setSavingSchedule(false)
    }
  }

  const goAgendar = () => {
    if (!selectedProfesionalId || !selectedSlot) return
    navigate(
      `/agenda/nueva?profesional_id=${encodeURIComponent(selectedProfesionalId)}&fecha=${encodeURIComponent(selectedSlot.fecha)}&hora=${encodeURIComponent(selectedSlot.hora)}`
    )
  }

  const renderSlotRow = (fecha: string, row: SlotRow, compact = false) => {
    const isSelected = selectedSlot?.fecha === fecha && selectedSlot?.hora === row.hora

    if (row.atencion) {
      return (
        <div
          key={`${fecha}-${row.hora}`}
          className={`rounded-md border border-red-200 bg-red-50 ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
        >
          <div className="font-medium text-red-700">{row.atencion.hora.substring(0, 5)}</div>
          <div className="mt-1 flex items-start gap-1 text-red-900">
            <User className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">{row.atencion.paciente?.nombre || 'Paciente agendado'}</div>
              <div className="text-red-700">{row.atencion.tipos_atencion?.nombre || 'Atención'}</div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <button
        key={`${fecha}-${row.hora}`}
        onClick={() => setSelectedSlot({ fecha, hora: row.hora })}
        className={`w-full rounded-md border transition-colors ${
          isSelected
            ? 'bg-medical-blue text-white border-medical-blue'
            : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
        } ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
      >
        {row.hora}
      </button>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Disponibilidad de Profesionales</h1>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profesional</label>
            <select
              value={selectedProfesionalId}
              onChange={(e) => {
                setSelectedProfesionalId(e.target.value)
                setSelectedSlot(null)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
              disabled={user?.rol === 'profesional'}
            >
              <option value="">Seleccione un profesional</option>
              {profesionales.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} - {p.especialidad}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Modo</label>
            <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg w-fit">
              <button
                onClick={() => setMode('agendar')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'agendar' ? 'bg-white text-medical-blue shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Ver disponibilidad
              </button>
              <button
                onClick={() => setMode('config')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'config' ? 'bg-white text-medical-blue shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                disabled={!isAdmin}
              >
                Configurar horarios
              </button>
            </div>
            {!isAdmin && (
              <div className="text-xs text-gray-500 mt-2">
                La configuración de horarios está disponible solo para administradores.
              </div>
            )}
          </div>
        </div>
      </div>

      {mode === 'config' ? (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          {DIAS.map(dia => {
            const cfg = schedule[dia.value]
            return (
              <div key={dia.value} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                <div className="md:col-span-2 flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={cfg.enabled}
                    onChange={(e) => setSchedule(prev => ({
                      ...prev,
                      [dia.value]: { ...prev[dia.value], enabled: e.target.checked }
                    }))}
                    className="h-4 w-4 text-medical-blue focus:ring-medical-blue border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-800">{dia.label}</span>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Inicio</label>
                  <input
                    type="time"
                    value={cfg.start}
                    onChange={(e) => setSchedule(prev => ({
                      ...prev,
                      [dia.value]: { ...prev[dia.value], start: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                    disabled={!cfg.enabled}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Fin</label>
                  <input
                    type="time"
                    value={cfg.end}
                    onChange={(e) => setSchedule(prev => ({
                      ...prev,
                      [dia.value]: { ...prev[dia.value], end: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                    disabled={!cfg.enabled}
                  />
                </div>
              </div>
            )
          })}

          <div className="text-xs text-gray-500 space-y-1">
            <div>La disponibilidad se guarda por profesional y por sucursal (la sucursal actual es {currentSucursal?.nombre || ''}).</div>
            <div>En la vista de agenda se muestran solo horas completas. Si configuras 17:15 a 20:45, se verá desde 18:00 a 20:00.</div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={saveSchedule}
              disabled={savingSchedule || !selectedProfesionalId}
              className="bg-medical-blue hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              <span>{savingSchedule ? 'Guardando...' : 'Guardar'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value)
                    setSelectedSlot(null)
                  }}
                  className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                  disabled={!selectedProfesionalId}
                />
              </div>
            </div>
            <div className="flex items-end justify-end">
              <button
                onClick={goAgendar}
                disabled={!selectedProfesionalId || !selectedSlot}
                className="bg-medical-green hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
              >
                <Clock className="h-5 w-5" />
                <span>Agendar</span>
              </button>
            </div>
          </div>

          {!selectedProfesionalId ? (
            <div className="text-center py-10 text-gray-600">Selecciona un profesional</div>
          ) : loadingSlots ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-medical-blue"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg w-fit">
                <button
                  onClick={() => {
                    setAgendaView('week')
                    setSelectedSlot(null)
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${agendaView === 'week' ? 'bg-white text-medical-blue shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Semana
                </button>
                <button
                  onClick={() => {
                    setAgendaView('day')
                    setSelectedSlot(null)
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${agendaView === 'day' ? 'bg-white text-medical-blue shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Día
                </button>
              </div>

              {agendaView === 'day' ? (
                (() => {
                  const rows = getSlotRowsForDate(selectedDate)
                  if (rows.length === 0) {
                    return (
                      <div className="text-center py-10 text-gray-600">
                        No hay horarios configurados para esta fecha.
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-2">
                      {rows.map(row => renderSlotRow(selectedDate, row))}
                    </div>
                  )
                })()
              ) : (
                <div className="overflow-x-auto pb-2">
                  <div className="grid gap-3 grid-cols-1 md:grid-cols-7 min-w-[1000px] md:min-w-0">
                    {weekDays.map((day) => {
                      const fecha = format(day, 'yyyy-MM-dd')
                      const rows = getSlotRowsForDate(fecha)
                      return (
                        <div key={fecha} className="bg-white rounded-lg border border-gray-200 shadow-sm">
                          <div className="p-3 text-center border-b border-gray-100 bg-gray-50">
                            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                              {format(day, 'EEEE', { locale: es })}
                            </div>
                            <div className="text-sm font-bold text-gray-900">
                              {format(day, 'dd/MM')}
                            </div>
                          </div>
                          <div className="p-2 space-y-2">
                            {rows.length === 0 ? (
                              <div className="text-center py-6 text-xs text-gray-400 italic">Sin disponibilidad</div>
                            ) : (
                              rows.map(row => renderSlotRow(fecha, row, true))
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Disponibilidad
