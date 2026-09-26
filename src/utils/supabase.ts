import { supabase } from '@/lib/supabase'
export { supabase }
import { Profesional, Paciente, Atencion, Costo, TipoAtencion, ReporteMensual, Centro, CentroConfig, Usuario, Sucursal, ProfesionalComision, AuditLog, ProfesionalDisponibilidad } from '@/types/database'
import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { buildBloqueoSlots, getBloqueoLabel } from '@/utils/bloqueos'
import { getFinancialAmount, isBillableAtencion, sumFinancialAmounts } from '@/utils/financial'

const applyCentroFilter = <T>(query: T, centroId?: string | null) => {
  if (!centroId) return query
  return (query as any).eq('centro_id', centroId)
}

const mapCentroToConfig = (centro: Centro): CentroConfig => ({
  id: centro.id,
  nombre: centro.nombre,
  direccion: centro.direccion || '',
  telefono: centro.telefono || '',
  cuit: centro.cuit || '',
  logo_url: centro.logo_url || '',
  created_at: centro.created_at,
  updated_at: centro.updated_at
})

const createUuidLike = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const parseLegacySessionPlan = (observaciones?: string | null) => {
  const match = observaciones?.match(/sesi[oó]n\s+(\d+)\s+de\s+(\d+)/i)
  if (!match) return null

  const numeroSesion = Number(match[1])
  const totalSesiones = Number(match[2])

  if (!Number.isFinite(numeroSesion) || !Number.isFinite(totalSesiones)) {
    return null
  }

  return {
    numeroSesion,
    totalSesiones
  }
}

// Helper for audit logging
type AuditPayload = {
  action: 'INSERT' | 'UPDATE' | 'SOFT_DELETE'
  oldData?: unknown
  newData?: unknown
  metadata?: Record<string, unknown>
  centroId?: string | null
  sucursalId?: string | null
}

export const auditService = {
  async logAction(tableName: string, recordId: string, payload: AuditPayload) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const authUserId = session?.user?.id

      if (!authUserId) return

      const actor = await usuariosService.getByAuthUserId(authUserId)
      const actorCentroId = payload.centroId ?? actor?.centro_id ?? null
      const actorSucursalId = payload.sucursalId ?? actor?.sucursal_id ?? null

      const { error } = await supabase.from('audit_logs').insert([{
        table_name: tableName,
        record_id: recordId,
        action: payload.action,
        old_data: payload.oldData ?? null,
        new_data: payload.newData ?? null,
        metadata: payload.metadata ?? {},
        changed_by: authUserId,
        changed_by_usuario_id: actor?.id ?? null,
        actor_name: actor?.nombre ?? session?.user?.user_metadata?.nombre ?? null,
        actor_email: actor?.email ?? session?.user?.email ?? null,
        actor_role: actor?.rol ?? null,
        centro_id: actorCentroId,
        sucursal_id: actorSucursalId
      }])

      if (error) throw error
    } catch (e) {
      console.error('Failed to write audit log:', e)
      // We don't throw here to avoid breaking the main flow if audit logging fails
    }
  },

  async getRecent(
    limit = 50,
    filters?: {
      tableName?: string
      action?: string
      actorQuery?: string
      search?: string
    }
  ): Promise<AuditLog[]> {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (filters?.tableName && filters.tableName !== 'todos') {
      query = query.eq('table_name', filters.tableName)
    }

    if (filters?.action && filters.action !== 'todos') {
      query = query.eq('action', filters.action)
    }

    if (filters?.actorQuery) {
      const term = filters.actorQuery.trim()
      if (term) {
        query = query.or(`actor_name.ilike.%${term}%,actor_email.ilike.%${term}%`)
      }
    }

    if (filters?.search) {
      const term = filters.search.trim()
      if (term) {
        query = query.or(`table_name.ilike.%${term}%,record_id.ilike.%${term}%`)
      }
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }
}

