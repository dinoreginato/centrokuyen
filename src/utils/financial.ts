import { Atencion } from '@/types/database'

export const MIN_BILLABLE_AMOUNT = 1

export const isActiveClinicalAtencion = (atencion: Atencion) => {
  const estadoCita = atencion.estado_cita || 'por_confirmar'
  return !atencion.es_bloqueo && estadoCita !== 'cancelada' && estadoCita !== 'reagendada'
}

export const isBillableAtencion = (atencion: Atencion) => {
  return isActiveClinicalAtencion(atencion) && (atencion.valor_cobrado || 0) > MIN_BILLABLE_AMOUNT
}

export const getFinancialAmount = (atencion: Atencion) => {
  return isBillableAtencion(atencion) ? atencion.valor_cobrado || 0 : 0
}

export const sumFinancialAmounts = (atenciones: Atencion[]) => {
  return atenciones.reduce((sum, atencion) => sum + getFinancialAmount(atencion), 0)
}
