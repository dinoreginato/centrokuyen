import { EstadoCita } from '@/types/database'

export const ESTADO_CITA_OPTIONS: Array<{ value: EstadoCita; label: string }> = [
  { value: 'por_confirmar', label: 'Por confirmar' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'reagendada', label: 'Reagendada' }
]

export const getEstadoCitaLabel = (estado?: EstadoCita | null) => {
  switch (estado) {
    case 'confirmada':
      return 'Confirmada'
    case 'cancelada':
      return 'Cancelada'
    case 'reagendada':
      return 'Reagendada'
    case 'por_confirmar':
    default:
      return 'Por confirmar'
  }
}

export const getEstadoCitaBadgeClass = (estado?: EstadoCita | null) => {
  switch (estado) {
    case 'confirmada':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'cancelada':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'reagendada':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'por_confirmar':
    default:
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  }
}

export const getEstadoCitaCardClass = (estado?: EstadoCita | null, pagado?: boolean, estadoAsistencia?: string) => {
  if (estado === 'cancelada') return 'bg-red-50 border-red-200'
  if (estadoAsistencia === 'no_asistio') return 'bg-red-50 border-red-100'
  if (estado === 'reagendada') return 'bg-purple-50 border-purple-200'
  if (estado === 'confirmada') return 'bg-blue-50 border-blue-200'
  if (pagado) return 'bg-green-50 border-green-100'
  return 'bg-white border-gray-200 hover:border-blue-300'
}
