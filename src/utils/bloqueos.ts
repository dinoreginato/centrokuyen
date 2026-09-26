import { TipoBloqueo } from '@/types/database'

export const BLOQUEO_OPTIONS: Array<{ value: TipoBloqueo; label: string }> = [
  { value: 'almuerzo', label: 'Almuerzo' },
  { value: 'reunion', label: 'Reunión' },
  { value: 'vacaciones', label: 'Vacaciones' },
  { value: 'licencia', label: 'Licencia' },
  { value: 'capacitacion', label: 'Capacitación' },
  { value: 'otro', label: 'Otro' }
]

export const getBloqueoLabel = (tipo?: TipoBloqueo | null) => {
  return BLOQUEO_OPTIONS.find(option => option.value === tipo)?.label || 'Bloque no clínico'
}

export const getBloqueoBadgeClass = (tipo?: TipoBloqueo | null) => {
  switch (tipo) {
    case 'almuerzo':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'reunion':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200'
    case 'vacaciones':
      return 'bg-sky-100 text-sky-800 border-sky-200'
    case 'licencia':
      return 'bg-rose-100 text-rose-800 border-rose-200'
    case 'capacitacion':
      return 'bg-violet-100 text-violet-800 border-violet-200'
    case 'otro':
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200'
  }
}

export const BLOQUEO_START_HOUR = 8
export const BLOQUEO_LAST_SLOT_HOUR = 21
export const BLOQUEO_END_HOUR = BLOQUEO_LAST_SLOT_HOUR + 1

export const generateBloqueoTimeOptions = () => {
  const options: string[] = []

  for (let hour = BLOQUEO_START_HOUR; hour <= BLOQUEO_END_HOUR; hour++) {
    options.push(`${hour.toString().padStart(2, '0')}:00`)
  }

  return options
}

export const getNextBloqueoTime = (time?: string | null) => {
  const normalized = (time || '').substring(0, 5)
  const options = generateBloqueoTimeOptions()
  const currentIndex = options.indexOf(normalized)

  if (currentIndex === -1) {
    return options[1] || '09:00'
  }

  return options[Math.min(currentIndex + 1, options.length - 1)]
}

const timeToMinutes = (time?: string | null) => {
  const normalized = (time || '00:00').substring(0, 5)
  const [hh, mm] = normalized.split(':')
  return (parseInt(hh || '0', 10) * 60) + parseInt(mm || '0', 10)
}

export const buildBloqueoSlots = (horaInicio: string, horaFin: string) => {
  const startMinutes = timeToMinutes(horaInicio)
  const endMinutes = timeToMinutes(horaFin)

  if (!horaInicio || !horaFin || endMinutes <= startMinutes) {
    return []
  }

  const slots: string[] = []

  for (let currentMinutes = startMinutes; currentMinutes < endMinutes; currentMinutes += 60) {
    const hh = Math.floor(currentMinutes / 60)
    const mm = currentMinutes % 60
    slots.push(`${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`)
  }

  return slots
}

export const getSuggestedBloqueoRange = (
  rangos: Array<{ hora_inicio: string; hora_fin: string }>
) => {
  if (rangos.length === 0) {
    return {
      horaInicio: `${BLOQUEO_START_HOUR.toString().padStart(2, '0')}:00`,
      horaFin: `${BLOQUEO_END_HOUR.toString().padStart(2, '0')}:00`
    }
  }

  const ordenados = [...rangos].sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio))

  return {
    horaInicio: ordenados[0].hora_inicio.substring(0, 5),
    horaFin: ordenados[ordenados.length - 1].hora_fin.substring(0, 5)
  }
}
