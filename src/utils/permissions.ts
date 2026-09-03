import { Atencion, Usuario } from '@/types/database'

export type AppPermission =
  | 'viewDashboard'
  | 'viewPacientes'
  | 'managePacientes'
  | 'viewAgenda'
  | 'createAgenda'
  | 'viewDisponibilidad'
  | 'viewPatientHistory'
  | 'manageProfesionales'
  | 'manageTiposAtencion'
  | 'managePagos'
  | 'viewReportes'
  | 'viewCostos'
  | 'manageUsuarios'
  | 'manageConfiguracion'
  | 'viewFinancialMetrics'
  | 'viewFinancialFields'
  | 'selectAnyProfessional'

const ROLE_PERMISSIONS: Record<Usuario['rol'], AppPermission[]> = {
  admin: [
    'viewDashboard',
    'viewPacientes',
    'managePacientes',
    'viewAgenda',
    'createAgenda',
    'viewDisponibilidad',
    'viewPatientHistory',
    'manageProfesionales',
    'manageTiposAtencion',
    'managePagos',
    'viewReportes',
    'viewCostos',
    'manageUsuarios',
    'manageConfiguracion',
    'viewFinancialMetrics',
    'viewFinancialFields',
    'selectAnyProfessional'
  ],
  profesional: [
    'viewDashboard',
    'viewPacientes',
    'managePacientes',
    'viewAgenda',
    'createAgenda',
    'viewDisponibilidad',
    'viewPatientHistory'
  ],
  usuario: [
    'viewDashboard',
    'viewAgenda',
    'createAgenda',
    'viewFinancialMetrics',
    'viewFinancialFields',
    'selectAnyProfessional'
  ]
}

export const hasPermission = (
  user: Usuario | null | undefined,
  permission: AppPermission
) => {
  if (!user) return false
  return ROLE_PERMISSIONS[user.rol].includes(permission)
}

export const canManageAtencion = (
  user: Usuario | null | undefined,
  atencion: Pick<Atencion, 'profesional_id'> | null | undefined
) => {
  if (!user || !atencion) return false
  if (user.rol === 'admin') return true
  return user.rol === 'profesional' && user.profesional_id === atencion.profesional_id
}

export const getRoleLabel = (user: Usuario | null | undefined) => {
  if (!user) return ''
  if (user.rol === 'admin' && !user.centro_id && !user.sucursal_id) {
    return 'Administrador global'
  }

  switch (user.rol) {
    case 'admin':
      return 'Administrador'
    case 'profesional':
      return 'Profesional'
    default:
      return 'Usuario'
  }
}
