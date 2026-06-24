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
