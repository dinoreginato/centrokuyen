import { Atencion, Profesional, ProfesionalComision, TipoPagoProfesional } from '@/types/database'
import { isBillableAtencion } from '@/utils/financial'

export const getProfesionalTipoPago = (profesional?: Profesional | null): TipoPagoProfesional => {
  if (!profesional) return 'porcentaje'
  if (profesional.tipo_pago_base) return profesional.tipo_pago_base
  if ((profesional.monto_fijo_pago || 0) > 0) return 'monto_fijo'
  return 'porcentaje'
}

export const isMonthlyBoxProfessional = (profesional?: Profesional | null) => {
  return getProfesionalTipoPago(profesional) === 'mensual_box'
}

export const calculateAtencionProfessionalPayment = (
  atencion: Atencion,
  profesional?: Profesional | null,
  comisiones: ProfesionalComision[] = []
) => {
  if (!isBillableAtencion(atencion) || !profesional) return 0

  if (isMonthlyBoxProfessional(profesional)) {
    return 0
  }

  const comisionEspecifica = comisiones.find((comision) =>
    comision.profesional_id === atencion.profesional_id &&
    comision.tipo_atencion_id === atencion.tipo_atencion
  )

  if (comisionEspecifica) {
    const porcentaje = comisionEspecifica.porcentaje ?? 0
    const montoFijo = comisionEspecifica.monto_fijo ?? 0
    return ((atencion.valor_cobrado * porcentaje) / 100) + montoFijo
  }

  if ((profesional.porcentaje_pago || 0) > 0) {
    return (atencion.valor_cobrado * profesional.porcentaje_pago) / 100
  }

  if ((profesional.monto_fijo_pago || 0) > 0) {
    return profesional.monto_fijo_pago
  }

  return 0
}

export const getProfesionalPaymentLabel = (profesional?: Profesional | null) => {
  if (!profesional) return 'Sin configuración'

  const tipoPago = getProfesionalTipoPago(profesional)

  if (tipoPago === 'mensual_box') {
    const monto = profesional.monto_mensual_box || 0
    const boxName = profesional.box?.nombre
    return boxName
      ? `Mensual por box ${boxName}: $${monto}`
      : `Mensual por box: $${monto}`
  }

  if (tipoPago === 'monto_fijo') {
    return `$${profesional.monto_fijo_pago || 0} fijo por atención`
  }

  return `${profesional.porcentaje_pago || 0}% por atención`
}

export const getMonthlyBoxIncome = (profesionales: Profesional[]) => {
  return profesionales.reduce((sum, profesional) => {
    if (!isMonthlyBoxProfessional(profesional)) return sum
    return sum + (profesional.monto_mensual_box || 0)
  }, 0)
}
