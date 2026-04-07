import { supabase } from '@/lib/supabase'
export { supabase }
import { Profesional, Paciente, Atencion, Costo, TipoAtencion, ReporteMensual, CentroConfig, Usuario, Sucursal, ProfesionalComision } from '@/types/database'

// Helper for audit logging
export const auditService = {
  async logAction(tableName: string, recordId: string, action: 'INSERT' | 'UPDATE' | 'SOFT_DELETE', oldData: any = null, newData: any = null) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      if (!userId) return;

      await supabase.from('audit_logs').insert([{
        table_name: tableName,
        record_id: recordId,
        action: action,
        old_data: oldData,
        new_data: newData,
        changed_by: userId
      }]);
    } catch (e) {
      console.error('Failed to write audit log:', e);
      // We don't throw here to avoid breaking the main flow if audit logging fails
    }
  }
}

// Servicios para Profesionales
export const profesionalesService = {
  async getAll(sucursalId?: string): Promise<Profesional[]> {
    let query = supabase
      .from('profesionales')
      .select('*')
      .order('nombre')
    
    if (sucursalId) {
      // Mostrar profesionales de la sucursal O globales (null)
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
    return data
  },

  async update(id: string, profesional: Partial<Profesional>): Promise<Profesional> {
    const { data, error } = await supabase
      .from('profesionales')
      .update(profesional)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('profesionales')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

// Servicios para Pacientes
export const pacientesService = {
  async getAll(sucursalId?: string): Promise<Paciente[]> {
    let query = supabase
      .from('pacientes')
      .select('*')
      .eq('activo', true)
      .order('nombre')

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
    return data
  },

  async update(id: string, paciente: Partial<Paciente>): Promise<Paciente> {
    const { data, error } = await supabase
      .from('pacientes')
      .update(paciente)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const oldData = await this.getById(id);
    
    const { error } = await supabase
      .from('pacientes')
      .update({ activo: false })
      .eq('id', id)
    
    if (error) throw error;
    if (oldData) await auditService.logAction('pacientes', id, 'SOFT_DELETE', oldData);
  }
}

// Servicios para Atenciones
export const atencionesService = {
  async getAll(sucursalId?: string): Promise<Atencion[]> {
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

  async getByDateRange(startDate: string, endDate: string, sucursalId?: string): Promise<Atencion[]> {
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

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async getPendientes(sucursalId?: string): Promise<Atencion[]> {
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

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async create(atencion: Omit<Atencion, 'id' | 'created_at' | 'updated_at'>): Promise<Atencion> {
    const { data, error } = await supabase
      .from('atenciones')
      .insert([atencion])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async update(id: string, atencion: Partial<Atencion>): Promise<Atencion> {
    const { data, error } = await supabase
      .from('atenciones')
      .update(atencion)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const oldData = await this.getById(id);
    
    const { error } = await supabase
      .from('atenciones')
      .update({ activo: false })
      .eq('id', id)
    
    if (error) throw error;
    if (oldData) await auditService.logAction('atenciones', id, 'SOFT_DELETE', oldData);
  }
}

// Servicios para Costos
export const costosService = {
  async getAll(): Promise<Costo[]> {
    const { data, error } = await supabase
      .from('costos')
      .select('*')
      .eq('activo', true)
      .order('fecha', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async getByTipo(tipo: 'fijo' | 'variable' | 'aporte'): Promise<Costo[]> {
    const { data, error } = await supabase
      .from('costos')
      .select('*')
      .eq('activo', true)
      .eq('tipo', tipo)
      .order('fecha', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async getByDateRange(startDate: string, endDate: string, sucursalId?: string): Promise<Costo[]> {
    let query = supabase
      .from('costos')
      .select('*')
      .eq('activo', true)
      .gte('fecha', startDate)
      .lte('fecha', endDate)
      .order('fecha', { ascending: false })

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
    return data
  },

  async update(id: string, costo: Partial<Costo>): Promise<Costo> {
    const { data, error } = await supabase
      .from('costos')
      .update(costo)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('costos')
      .update({ activo: false })
      .eq('id', id)
    
    if (error) throw error
  }
}

// Servicios para Tipos de Atención
export const tiposAtencionService = {
  async getAll(sucursalId?: string): Promise<TipoAtencion[]> {
    let query = supabase
      .from('tipos_atencion')
      .select('*')
      .eq('activo', true)
      .order('nombre')

    if (sucursalId) {
      query = query.or(`sucursal_id.eq.${sucursalId},sucursal_id.is.null`)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async getAllAdmin(sucursalId?: string): Promise<TipoAtencion[]> {
    let query = supabase
      .from('tipos_atencion')
      .select('*')
      .order('nombre')

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
    return result
  },

  async update(id: string, data: Partial<TipoAtencion>): Promise<TipoAtencion> {
    const { data: result, error } = await supabase
      .from('tipos_atencion')
      .update(data)
      .eq('id', id)
      .select()
    
    if (error) throw error
    if (!result || result.length === 0) {
      throw new Error('No se pudo actualizar: El registro no existe o no tienes permisos');
    }
    return result[0]
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('tipos_atencion')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

// Servicios de Reportes
export const reportesService = {
  async getReporteMensual(anio: number, mes: number, sucursalId?: string): Promise<ReporteMensual> {
    const lastDay = new Date(anio, mes, 0).getDate()
    const startDate = `${anio}-${mes.toString().padStart(2, '0')}-01`
    const endDate = `${anio}-${mes.toString().padStart(2, '0')}-${lastDay}`

    // Obtener atenciones del mes
    const atenciones = await atencionesService.getByDateRange(startDate, endDate, sucursalId)
    
    // Obtener costos del mes
    const costos = await costosService.getByDateRange(startDate, endDate, sucursalId)

    // Obtener comisiones específicas (excepciones)
    const { data: comisionesData } = await supabase.from('profesional_comisiones').select('*')
    const comisiones = comisionesData || []
    
    const costosFijos = costos
      .filter(c => c.tipo === 'fijo')
      .reduce((sum, c) => sum + c.monto, 0)
    
    const costosVariables = costos
      .filter(c => c.tipo === 'variable')
      .reduce((sum, c) => sum + c.monto, 0)

    const ingresosTotales = atenciones.reduce((sum, a) => sum + a.valor_cobrado, 0)
    const ingresosCobrados = atenciones
      .filter(a => a.pagado)
      .reduce((sum, a) => sum + a.valor_cobrado, 0)

    // Calcular pagos a profesionales considerando excepciones
    const totalPagadoProfesionales = atenciones.reduce((sum, a) => {
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
          return sum + (a.valor_cobrado * porcentajeEfectivo / 100)
        } else if (montoFijoEfectivo > 0) {
          return sum + montoFijoEfectivo
        }
      }
      return sum
    }, 0)

    const utilidadNeta = ingresosTotales - totalPagadoProfesionales - costosFijos - costosVariables

    return {
      mes: startDate,
      total_atenciones: atenciones.length,
      ingresos_totales: ingresosTotales,
      ingresos_cobrados: ingresosCobrados,
      total_pagado_profesionales: totalPagadoProfesionales,
      costos_fijos: costosFijos,
      costos_variables: costosVariables,
      total_costos: costosFijos + costosVariables,
      utilidad_neta: utilidadNeta
    }
  }
}

// Servicios para Configuración del Centro
export const centroConfigService = {
  async getConfig(): Promise<CentroConfig | null> {
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
    const { data, error } = await supabase
      .from('centro_config')
      .update(config)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

// Servicios para Usuarios
export const usuariosService = {
  async getAll(): Promise<Usuario[]> {
    const { data, error } = await supabase
      .from('usuarios')
      .select(`*, profesional:profesionales(*)`)
      .order('nombre')
    
    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Usuario | null> {
    const { data, error } = await supabase
      .from('usuarios')
      .select(`*, profesional:profesionales(*)`)
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async create(usuario: Omit<Usuario, 'id' | 'created_at' | 'updated_at'>): Promise<Usuario> {
    const { data, error } = await supabase
      .from('usuarios')
      .insert([usuario])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async update(id: string, usuario: Partial<Usuario>): Promise<Usuario> {
    const { data, error } = await supabase
      .from('usuarios')
      .update(usuario)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('usuarios')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

// Servicios para Sucursales
export const sucursalesService = {
  async getAll(): Promise<Sucursal[]> {
    const { data, error } = await supabase
      .from('sucursales')
      .select('*')
      .eq('activo', true)
      .order('nombre')
    
    if (error) throw error
    return data || []
  },

  async create(sucursal: Omit<Sucursal, 'id' | 'created_at'>): Promise<Sucursal> {
    const { data, error } = await supabase
      .from('sucursales')
      .insert([sucursal])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async update(id: string, sucursal: Partial<Sucursal>): Promise<Sucursal> {
    const { data, error } = await supabase
      .from('sucursales')
      .update(sucursal)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    // Soft delete
    const { error } = await supabase
      .from('sucursales')
      .update({ activo: false })
      .eq('id', id)
    
    if (error) throw error
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
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('profesional_comisiones')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}