// Servicios para Profesionales
export const profesionalesService = {
  async getAll(sucursalId?: string, centroId?: string): Promise<Profesional[]> {
    let query = supabase
      .from('profesionales')
      .select('*')
      .order('nombre')

    query = applyCentroFilter(query, centroId)
    
    if (sucursalId) {
      query = query.or(`sucursal_id.eq.${sucursalId},sucursal_id.is.null`)
    }

    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Profesional | null> {
    const { data, error } = await supabase
      .from('profesionales')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async create(profesional: Omit<Profesional, 'id' | 'created_at' | 'updated_at'>): Promise<Profesional> {
    const { data, error } = await supabase
      .from('profesionales')
      .insert([profesional])
      .select()
      .single()
    
    if (error) throw error
    await auditService.logAction('profesionales', data.id, {
      action: 'INSERT',
      newData: data,
      centroId: data.centro_id ?? null,
      sucursalId: data.sucursal_id ?? null
    })
    return data
  },

  async update(id: string, profesional: Partial<Profesional>): Promise<Profesional> {
    const oldData = await this.getById(id)
    const { data, error } = await supabase
      .from('profesionales')
      .update(profesional)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    await auditService.logAction('profesionales', id, {
      action: 'UPDATE',
      oldData,
      newData: data,
      centroId: data.centro_id ?? null,
      sucursalId: data.sucursal_id ?? null
    })
    return data
  },

  async delete(id: string): Promise<void> {
    const oldData = await this.getById(id)
    const { error } = await supabase
      .from('profesionales')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    if (oldData) {
      await auditService.logAction('profesionales', id, {
        action: 'SOFT_DELETE',
        oldData,
        centroId: oldData.centro_id ?? null,
        sucursalId: oldData.sucursal_id ?? null
      })
    }
  }
}

export const profesionalDisponibilidadService = {
  async getByProfesional(profesionalId: string, sucursalId?: string, diaSemana?: number): Promise<ProfesionalDisponibilidad[]> {
    let query = supabase
      .from('profesional_disponibilidad')
      .select('*')
      .eq('profesional_id', profesionalId)
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true })

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    if (typeof diaSemana === 'number') {
      query = query.eq('dia_semana', diaSemana)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  async replaceForProfesional(
    profesionalId: string,
    sucursalId: string,
    disponibilidad: Array<Pick<ProfesionalDisponibilidad, 'dia_semana' | 'hora_inicio' | 'hora_fin'>>
  ): Promise<void> {
    const { data: oldData, error: readError } = await supabase
      .from('profesional_disponibilidad')
      .select('*')
      .eq('profesional_id', profesionalId)
      .eq('sucursal_id', sucursalId)

    if (readError) throw readError

    const { error: deleteError } = await supabase
      .from('profesional_disponibilidad')
      .delete()
      .eq('profesional_id', profesionalId)
      .eq('sucursal_id', sucursalId)

    if (deleteError) throw deleteError

    if (disponibilidad.length > 0) {
      const payload = disponibilidad.map((item) => ({
        profesional_id: profesionalId,
        sucursal_id: sucursalId,
        dia_semana: item.dia_semana,
        hora_inicio: item.hora_inicio,
        hora_fin: item.hora_fin
      }))

      const { error: insertError } = await supabase
        .from('profesional_disponibilidad')
        .insert(payload)

      if (insertError) throw insertError
    }

    await auditService.logAction('profesional_disponibilidad', profesionalId, {
      action: 'UPDATE',
      oldData: oldData || [],
      newData: disponibilidad,
      metadata: { sucursal_id: sucursalId }
    })
  }
}

// Servicios para Pacientes
export const pacientesService = {
  async getAll(sucursalId?: string, centroId?: string): Promise<Paciente[]> {
    let query = supabase
      .from('pacientes')
      .select('*')
      .eq('activo', true)
      .order('nombre')

    query = applyCentroFilter(query, centroId)

    if (sucursalId) {
      query = query.or(`sucursal_id.eq.${sucursalId},sucursal_id.is.null`)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Paciente | null> {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async create(paciente: Omit<Paciente, 'id' | 'created_at' | 'updated_at'>): Promise<Paciente> {
    const { data, error } = await supabase
      .from('pacientes')
      .insert([paciente])
      .select()
      .single()
    
    if (error) throw error
    await auditService.logAction('pacientes', data.id, {
      action: 'INSERT',
      newData: data,
      centroId: data.centro_id ?? null,
      sucursalId: data.sucursal_id ?? null
    })
    return data
  },

  async update(id: string, paciente: Partial<Paciente>): Promise<Paciente> {
    const oldData = await this.getById(id)
    const { data, error } = await supabase
      .from('pacientes')
      .update(paciente)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    await auditService.logAction('pacientes', id, {
      action: 'UPDATE',
      oldData,
      newData: data,
      centroId: data.centro_id ?? null,
      sucursalId: data.sucursal_id ?? null
    })
    return data
  },

  async delete(id: string): Promise<void> {
    const oldData = await this.getById(id);
    
    const { error } = await supabase
      .from('pacientes')
      .update({ activo: false })
      .eq('id', id)
    
    if (error) throw error
    if (oldData) {
      await auditService.logAction('pacientes', id, {
        action: 'SOFT_DELETE',
        oldData,
        centroId: oldData.centro_id ?? null,
        sucursalId: oldData.sucursal_id ?? null
      })
    }
  }
}

// Servicios para Atenciones
const ATENCION_DURATION_MINUTES = 60

const timeToMinutes = (time?: string | null) => {
  const normalized = (time || '00:00').substring(0, 5)
  const [hours, minutes] = normalized.split(':').map(value => parseInt(value || '0', 10))
  return (hours * 60) + minutes
}

const validateAtencionOverlap = async (
  atencion: Pick<Atencion, 'profesional_id' | 'fecha' | 'hora'> & Partial<Atencion>,
  excludeId?: string
) => {
  if (!atencion.profesional_id || !atencion.fecha || !atencion.hora) {
    return
  }

  if (atencion.activo === false) {
    return
  }

  const estadoCita = atencion.estado_cita || 'por_confirmar'
  if (estadoCita === 'cancelada' || estadoCita === 'reagendada') {
    return
  }

  const { data, error } = await supabase
    .from('atenciones')
    .select('id, hora, paciente:pacientes(nombre), es_bloqueo, tipo_atencion, estado_cita')
    .eq('activo', true)
    .eq('profesional_id', atencion.profesional_id)
    .eq('fecha', atencion.fecha)

  if (error) throw error

  const newStart = timeToMinutes(atencion.hora)
  const newEnd = newStart + ATENCION_DURATION_MINUTES

  const overlapping = (data || []).find(existing => {
    if (excludeId && existing.id === excludeId) return false
    if ((existing.estado_cita || 'por_confirmar') === 'cancelada') return false
    if ((existing.estado_cita || 'por_confirmar') === 'reagendada') return false

    const existingStart = timeToMinutes(existing.hora)
    const existingEnd = existingStart + ATENCION_DURATION_MINUTES
    return existingStart < newEnd && existingEnd > newStart
  })

  if (overlapping) {
    const overlappingPaciente = (overlapping as any).paciente
    const horaExistente = String(overlapping.hora || '').substring(0, 5)
    const pacienteNombre = Array.isArray(overlappingPaciente)
      ? overlappingPaciente[0]?.nombre
      : overlappingPaciente?.nombre
    const tipoExistente = overlapping.es_bloqueo
      ? getBloqueoLabel((overlapping as any).tipo_bloqueo) || 'bloque no clínico'
      : (pacienteNombre ? `la atención de ${pacienteNombre}` : 'otra atención')

    throw new Error(`La profesional ya tiene ocupado ese horario a las ${horaExistente} con ${tipoExistente}. Puedes usar la misma hora solo en otra profesional.`)
  }
}

export const atencionesService = {
  async getAll(sucursalId?: string, centroId?: string): Promise<Atencion[]> {
    let query = supabase
      .from('atenciones')
      .select(`
        *,
        profesional:profesionales(*),
        paciente:pacientes(*),
        tipos_atencion(*)
      `)
      .eq('activo', true)
      .order('fecha', { ascending: false })

    query = applyCentroFilter(query, centroId)

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Atencion | null> {
    const { data, error } = await supabase
      .from('atenciones')
      .select(`
        *,
        profesional:profesionales(*),
        paciente:pacientes(*),
        tipos_atencion(*)
      `)
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async getByDateRange(startDate: string, endDate: string, sucursalId?: string, centroId?: string): Promise<Atencion[]> {
    let query = supabase
      .from('atenciones')
      .select(`
        *,
        profesional:profesionales(*),
        paciente:pacientes(*),
        tipos_atencion(*)
      `)
      .eq('activo', true)
      .gte('fecha', startDate)
      .lte('fecha', endDate)
      .order('fecha', { ascending: false })

    query = applyCentroFilter(query, centroId)

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async getPendientes(sucursalId?: string, centroId?: string): Promise<Atencion[]> {
    let query = supabase
      .from('atenciones')
      .select(`
        *,
        profesional:profesionales(*),
        paciente:pacientes(*),
        tipos_atencion(*)
      `)
      .eq('activo', true)
      .eq('pagado', false)
      .order('fecha', { ascending: true })

    query = applyCentroFilter(query, centroId)

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async getByPacienteId(pacienteId: string, sucursalId?: string, profesionalId?: string, centroId?: string): Promise<Atencion[]> {
    let query = supabase
      .from('atenciones')
      .select(`
        *,
        profesional:profesionales(*),
        paciente:pacientes(*),
        tipos_atencion(*)
      `)
      .eq('activo', true)
      .eq('paciente_id', pacienteId)
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })

    query = applyCentroFilter(query, centroId)

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    if (profesionalId) {
      query = query.eq('profesional_id', profesionalId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  async getByProfesionalAndDateRange(profesionalId: string, startDate: string, endDate: string, sucursalId?: string, centroId?: string): Promise<Atencion[]> {
    let query = supabase
      .from('atenciones')
      .select(`
        *,
        profesional:profesionales(*),
        paciente:pacientes(*),
        tipos_atencion(*)
      `)
      .eq('activo', true)
      .eq('profesional_id', profesionalId)
      .gte('fecha', startDate)
      .lte('fecha', endDate)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true })

    query = applyCentroFilter(query, centroId)

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  async create(atencion: Omit<Atencion, 'id' | 'created_at' | 'updated_at'>): Promise<Atencion> {
    await validateAtencionOverlap(atencion)

    const { data, error } = await supabase
      .from('atenciones')
      .insert([atencion])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async createBloqueosOperativos(
    baseAtencion: Omit<Atencion, 'id' | 'created_at' | 'updated_at'>,
    config?: {
      fechaFin?: string
      horaFin?: string
    }
  ): Promise<Atencion[]> {
    const fechaFin = config?.fechaFin || baseAtencion.fecha
    const horaFin = config?.horaFin || baseAtencion.hora
    const fechas = eachDayOfInterval({
      start: parseISO(baseAtencion.fecha),
      end: parseISO(fechaFin)
    }).map((date) => format(date, 'yyyy-MM-dd'))
    const slots = buildBloqueoSlots(baseAtencion.hora, horaFin)

    if (slots.length === 0) {
      throw new Error('El rango horario del bloqueo no es válido')
    }

    const bloqueos = fechas.flatMap((fecha) =>
      slots.map((hora) => ({
        ...baseAtencion,
        fecha,
        hora
      }))
    )

    for (const bloqueo of bloqueos) {
      await validateAtencionOverlap(bloqueo)
    }

    const created: Atencion[] = []

    for (const bloqueo of bloqueos) {
      const registro = await this.create(bloqueo)
      created.push(registro)
    }

    return created
  },

  async getByPlanTratamientoId(planTratamientoId: string, sucursalId?: string, centroId?: string): Promise<Atencion[]> {
    let query = supabase
      .from('atenciones')
      .select(`
        *,
        profesional:profesionales(*),
        paciente:pacientes(*),
        tipos_atencion(*)
      `)
      .eq('activo', true)
      .eq('plan_tratamiento_id', planTratamientoId)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true })

    query = applyCentroFilter(query, centroId)

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  async reindexPlanSessions(planTratamientoId: string, sucursalId?: string, centroId?: string): Promise<void> {
    const atencionesPlan = await this.getByPlanTratamientoId(planTratamientoId, sucursalId, centroId)
    if (atencionesPlan.length === 0) return

    const atencionesActivas = atencionesPlan.filter((atencion) => {
      const estadoCita = atencion.estado_cita || 'por_confirmar'
      return !atencion.es_bloqueo && estadoCita !== 'cancelada' && estadoCita !== 'reagendada'
    })

    const totalSesionesPlan = Math.max(
      ...atencionesPlan.map(atencion => atencion.total_sesiones || 0),
      atencionesActivas.length
    )

    const updates = [
      ...atencionesActivas.map((atencion, index) =>
        supabase
          .from('atenciones')
          .update({
            numero_sesion: index + 1,
            total_sesiones: totalSesionesPlan
          })
          .eq('id', atencion.id)
      ),
      ...atencionesPlan
        .filter((atencion) => !atencionesActivas.some(activa => activa.id === atencion.id))
        .map((atencion) =>
          supabase
            .from('atenciones')
            .update({
              numero_sesion: null,
              total_sesiones: totalSesionesPlan
            })
            .eq('id', atencion.id)
        )
    ]

    const results = await Promise.all(updates)
    const firstError = results.find(result => result.error)?.error

    if (firstError) throw firstError
  },

  async ensureLegacyPlanMetadata(atencion: Atencion): Promise<Atencion> {
    if (atencion.plan_tratamiento_id && atencion.total_sesiones) {
      return atencion
    }

    if (!atencion.paciente_id) {
      return atencion
    }

    const legacyPlan = parseLegacySessionPlan(atencion.observaciones)
    if (!legacyPlan || legacyPlan.totalSesiones <= 1) {
      return atencion
    }

    const relatedAtenciones = await this.getByPacienteId(
      atencion.paciente_id,
      atencion.sucursal_id,
      atencion.profesional_id,
      atencion.centro_id
    )

    const planAtenciones = relatedAtenciones
      .filter((related) => {
        if (related.es_bloqueo) return false
        if (related.profesional_id !== atencion.profesional_id) return false
        if (related.tipo_atencion !== atencion.tipo_atencion) return false

        const relatedPlan = parseLegacySessionPlan(related.observaciones)
        return relatedPlan?.totalSesiones === legacyPlan.totalSesiones
      })
      .sort((a, b) => {
        const dateCompare = a.fecha.localeCompare(b.fecha)
        return dateCompare !== 0 ? dateCompare : a.hora.localeCompare(b.hora)
      })

    if (planAtenciones.length < 2) {
      return atencion
    }

    const planTratamientoId = createUuidLike()
    const updates = planAtenciones.map((related, index) =>
      supabase
        .from('atenciones')
        .update({
          plan_tratamiento_id: planTratamientoId,
          numero_sesion: index + 1,
          total_sesiones: legacyPlan.totalSesiones
        })
        .eq('id', related.id)
    )

    const results = await Promise.all(updates)
    const firstError = results.find(result => result.error)?.error

    if (firstError) throw firstError

    const refreshed = await this.getById(atencion.id)
    return refreshed || {
      ...atencion,
      plan_tratamiento_id: planTratamientoId,
      total_sesiones: legacyPlan.totalSesiones
    }
  },

  async updateEstadoCita(id: string, estado_cita: NonNullable<Atencion['estado_cita']>): Promise<Atencion> {
    const existing = await this.getById(id)

    if (!existing) {
      throw new Error('La atención que intentas actualizar no existe')
    }

    const updates: Partial<Atencion> = { estado_cita }

    if (estado_cita === 'cancelada' || estado_cita === 'reagendada') {
      updates.pagado = false
      updates.estado_asistencia = 'pendiente'
      updates.numero_boleta = ''
    }

    return this.update(id, updates)
  },

  async update(id: string, atencion: Partial<Atencion>): Promise<Atencion> {
    const existing = await this.getById(id)
    if (!existing) {
      throw new Error('La atención que intentas actualizar no existe')
    }

    const shouldValidateOverlap =
      atencion.profesional_id !== undefined ||
      atencion.fecha !== undefined ||
      atencion.hora !== undefined ||
      atencion.activo !== undefined ||
      atencion.estado_cita !== undefined

    if (shouldValidateOverlap) {
      await validateAtencionOverlap({
        ...existing,
        ...atencion,
        profesional_id: atencion.profesional_id ?? existing.profesional_id,
        fecha: atencion.fecha ?? existing.fecha,
        hora: atencion.hora ?? existing.hora
      }, id)
    }

    const { data, error } = await supabase
      .from('atenciones')
      .update(atencion)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error

    if (
      existing.plan_tratamiento_id &&
      (
        atencion.fecha !== undefined ||
        atencion.hora !== undefined ||
        atencion.estado_cita !== undefined ||
        atencion.activo !== undefined
      )
    ) {
      await this.reindexPlanSessions(existing.plan_tratamiento_id, existing.sucursal_id, existing.centro_id)
    }

    return data
  },

  async setPagado(id: string, pagado: boolean): Promise<Atencion> {
    const { data, error } = await supabase.rpc('set_atencion_pagado', {
      p_atencion_id: id,
      p_pagado: pagado
    })

    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('atenciones')
      .update({ activo: false })
      .eq('id', id)
    
    if (error) throw error
  }
}

// Servicios para Costos
export const costosService = {
  async getAll(sucursalId?: string, centroId?: string): Promise<Costo[]> {
    let query = supabase
      .from('costos')
      .select('*')
      .eq('activo', true)
      .order('fecha', { ascending: false })

    query = applyCentroFilter(query, centroId)

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async getByTipo(tipo: 'fijo' | 'variable' | 'aporte', sucursalId?: string, centroId?: string): Promise<Costo[]> {
    let query = supabase
      .from('costos')
      .select('*')
      .eq('activo', true)
      .eq('tipo', tipo)
      .order('fecha', { ascending: false })

    query = applyCentroFilter(query, centroId)

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async getByDateRange(startDate: string, endDate: string, sucursalId?: string, centroId?: string): Promise<Costo[]> {
    let query = supabase
      .from('costos')
      .select('*')
      .eq('activo', true)
      .gte('fecha', startDate)
      .lte('fecha', endDate)
      .order('fecha', { ascending: false })

    query = applyCentroFilter(query, centroId)

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async create(costo: Omit<Costo, 'id' | 'created_at' | 'updated_at'>): Promise<Costo> {
    const { data, error } = await supabase
      .from('costos')
      .insert([costo])
      .select()
      .single()
    
    if (error) throw error
    await auditService.logAction('costos', data.id, {
      action: 'INSERT',
      newData: data,
      centroId: data.centro_id ?? null,
      sucursalId: data.sucursal_id ?? null
    })
    return data
  },

  async update(id: string, costo: Partial<Costo>): Promise<Costo> {
    const oldData = await supabase.from('costos').select('*').eq('id', id).single()
    const { data, error } = await supabase
      .from('costos')
      .update(costo)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    await auditService.logAction('costos', id, {
      action: 'UPDATE',
      oldData: oldData.data ?? null,
      newData: data,
      centroId: data.centro_id ?? null,
      sucursalId: data.sucursal_id ?? null
    })
    return data
  },

  async delete(id: string): Promise<void> {
    const oldData = await supabase.from('costos').select('*').eq('id', id).single()
    const { error } = await supabase
      .from('costos')
      .update({ activo: false })
      .eq('id', id)
    
    if (error) throw error
    if (oldData.data) {
      await auditService.logAction('costos', id, {
        action: 'SOFT_DELETE',
        oldData: oldData.data,
        centroId: oldData.data.centro_id ?? null,
        sucursalId: oldData.data.sucursal_id ?? null
      })
    }
  }
}

// Servicios para Tipos de Atención
export const tiposAtencionService = {
  async getAll(sucursalId?: string, centroId?: string): Promise<TipoAtencion[]> {
    let query = supabase
      .from('tipos_atencion')
      .select('*')
      .eq('activo', true)
      .order('nombre')

    query = applyCentroFilter(query, centroId)

    if (sucursalId) {
      query = query.or(`sucursal_id.eq.${sucursalId},sucursal_id.is.null`)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async getAllAdmin(sucursalId?: string, centroId?: string): Promise<TipoAtencion[]> {
    let query = supabase
      .from('tipos_atencion')
      .select('*')
      .order('nombre')

    query = applyCentroFilter(query, centroId)

    if (sucursalId) {
      query = query.or(`sucursal_id.eq.${sucursalId},sucursal_id.is.null`)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<TipoAtencion | null> {
    const { data, error } = await supabase
      .from('tipos_atencion')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async create(data: Omit<TipoAtencion, 'id' | 'created_at'>): Promise<TipoAtencion> {
    const { data: result, error } = await supabase
      .from('tipos_atencion')
      .insert([data])
      .select()
      .single()
    
    if (error) throw error
    await auditService.logAction('tipos_atencion', result.id, {
      action: 'INSERT',
      newData: result,
      centroId: result.centro_id ?? null,
      sucursalId: result.sucursal_id ?? null
    })
    return result
  },

  async update(id: string, data: Partial<TipoAtencion>): Promise<TipoAtencion> {
    const oldData = await this.getById(id)
    const { data: result, error } = await supabase
      .from('tipos_atencion')
      .update(data)
      .eq('id', id)
      .select()
    
    if (error) throw error
    if (!result || result.length === 0) {
      throw new Error('No se pudo actualizar: El registro no existe o no tienes permisos')
    }
    await auditService.logAction('tipos_atencion', id, {
      action: 'UPDATE',
      oldData,
      newData: result[0],
      centroId: result[0].centro_id ?? null,
      sucursalId: result[0].sucursal_id ?? null
    })
    return result[0]
  },

  async delete(id: string): Promise<void> {
    const oldData = await this.getById(id)
    const { error } = await supabase
      .from('tipos_atencion')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    if (oldData) {
      await auditService.logAction('tipos_atencion', id, {
        action: 'SOFT_DELETE',
        oldData,
        centroId: oldData.centro_id ?? null,
        sucursalId: oldData.sucursal_id ?? null
      })
    }
  }
}

// Servicios de Reportes
export const reportesService = {
  async getReporteMensual(anio: number, mes: number, sucursalId?: string, centroId?: string): Promise<ReporteMensual> {
    const lastDay = new Date(anio, mes, 0).getDate()
    const startDate = `${anio}-${mes.toString().padStart(2, '0')}-01`
    const endDate = `${anio}-${mes.toString().padStart(2, '0')}-${lastDay}`

    // Obtener atenciones del mes
    const atenciones = await atencionesService.getByDateRange(startDate, endDate, sucursalId, centroId)
    
    // Obtener costos del mes
    const costos = await costosService.getByDateRange(startDate, endDate, sucursalId, centroId)

    const atencionesCobrables = atenciones.filter(isBillableAtencion)

    // Obtener comisiones específicas (excepciones)
    const { data: comisionesData } = await supabase.from('profesional_comisiones').select('*')
    const comisiones = comisionesData || []
    
    const costosFijos = costos
      .filter(c => c.tipo === 'fijo')
      .reduce((sum, c) => sum + c.monto, 0)
    
    const costosVariables = costos
      .filter(c => c.tipo === 'variable')
      .reduce((sum, c) => sum + c.monto, 0)

    const totalAportes = costos
      .filter(c => c.tipo === 'aporte')
      .reduce((sum, c) => sum + c.monto, 0)

    const ingresosTotales = sumFinancialAmounts(atencionesCobrables)
    const ingresosCobrados = atencionesCobrables
      .filter(a => a.pagado)
      .reduce((sum, a) => sum + getFinancialAmount(a), 0)
    const saldoPendiente = ingresosTotales - ingresosCobrados

    // Calcular pagos a profesionales considerando excepciones
    const totalPagadoProfesionales = atencionesCobrables.reduce((sum, a) => {
      if (a.profesional) {
        // Buscar regla específica para este profesional y tipo de atención
        const comisionEspecifica = comisiones.find(c => 
          c.profesional_id === a.profesional_id && 
          c.tipo_atencion_id === a.tipo_atencion
        )

        // Usar porcentaje específico si existe, si no el general del profesional
        const porcentajeEfectivo = comisionEspecifica?.porcentaje ?? a.profesional.porcentaje_pago ?? 0
        const montoFijoEfectivo = comisionEspecifica?.monto_fijo ?? a.profesional.monto_fijo_pago ?? 0

        if (porcentajeEfectivo > 0) {
          return sum + (getFinancialAmount(a) * porcentajeEfectivo / 100)
        } else if (montoFijoEfectivo > 0) {
          return sum + montoFijoEfectivo
        }
      }
      return sum
    }, 0)

    const costosOperacionales = costosFijos + costosVariables
    const totalOperacion = costosOperacionales + totalPagadoProfesionales
    const resultadoFinal = ingresosTotales + totalAportes - totalOperacion

    return {
      mes: startDate,
      total_atenciones: atenciones.length,
      ingresos_totales: ingresosTotales,
      ingresos_cobrados: ingresosCobrados,
      total_pagado_profesionales: totalPagadoProfesionales,
      total_aportes: totalAportes,
      utilidad_neta: resultadoFinal,
      resultado_final: resultadoFinal,
      costos_fijos: costosFijos,
      costos_variables: costosVariables,
      costos_operacionales: costosOperacionales,
      total_costos: costosOperacionales,
      total_operacion: totalOperacion,
      saldo_pendiente: saldoPendiente
    }
  }
}

// Servicios para Centros
export const centrosService = {
  async getUsageSummary(id: string) {
    const [
      sucursales,
      usuarios,
      profesionales,
      pacientes,
      tiposAtencion,
      atenciones,
      costos
    ] = await Promise.all([
      supabase.from('sucursales').select('*', { count: 'exact', head: true }).eq('centro_id', id).eq('activo', true),
      supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('centro_id', id),
      supabase.from('profesionales').select('*', { count: 'exact', head: true }).eq('centro_id', id).eq('activo', true),
      supabase.from('pacientes').select('*', { count: 'exact', head: true }).eq('centro_id', id).eq('activo', true),
      supabase.from('tipos_atencion').select('*', { count: 'exact', head: true }).eq('centro_id', id).eq('activo', true),
      supabase.from('atenciones').select('*', { count: 'exact', head: true }).eq('centro_id', id).eq('activo', true),
      supabase.from('costos').select('*', { count: 'exact', head: true }).eq('centro_id', id).eq('activo', true)
    ])

    const results = { sucursales, usuarios, profesionales, pacientes, tiposAtencion, atenciones, costos }
    const errors = Object.values(results).find(result => result.error)
    if (errors?.error) throw errors.error

    return {
      sucursales: sucursales.count || 0,
      usuarios: usuarios.count || 0,
      profesionales: profesionales.count || 0,
      pacientes: pacientes.count || 0,
      tiposAtencion: tiposAtencion.count || 0,
      atenciones: atenciones.count || 0,
      costos: costos.count || 0,
    }
  },

  async getAll(): Promise<Centro[]> {
    const { data, error } = await supabase
      .from('centros')
      .select('*')
      .eq('activo', true)
      .order('nombre')

    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Centro | null> {
    const { data, error } = await supabase
      .from('centros')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async create(centro: Omit<Centro, 'id' | 'created_at' | 'updated_at'>): Promise<Centro> {
    const { data, error } = await supabase
      .from('centros')
      .insert([centro])
      .select()
      .single()

    if (error) throw error
    await auditService.logAction('centros', data.id, {
      action: 'INSERT',
      newData: data,
      centroId: data.id
    })
    return data
  },

  async update(id: string, centro: Partial<Centro>): Promise<Centro> {
    const oldData = await this.getById(id)
    const { data, error } = await supabase
      .from('centros')
      .update(centro)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    await auditService.logAction('centros', id, {
      action: 'UPDATE',
      oldData,
      newData: data,
      centroId: data.id
    })
    return data
  },

  async delete(id: string): Promise<void> {
    const usage = await this.getUsageSummary(id)
    const totalDependencies = Object.values(usage).reduce((sum, count) => sum + count, 0)

    if (totalDependencies > 0) {
      const details = [
        usage.sucursales > 0 ? `${usage.sucursales} sucursales` : null,
        usage.usuarios > 0 ? `${usage.usuarios} usuarios` : null,
        usage.profesionales > 0 ? `${usage.profesionales} profesionales` : null,
        usage.pacientes > 0 ? `${usage.pacientes} pacientes` : null,
        usage.tiposAtencion > 0 ? `${usage.tiposAtencion} tipos de atención` : null,
        usage.atenciones > 0 ? `${usage.atenciones} atenciones` : null,
        usage.costos > 0 ? `${usage.costos} costos` : null
      ].filter(Boolean).join(', ')

      throw new Error(`No se puede eliminar el centro porque todavía tiene datos asociados: ${details}.`)
    }

    const oldData = await this.getById(id)
    const { error } = await supabase
      .from('centros')
      .update({ activo: false })
      .eq('id', id)

    if (error) throw error
    if (oldData) {
      await auditService.logAction('centros', id, {
        action: 'SOFT_DELETE',
        oldData,
        centroId: id,
        metadata: usage
      })
    }
  }
}

// Servicios para Configuración del Centro
export const centroConfigService = {
  async getConfig(centroId?: string): Promise<CentroConfig | null> {
    if (centroId) {
      const centro = await centrosService.getById(centroId)
      if (centro) {
        return mapCentroToConfig(centro)
      }
    }

    const centros = await centrosService.getAll()
    if (centros.length > 0) {
      return mapCentroToConfig(centros[0])
    }

    const { data, error } = await supabase
      .from('centro_config')
      .select('*')
      .limit(1)
    
    if (error) throw error
    return data && data.length > 0 ? data[0] : null
  },

  async create(config: Omit<CentroConfig, 'id' | 'created_at' | 'updated_at'>): Promise<CentroConfig> {
    // Verificar si ya existe una configuración antes de crear
    const existing = await this.getConfig()
    if (existing) {
      return this.update(existing.id, config)
    }

    const { data, error } = await supabase
      .from('centro_config')
      .insert([config])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async update(id: string, config: Partial<CentroConfig>): Promise<CentroConfig> {
    const oldData = await supabase.from('centro_config').select('*').eq('id', id).single()
    const { data, error } = await supabase
      .from('centro_config')
      .update(config)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    await auditService.logAction('centro_config', id, {
      action: 'UPDATE',
      oldData: oldData.data ?? null,
      newData: data,
      centroId: data.id
    })
    return data
  }
}

// Servicios para Usuarios
type UsuarioUpsertInput = {
  nombre: string
  email: string
  rol: Usuario['rol']
  centro_id?: string | null
  sucursal_id?: string | null
  profesional_id?: string | null
  activo?: boolean
  password?: string
}

const usuarioSelect = `
  id,
  email,
  nombre,
  rol,
  activo,
  profesional_id,
  auth_user_id,
  centro_id,
  sucursal_id,
  created_at,
  updated_at,
  profesional:profesionales(*),
  centro:centros(*)
`

const normalizeUsuario = (usuario: any): Usuario => ({
  ...usuario,
  profesional: Array.isArray(usuario?.profesional) ? usuario.profesional[0] || undefined : usuario?.profesional,
  centro: Array.isArray(usuario?.centro) ? usuario.centro[0] || undefined : usuario?.centro
})

export const usuariosService = {
  async getAll(): Promise<Usuario[]> {
    const { data, error } = await supabase
      .from('usuarios')
      .select(usuarioSelect)
      .order('nombre')
    
    if (error) throw error
    return (data || []).map(normalizeUsuario)
  },

  async getById(id: string): Promise<Usuario | null> {
    const { data, error } = await supabase
      .from('usuarios')
      .select(usuarioSelect)
      .eq('id', id)
      .single()
    
    if (error) throw error
    return normalizeUsuario(data)
  },

  async getByAuthUserId(authUserId: string): Promise<Usuario | null> {
    const { data, error } = await supabase
      .from('usuarios')
      .select(usuarioSelect)
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (error) throw error
    return data ? normalizeUsuario(data) : null
  },

  async create(usuario: UsuarioUpsertInput): Promise<Usuario> {
    const { data, error } = await supabase.rpc('create_application_user', {
      p_email: usuario.email,
      p_password: usuario.password,
      p_nombre: usuario.nombre,
      p_rol: usuario.rol,
      p_centro_id: usuario.centro_id || null,
      p_sucursal_id: usuario.sucursal_id || null,
      p_profesional_id: usuario.profesional_id || null
    })

    if (error) throw error
    const createdUser = await this.getById(data)
    if (!createdUser) throw new Error('No se pudo recuperar el usuario creado')
    await auditService.logAction('usuarios', createdUser.id, {
      action: 'INSERT',
      newData: createdUser,
      centroId: createdUser.centro_id ?? null,
      sucursalId: createdUser.sucursal_id ?? null
    })
    return createdUser
  },

  async update(id: string, usuario: Partial<UsuarioUpsertInput>): Promise<Usuario> {
    const oldData = await this.getById(id)
    const { error } = await supabase.rpc('update_application_user', {
      p_usuario_id: id,
      p_email: usuario.email,
      p_password: usuario.password,
      p_nombre: usuario.nombre,
      p_rol: usuario.rol,
      p_centro_id: usuario.centro_id ?? null,
      p_sucursal_id: usuario.sucursal_id ?? null,
      p_profesional_id: usuario.profesional_id ?? null,
      p_activo: usuario.activo
    })

    if (error) throw error
    const updatedUser = await this.getById(id)
    if (!updatedUser) throw new Error('No se pudo recuperar el usuario actualizado')
    await auditService.logAction('usuarios', id, {
      action: 'UPDATE',
      oldData,
      newData: updatedUser,
      centroId: updatedUser.centro_id ?? null,
      sucursalId: updatedUser.sucursal_id ?? null
    })
    return updatedUser
  },

  async delete(id: string): Promise<void> {
    const oldData = await this.getById(id)
    const { error } = await supabase.rpc('delete_application_user', {
      p_usuario_id: id
    })
    
    if (error) throw error
    if (oldData) {
      await auditService.logAction('usuarios', id, {
        action: 'SOFT_DELETE',
        oldData,
        centroId: oldData.centro_id ?? null,
        sucursalId: oldData.sucursal_id ?? null
      })
    }
  }
}

// Servicios para Sucursales
export const sucursalesService = {
  async getAll(centroId?: string): Promise<Sucursal[]> {
    let query = supabase
      .from('sucursales')
      .select('*, centro:centros(*)')
      .eq('activo', true)
      .order('nombre')

    query = applyCentroFilter(query, centroId)

    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Sucursal | null> {
    const { data, error } = await supabase
      .from('sucursales')
      .select('*, centro:centros(*)')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async create(sucursal: Omit<Sucursal, 'id' | 'created_at'>): Promise<Sucursal> {
    const { data, error } = await supabase
      .from('sucursales')
      .insert([sucursal])
      .select()
      .single()
    
    if (error) throw error
    await auditService.logAction('sucursales', data.id, {
      action: 'INSERT',
      newData: data,
      centroId: data.centro_id
    })
    return data
  },

  async update(id: string, sucursal: Partial<Sucursal>): Promise<Sucursal> {
    const oldData = await supabase.from('sucursales').select('*').eq('id', id).single()
    const { data, error } = await supabase
      .from('sucursales')
      .update(sucursal)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    await auditService.logAction('sucursales', id, {
      action: 'UPDATE',
      oldData: oldData.data ?? null,
      newData: data,
      centroId: data.centro_id
    })
    return data
  },

  async delete(id: string): Promise<void> {
    // Soft delete
    const oldData = await supabase.from('sucursales').select('*').eq('id', id).single()
    const { error } = await supabase
      .from('sucursales')
      .update({ activo: false })
      .eq('id', id)
    
    if (error) throw error
    if (oldData.data) {
      await auditService.logAction('sucursales', id, {
        action: 'SOFT_DELETE',
        oldData: oldData.data,
        centroId: oldData.data.centro_id
      })
    }
  }
}

// Servicios para Comisiones por Tipo de Atención
export const profesionalComisionesService = {
  async getAll(profesionalId: string): Promise<ProfesionalComision[]> {
    const { data, error } = await supabase
      .from('profesional_comisiones')
      .select(`
        *,
        tipos_atencion:tipos_atencion(*)
      `)
      .eq('profesional_id', profesionalId)
    
    if (error) throw error
    return data || []
  },

  async create(comision: Omit<ProfesionalComision, 'id' | 'created_at'>): Promise<ProfesionalComision> {
    const { data, error } = await supabase
      .from('profesional_comisiones')
      .insert([comision])
      .select()
      .single()
    
    if (error) throw error
    await auditService.logAction('profesional_comisiones', data.id, {
      action: 'INSERT',
      newData: data
    })
    return data
  },

  async delete(id: string): Promise<void> {
    const oldData = await supabase.from('profesional_comisiones').select('*').eq('id', id).single()
    const { error } = await supabase
      .from('profesional_comisiones')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    if (oldData.data) {
      await auditService.logAction('profesional_comisiones', id, {
        action: 'SOFT_DELETE',
        oldData: oldData.data
      })
    }
  }
}
