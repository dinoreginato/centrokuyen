import { Atencion } from '@/types/database'

export const getSessionPlanLabel = (atencion: Atencion) => {
  if (atencion.es_bloqueo) return null

  if (atencion.plan_tratamiento_id) {
    if (atencion.numero_sesion && atencion.total_sesiones) {
      return `Sesión ${atencion.numero_sesion}/${atencion.total_sesiones}`
    }

    return null
  }

  if (atencion.numero_sesion && atencion.total_sesiones) {
    return `Sesión ${atencion.numero_sesion}/${atencion.total_sesiones}`
  }

  const match = atencion.observaciones?.match(/sesi[oó]n\s+(\d+)\s+de\s+(\d+)/i)
  if (!match) return null

  return `Sesión ${match[1]}/${match[2]}`
}
