import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Clock, Save } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import { useSucursal } from '@/contexts/SucursalContext'
import { Profesional, ProfesionalDisponibilidad } from '@/types/database'
import { profesionalesService, profesionalDisponibilidadService, atencionesService } from '@/utils/supabase'

type DayConfig = { enabled: boolean; start: string; end: string }

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
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const generateTimeSlots = () => {
  const slots: string[] = []
  for (let i = 8; i <= 22; i++) {
    for (let j = 0; j < 60; j += 15) {
      if (i === 22 && j > 0) break
      const hour = i.toString().padStart(2, '0')
      const minute = j.toString().padStart(2, '0')
      slots.push(`${hour}:${minute}`)
    }
  }
  return slots
}

const ALL_SLOTS = generateTimeSlots()

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
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [ocupados, setOcupados] = useState<Set<string>>(new Set())
  const [selectedHora, setSelectedHora] = useState<string | null>(null)

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
      setOcupados(new Set())
      setSelectedHora(null)
      return
    }
    loadSchedule()
  }, [selectedProfesionalId, currentSucursal?.id])

  useEffect(() => {
    if (!selectedProfesionalId || !currentSucursal?.id || !selectedDate) {
      setOcupados(new Set())
      setSelectedHora(null)
      return
    }
    loadOcupados()
  }, [selectedProfesionalId, selectedDate, currentSucursal?.id])

  const loadProfesionales = async () => {
    if (!currentSucursal?.id) return
    try {
      setLoading(true)
      const data = await profesionalesService.getAll(currentSucursal.id)
      const filtered = user?.rol === 'profesional' && user.profesional_id
        ? data.filter(p => p.id === user.profesional_id)
        : data
      setProfesionales(filtered)
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
    } catch (e) {
      toast.error('Error al cargar disponibilidad')
      console.error('Error loading disponibilidad:', e)
      setSchedule(createDefaultConfig())
    }
  }

  const loadOcupados = async () => {
    if (!currentSucursal?.id) return
    try {
      setLoadingSlots(true)
      const atenciones = await atencionesService.getByProfesionalAndFecha(selectedProfesionalId, selectedDate, currentSucursal.id)
      const set = new Set<string>(atenciones.map(a => a.hora.substring(0, 5)))
      setOcupados(set)
    } catch (e) {
      toast.error('Error al cargar agenda del día')
      console.error('Error loading ocupados:', e)
      setOcupados(new Set())
    } finally {
      setLoadingSlots(false)
    }
  }

  const weekday = useMemo(() => {
    if (!selectedDate) return 0
    return new Date(`${selectedDate}T00:00:00`).getDay()
  }, [selectedDate])

  const slotsDisponibles = useMemo(() => {
    const cfg = schedule[weekday]
    if (!cfg?.enabled) return []
    const startMin = toMinutes(cfg.start)
    const endMin = toMinutes(cfg.end)
    if (endMin <= startMin) return []

    return ALL_SLOTS.filter(h => {
      const m = toMinutes(h)
      if (m < startMin) return false
      if (m >= endMin) return false
      return !ocupados.has(h)
    })
  }, [schedule, weekday, ocupados])

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
          toast.error(`Horario inválido en ${dia.label}`)
          return
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
    } catch (e) {
      toast.error('Error al guardar disponibilidad')
      console.error('Error saving disponibilidad:', e)
    } finally {
      setSavingSchedule(false)
    }
  }

  const goAgendar = () => {
    if (!selectedProfesionalId || !selectedDate || !selectedHora) return
    navigate(`/agenda/nueva?profesional_id=${encodeURIComponent(selectedProfesionalId)}&fecha=${encodeURIComponent(selectedDate)}&hora=${encodeURIComponent(selectedHora)}`)
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
                setSelectedHora(null)
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
                    setSelectedHora(null)
                  }}
                  className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                  disabled={!selectedProfesionalId}
                />
              </div>
            </div>
            <div className="flex items-end justify-end">
              <button
                onClick={goAgendar}
                disabled={!selectedProfesionalId || !selectedDate || !selectedHora}
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
          ) : slotsDisponibles.length === 0 ? (
            <div className="text-center py-10 text-gray-600">
              No hay horarios disponibles para esta fecha (según el horario configurado y las citas ya tomadas).
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {slotsDisponibles.map(h => (
                <button
                  key={h}
                  onClick={() => setSelectedHora(h)}
                  className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                    selectedHora === h
                      ? 'bg-medical-blue text-white border-medical-blue'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Disponibilidad

