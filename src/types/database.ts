export interface Centro {
  id: string
  nombre: string
  direccion?: string | null
  telefono?: string | null
  cuit?: string | null
  logo_url?: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Profesional {
  id: string
  nombre: string
  especialidad: string
  email: string | null
  telefono: string | null
  porcentaje_pago: number
  monto_fijo_pago: number
  activo: boolean
  centro_id?: string | null
  sucursal_id?: string | null
  created_at: string
  updated_at: string
  
  // Campos calculados para notificaciones y exportación
  tipo_pago?: 'porcentaje' | 'monto_fijo'
  valor_pago?: number
}

export interface Paciente {
  id: string
  nombre: string
  rut: string
  fecha_nacimiento?: string | null
  telefono: string
  email: string
  direccion: string
  notas: string
  activo?: boolean
  centro_id?: string | null
  sucursal_id?: string | null
  created_at: string
  updated_at: string
}

export interface Atencion {
  id: string
  profesional_id: string
  paciente_id: string | null
  fecha: string
  hora: string
  tipo_atencion: string
  valor_cobrado: number
  pagado: boolean
  estado_cita?: 'por_confirmar' | 'confirmada' | 'cancelada' | 'reagendada'
  estado_asistencia?: 'pendiente' | 'asistio' | 'no_asistio' // Nuevo campo
  es_bloqueo?: boolean
  tipo_bloqueo?: 'almuerzo' | 'reunion' | 'vacaciones' | 'licencia' | 'capacitacion' | 'otro' | null
  numero_boleta?: string // Nuevo campo para número de boleta
  observaciones: string
  activo?: boolean
  centro_id?: string
  sucursal_id: string
  created_at: string
  updated_at: string
  
  // Campos calculados para notificaciones y exportación
  paciente_nombre?: string
  profesional_nombre?: string
  tipo_atencion_nombre?: string
  monto?: number
  estado?: string
  
  // Relaciones
  profesional?: Profesional
  paciente?: Paciente
  tipos_atencion?: TipoAtencion
}

export interface PagoProfesional {
  id: string
  atencion_id: string
  profesional_id: string
  monto_pagado: number
  fecha_pago: string
  tipo_pago: 'porcentaje' | 'monto_fijo'
  created_at: string
  
  // Relaciones
  atencion?: Atencion
  profesional?: Profesional
}

export interface Costo {
  id: string
  tipo: 'fijo' | 'variable' | 'aporte'
  categoria: string
  descripcion: string
  monto: number
  fecha: string
  recurrente: boolean
  activo?: boolean
  centro_id?: string
  sucursal_id: string
  created_at: string
  updated_at: string
}

export interface TipoAtencion {
  id: string
  nombre: string
  valor_base: number
  descripcion: string
  activo: boolean
  centro_id?: string | null
  sucursal_id?: string | null
  created_at: string
}

export interface CentroConfig {
  id: string
  nombre: string
  direccion: string
  telefono: string
  cuit: string
  logo_url: string
  created_at: string
  updated_at: string
}

export interface Usuario {
  id: string
  email: string
  password_hash: string
  nombre: string
  rol: 'admin' | 'profesional' | 'usuario'
  activo: boolean
  profesional_id?: string
  centro_id?: string | null
  sucursal_id?: string
  created_at: string
  updated_at: string
  
  // Relaciones
  centro?: Centro
  profesional?: Profesional
}

export interface Sucursal {
  id: string
  nombre: string
  centro_id: string
  direccion?: string
  telefono?: string
  activo: boolean
  created_at: string
  centro?: Centro
}

export interface ReporteMensual {
  mes: string
  total_atenciones: number
  ingresos_totales: number
  ingresos_cobrados: number
  total_pagado_profesionales: number
  utilidad_neta: number
  costos_fijos: number
  costos_variables: number
  total_costos: number
}

export interface ProfesionalComision {
  id: string
  profesional_id: string
  tipo_atencion_id: string
  porcentaje: number | null
  monto_fijo: number | null
  created_at: string
  
  // Relaciones
  tipos_atencion?: TipoAtencion
}
