import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Clock, Stethoscope, User } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'
import { useSucursal } from '@/contexts/SucursalContext'
import { Atencion, Profesional } from '@/types/database'
import { atencionesService, profesionalesService } from '@/utils/supabase'

const START_HOUR = 8
const END_HOUR = 21
const SESSION_MINUTES = 60

const timeToMinutes = (time: string) => {
  const raw = time?.substring(0, 5) || '00:00'
  const [hh, mm] = raw.split(':')
  return (parseInt(hh || '0', 10) * 60) + parseInt(mm || '0', 10)
}

const Disponibilidad = () => {
  const { user } = useAuth()
  const { currentSucursal } = useSucursal()

  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [loadingProfesionales, setLoadingProfesionales] = useState(true)

  const [selectedProfesionalId, setSelectedProfesionalId] = useState('')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const [atenciones, setAtenciones] = useState<Atencion[]>([])
  const [loadingAtenciones, setLoadingAtenciones] = useState(false)

  useEffect(() => {
    loadProfesionales()
    setAtenciones([])
  }, [currentSucursal])

  useEffect(() => {
    if (!selectedProfesionalId || !selectedDate) return
    if (!currentSucursal) return
    loadAtenciones()
  }, [selectedProfesionalId, selectedDate, currentSucursal])

  const loadProfesionales = async () => {
    try {
      setLoadingProfesionales(true)
      const data = await profesionalesService.getAll(currentSucursal?.id)
      const filtered = (user?.rol === 'profesional' && user.profesional_id)
        ? data.filter(p => p.id === user.profesional_id)
        : data

      setProfesionales(filtered)

      if (user?.rol === 'profesional' && user.profesional_id) {
        setSelectedProfesionalId(user.profesional_id)
      } else if (!selectedProfesionalId && filtered.length > 0) {
        setSelectedProfesionalId(filtered[0].id)
      }
    } catch (error) {
      toast.error('Error al cargar profesionales')
      console.error('Error loading profesionales:', error)
    } finally {
      setLoadingProfesionales(false)
    }
  }

  const loadAtenciones = async () => {
    try {
      setLoadingAtenciones(true)
      const data = await atencionesService.getByProfesionalAndDateRange(
        selectedProfesionalId,
        selectedDate,
        selectedDate,
        currentSucursal?.id
      )
      setAtenciones(data)
    } catch (error) {
      toast.error('Error al cargar atenciones')
      console.error('Error loading atenciones for disponibilidad:', error)
    } finally {
      setLoadingAtenciones(false)
    }
  }

  const slots = useMemo(() => {
    const result: string[] = []
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      result.push(`${h.toString().padStart(2, '0')}:00`)
    }
    return result
  }, [])

  const atencionesDelDia = useMemo(() => {
    return atenciones.filter(a => a.fecha === selectedDate)
  }, [atenciones, selectedDate])

  const slotRows = useMemo(() => {
    return slots.map((slot) => {
      const slotStart = timeToMinutes(slot)
      const slotEnd = slotStart + SESSION_MINUTES

      const ocupada = atencionesDelDia.find(a => {
        const start = timeToMinutes(a.hora)
        const end = start + SESSION_MINUTES
        return start < slotEnd && end > slotStart
      })

      return { slot, ocupada }
    })
  }, [slots, atencionesDelDia])

  if (loadingProfesionales) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
      </div>
    )
  }

  const selectedProfesional = profesionales.find(p => p.id === selectedProfesionalId) || null
  const dateLabel = selectedDate ? format(parseISO(selectedDate), 'EEEE dd/MM/yyyy', { locale: es }) : ''

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Disponibilidad</h1>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profesional</label>
            <div className="relative">
              <Stethoscope className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <select
                value={selectedProfesionalId}
                onChange={(e) => setSelectedProfesionalId(e.target.value)}
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={user?.rol === 'profesional'}
              >
                {profesionales.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} - {p.especialidad}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          {selectedProfesional ? (
            <span>
              <span className="font-medium">{selectedProfesional.nombre}</span>
              {' · '}
              <span className="capitalize">{dateLabel}</span>
            </span>
          ) : (
            <span>Seleccione un profesional</span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        {loadingAtenciones ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paciente</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {slotRows.map(({ slot, ocupada }) => (
                  <tr key={slot} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{slot}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {ocupada ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Ocupado
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Disponible
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {ocupada ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{ocupada.paciente?.nombre || '-'}</div>
                            <div className="text-xs text-gray-500">
                              {ocupada.tipos_atencion?.nombre || '-'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {ocupada ? (
                        <Link
                          to={`/agenda/${ocupada.id}`}
                          className="text-medical-blue hover:text-blue-700 font-medium"
                        >
                          Ver / editar
                        </Link>
                      ) : (
                        <Link
                          to={`/agenda/nueva?profesional_id=${encodeURIComponent(selectedProfesionalId)}&fecha=${encodeURIComponent(selectedDate)}&hora=${encodeURIComponent(slot)}`}
                          className="inline-flex items-center px-3 py-1.5 border border-medical-blue text-medical-blue rounded-md hover:bg-medical-blue hover:text-white transition-colors"
                        >
                          Agendar
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Disponibilidad

