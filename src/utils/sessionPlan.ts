import { Atencion } from '@/types/database'

type SessionPlanLabelMap = Record<string, string | null>

type LegacySessionPlan = {
  numeroSesion: number
  totalSesiones: number
}

type SessionPlanRepairPayload = {
  id: string
  plan_tratamiento_id: string
  numero_sesion: number | null
  total_sesiones: number
}

const parseLegacySessionPlan = (observaciones?: string | null): LegacySessionPlan | null => {
  const match = observaciones?.match(/sesi[oó]n\s+(\d+)\s+de\s+(\d+)/i)
  if (!match) return null

  const numeroSesion = Number(match[1])
  const totalSesiones = Number(match[2])

  if (!Number.isFinite(numeroSesion) || !Number.isFinite(totalSesiones) || totalSesiones <= 1) {
    return null
  }

  return { numeroSesion, totalSesiones }
}

const getChronologicalAtenciones = (atenciones: Atencion[]) => {
  return [...atenciones].sort((a, b) => {
    const dateCompare = a.fecha.localeCompare(b.fecha)
    return dateCompare !== 0 ? dateCompare : a.hora.localeCompare(b.hora)
  })
}

const isInactivePlanSession = (atencion: Atencion) => {
  const estadoCita = atencion.estado_cita || 'por_confirmar'
  return atencion.es_bloqueo || estadoCita === 'cancelada' || estadoCita === 'reagendada'
}

const getAtencionPlanTotal = (atencion: Atencion) => {
  if ((atencion.total_sesiones || 0) > 1) return atencion.total_sesiones || null
  return parseLegacySessionPlan(atencion.observaciones)?.totalSesiones || null
}

const getImplicitPlanSignature = (atencion: Atencion) => {
  const totalSesiones = getAtencionPlanTotal(atencion)
  if (!totalSesiones || !atencion.paciente_id) return null

  return [
    atencion.paciente_id,
    atencion.profesional_id,
    atencion.tipo_atencion || 'sin-tipo',
    totalSesiones
  ].join('::')
}

const getPlanGroups = (atenciones: Atencion[]) => {
  const chronological = getChronologicalAtenciones(atenciones)
  const explicitGroups = new Map<string, Atencion[]>()
  const implicitBuckets = new Map<string, Atencion[]>()

  chronological.forEach((atencion) => {
    if (atencion.plan_tratamiento_id) {
      const current = explicitGroups.get(atencion.plan_tratamiento_id) || []
      current.push(atencion)
      explicitGroups.set(atencion.plan_tratamiento_id, current)
      return
    }

    const signature = getImplicitPlanSignature(atencion)
    if (!signature) return

    const current = implicitBuckets.get(signature) || []
    current.push(atencion)
    implicitBuckets.set(signature, current)
  })

  const groups: Atencion[][] = [...explicitGroups.values()]

  implicitBuckets.forEach((bucket) => {
    const sortedBucket = getChronologicalAtenciones(bucket)
    let currentGroup: Atencion[] = []
    let activeCount = 0

    sortedBucket.forEach((atencion) => {
      const totalSesiones = getAtencionPlanTotal(atencion) || 0
      if (currentGroup.length > 0 && activeCount >= totalSesiones) {
        groups.push(currentGroup)
        currentGroup = []
        activeCount = 0
      }

      currentGroup.push(atencion)

      if (!isInactivePlanSession(atencion)) {
        activeCount += 1
      }
    })

    if (currentGroup.length > 0) {
      groups.push(currentGroup)
    }
  })

  return groups
}

const buildPlanLabelMapFromGroups = (groups: Atencion[][]): SessionPlanLabelMap => {
  const labels: SessionPlanLabelMap = {}

  groups.forEach((group) => {
    const orderedGroup = getChronologicalAtenciones(group)
    const activeSessions = orderedGroup.filter((atencion) => !isInactivePlanSession(atencion))
    const totalSesiones = Math.max(
      ...orderedGroup.map((atencion) => getAtencionPlanTotal(atencion) || 0),
      activeSessions.length
    )

    if (totalSesiones <= 1) return

    orderedGroup.forEach((atencion) => {
      labels[atencion.id] = null
    })

    activeSessions.forEach((atencion, index) => {
      labels[atencion.id] = `Sesión ${index + 1}/${totalSesiones}`
    })
  })

  return labels
}

export const buildSessionPlanLabelMap = (atenciones: Atencion[]): SessionPlanLabelMap => {
  return buildPlanLabelMapFromGroups(getPlanGroups(atenciones))
}

export const buildSessionPlanRepairPayloads = (
  atenciones: Atencion[],
  createPlanId: () => string
): SessionPlanRepairPayload[] => {
  const repairs: SessionPlanRepairPayload[] = []

  getPlanGroups(atenciones).forEach((group) => {
    const orderedGroup = getChronologicalAtenciones(group)
    const explicitPlanId = orderedGroup.find((atencion) => atencion.plan_tratamiento_id)?.plan_tratamiento_id || null
    const totalSesiones = Math.max(
      ...orderedGroup.map((atencion) => getAtencionPlanTotal(atencion) || 0),
      orderedGroup.filter((atencion) => !isInactivePlanSession(atencion)).length
    )

    if (totalSesiones <= 1) return
    if (!explicitPlanId && orderedGroup.length < 2) return

    const planId = explicitPlanId || createPlanId()
    let activeIndex = 0

    orderedGroup.forEach((atencion) => {
      const numeroSesion = isInactivePlanSession(atencion)
        ? null
        : ++activeIndex

      const needsUpdate =
        atencion.plan_tratamiento_id !== planId ||
        (atencion.numero_sesion || null) !== numeroSesion ||
        (atencion.total_sesiones || 0) !== totalSesiones

      if (!needsUpdate) return

      repairs.push({
        id: atencion.id,
        plan_tratamiento_id: planId,
        numero_sesion: numeroSesion,
        total_sesiones: totalSesiones
      })
    })
  })

  return repairs
}

export const getSessionPlanLabel = (atencion: Atencion, labelMap?: SessionPlanLabelMap) => {
  if (atencion.es_bloqueo) return null

  if (labelMap && Object.prototype.hasOwnProperty.call(labelMap, atencion.id)) {
    return labelMap[atencion.id]
  }

  if (atencion.plan_tratamiento_id) {
    if (atencion.numero_sesion && atencion.total_sesiones) {
      return `Sesión ${atencion.numero_sesion}/${atencion.total_sesiones}`
    }

    return null
  }

  if (atencion.numero_sesion && atencion.total_sesiones) {
    return `Sesión ${atencion.numero_sesion}/${atencion.total_sesiones}`
  }

  const legacyPlan = parseLegacySessionPlan(atencion.observaciones)
  if (!legacyPlan) return null

  return `Sesión ${legacyPlan.numeroSesion}/${legacyPlan.totalSesiones}`
}
