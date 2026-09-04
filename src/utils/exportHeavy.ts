import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { Atencion, Profesional, Costo } from '@/types/database'
import { formatCLP } from './currency'

export const exportToPDF = {
  monthlyReport: (data: {
    centerName?: string
    month: string
    year: number
    totalIncome: number
    totalCosts: number
    totalProfit: number
    professionalPayments: Array<{
      professional: string
      speciality?: string
      appointments: number
      totalIncome?: number
      totalPayment: number
      pendingPayment?: number
      paymentType: string
    }>
    costs: {
      fixed: number
      variable: number
    }
  }) => {
    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.text(`Reporte Mensual - ${data.centerName || 'Centro Médico'}`, 105, 20, { align: 'center' })

    doc.setFontSize(12)
    doc.text(`Período: ${data.month} ${data.year}`, 105, 35, { align: 'center' })
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 105, 45, { align: 'center' })

    doc.setFontSize(16)
    doc.text('Resumen Financiero', 20, 65)

    doc.setFontSize(12)
    doc.text(`Ingresos Totales: ${formatCLP(data.totalIncome)}`, 20, 75)
    doc.text(`Costos Totales: ${formatCLP(data.totalCosts)}`, 20, 85)
    doc.text(`Ganancia Neta: ${formatCLP(data.totalProfit)}`, 20, 95)
    doc.text(`Costos Fijos: ${formatCLP(data.costs.fixed)}`, 20, 105)
    doc.text(`Costos Variables: ${formatCLP(data.costs.variable)}`, 20, 115)

    doc.setFontSize(16)
    doc.text('Pagos a Profesionales', 20, 135)

    let yPosition = 145
    data.professionalPayments.forEach((payment, index) => {
      doc.setFontSize(12)
      doc.text(`${index + 1}. ${payment.professional}`, 20, yPosition)
      doc.text(`   Especialidad: ${payment.speciality || '-'}`, 20, yPosition + 8)
      doc.text(`   Atenciones: ${payment.appointments} · Ingresos: ${formatCLP(payment.totalIncome || 0)}`, 20, yPosition + 16)
      doc.text(`   Pago Total: ${formatCLP(payment.totalPayment)} · Pendiente: ${formatCLP(payment.pendingPayment || 0)} (${payment.paymentType})`, 20, yPosition + 24)
      yPosition += 33

      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }
    })

    const pageCount = (doc as any).getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      ;(doc as any).setPage(i)
      doc.setFontSize(10)
      doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' })
    }

    doc.save(`reporte_mensual_${data.month}_${data.year}.pdf`)
  },

  professionalReport: (
    professional: Profesional,
    appointments: Atencion[],
    month: string,
    year: number,
    totalPayment: number,
    centerName?: string
  ) => {
    const doc = new jsPDF()

    const tipoPago = professional.porcentaje_pago > 0 ? 'porcentaje' : 'monto_fijo'
    const valorPago = professional.porcentaje_pago > 0 ? professional.porcentaje_pago : professional.monto_fijo_pago

    doc.setFontSize(20)
    doc.text(`Reporte Profesional - ${professional.nombre}`, 105, 20, { align: 'center' })

    doc.setFontSize(12)
    doc.text(centerName || 'Centro Médico', 105, 28, { align: 'center' })
    doc.text(`Período: ${month} ${year}`, 105, 35, { align: 'center' })

    doc.setFontSize(16)
    doc.text('Información del Profesional', 20, 55)

    doc.setFontSize(12)
    doc.text(`Nombre: ${professional.nombre}`, 20, 65)
    doc.text(`Especialidad: ${professional.especialidad}`, 20, 75)
    doc.text(`Tipo de Pago: ${tipoPago === 'porcentaje' ? 'Porcentaje' : 'Monto Fijo'}`, 20, 85)

    if (tipoPago === 'porcentaje') {
      doc.text(`Porcentaje: ${valorPago}%`, 20, 95)
    } else {
      doc.text(`Monto Fijo: $${valorPago}`, 20, 95)
    }

    doc.setFontSize(16)
    doc.text('Resumen de Atenciones', 20, 115)

    const totalAppointments = appointments.length
    const totalIncome = appointments.reduce((sum, app) => sum + (app.valor_cobrado || 0), 0)

    doc.setFontSize(12)
    doc.text(`Total de Atenciones: ${totalAppointments}`, 20, 125)
    doc.text(`Ingresos Totales: ${formatCLP(totalIncome)}`, 20, 135)
    doc.text(`Pago al Profesional: ${formatCLP(totalPayment)}`, 20, 145)

    if (appointments.length > 0) {
      doc.setFontSize(16)
      doc.text('Detalle de Atenciones', 20, 165)

      let yPosition = 175
      appointments.forEach((appointment, index) => {
        doc.setFontSize(10)
        doc.text(`${index + 1}. ${new Date(appointment.fecha).toLocaleDateString()} - ${appointment.paciente_nombre || appointment.paciente?.nombre || 'Paciente'}`, 20, yPosition)
        doc.text(`   Servicio: ${appointment.tipos_atencion?.nombre || appointment.tipo_atencion_nombre || appointment.tipo_atencion}`, 20, yPosition + 6)
        doc.text(`   Monto: ${formatCLP(appointment.monto || appointment.valor_cobrado || 0)}`, 20, yPosition + 12)
        yPosition += 20

        if (yPosition > 250) {
          doc.addPage()
          yPosition = 20
        }
      })
    }

    doc.setFontSize(10)
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 105, 285, { align: 'center' })

    doc.save(`reporte_profesional_${professional.nombre.replace(/\s+/g, '_')}_${month}_${year}.pdf`)
  }
}

export const exportToExcel = {
  monthlyReport: (data: {
    centerName?: string
    month: string
    year: number
    totalIncome: number
    totalCosts: number
    totalProfit: number
    professionalPayments: Array<{
      professional: string
      speciality?: string
      appointments: number
      totalIncome?: number
      totalPayment: number
      pendingPayment?: number
      paymentType: string
    }>
    costs: {
      fixed: number
      variable: number
    }
    appointments: Atencion[]
    costsList: Costo[]
  }) => {
    const wb = XLSX.utils.book_new()

    const summaryData = [
      [`REPORTE MENSUAL - ${(data.centerName || 'CENTRO MÉDICO').toUpperCase()}`, ''],
      [`Período: ${data.month} ${data.year}`, ''],
      ['', ''],
      ['RESUMEN FINANCIERO', ''],
      ['Ingresos Totales', formatCLP(data.totalIncome)],
      ['Costos Totales', formatCLP(data.totalCosts)],
      ['Ganancia Neta', formatCLP(data.totalProfit)],
      ['', ''],
      ['DETALLE DE COSTOS', ''],
      ['Costos Fijos', formatCLP(data.costs.fixed)],
      ['Costos Variables', formatCLP(data.costs.variable)],
      ['', ''],
      ['PAGOS A PROFESIONALES', ''],
      ...data.professionalPayments.map(p => [
        p.professional,
        `Atenciones: ${p.appointments}`,
        `Ingresos: ${formatCLP(p.totalIncome || 0)}`,
        `Pago: ${formatCLP(p.totalPayment)} · Pendiente: ${formatCLP(p.pendingPayment || 0)} · Tipo: ${p.paymentType}`
      ])
    ]

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen')

    const appointmentsData = [
      ['FECHA', 'PACIENTE', 'PROFESIONAL', 'SERVICIO', 'MONTO', 'ESTADO'],
      ...data.appointments.map(app => [
        new Date(app.fecha).toLocaleDateString(),
        app.paciente_nombre || app.paciente?.nombre || 'Paciente',
        app.profesional_nombre || app.profesional?.nombre || 'Profesional',
        app.tipos_atencion?.nombre || app.tipo_atencion_nombre || app.tipo_atencion,
        formatCLP(app.monto || app.valor_cobrado || 0),
        app.estado || (app.pagado ? 'Pagado' : 'Pendiente')
      ])
    ]

    const appointmentsWs = XLSX.utils.aoa_to_sheet(appointmentsData)
    XLSX.utils.book_append_sheet(wb, appointmentsWs, 'Atenciones')

    const costsData = [
      ['FECHA', 'TIPO', 'CATEGORÍA', 'DESCRIPCIÓN', 'MONTO', 'RECURRENTE'],
      ...data.costsList.map(cost => [
        new Date(cost.fecha).toLocaleDateString(),
        cost.tipo,
        cost.categoria,
        cost.descripcion,
        formatCLP(cost.monto),
        cost.recurrente ? 'Sí' : 'No'
      ])
    ]

    const costsWs = XLSX.utils.aoa_to_sheet(costsData)
    XLSX.utils.book_append_sheet(wb, costsWs, 'Costos')

    const paymentsData = [
      ['PROFESIONAL', 'ESPECIALIDAD', 'ATENCIONES', 'INGRESOS TOTALES', 'PAGO AL PROFESIONAL', 'TIPO DE PAGO'],
      ...data.professionalPayments.map(p => [
        p.professional,
        p.speciality || '-',
        p.appointments,
        p.totalIncome || 0,
        p.totalPayment,
        p.paymentType
      ])
    ]

    const paymentsWs = XLSX.utils.aoa_to_sheet(paymentsData)
    XLSX.utils.book_append_sheet(wb, paymentsWs, 'Pagos Profesionales')

    XLSX.writeFile(wb, `reporte_mensual_${data.month}_${data.year}.xlsx`)
  },

  professionalReport: (
    professional: Profesional,
    appointments: Atencion[],
    month: string,
    year: number,
    totalPayment: number,
    centerName?: string
  ) => {
    const wb = XLSX.utils.book_new()

    const tipoPago = professional.porcentaje_pago > 0 ? 'porcentaje' : 'monto_fijo'
    const valorPago = professional.porcentaje_pago > 0 ? professional.porcentaje_pago : professional.monto_fijo_pago

    const infoData = [
      ['REPORTE PROFESIONAL', ''],
      [centerName || 'Centro Médico', ''],
      [`Período: ${month} ${year}`, ''],
      ['', ''],
      ['INFORMACIÓN DEL PROFESIONAL', ''],
      ['Nombre', professional.nombre],
      ['Especialidad', professional.especialidad],
      ['Tipo de Pago', tipoPago === 'porcentaje' ? 'Porcentaje' : 'Monto Fijo'],
      ['Valor', tipoPago === 'porcentaje' ? `${valorPago}%` : `$${valorPago}`],
      ['', ''],
      ['RESUMEN', ''],
      ['Total Atenciones', appointments.length],
      ['Ingresos Totales', appointments.reduce((sum, app) => sum + (app.valor_cobrado || 0), 0)],
      ['Pago al Profesional', totalPayment]
    ]

    const infoWs = XLSX.utils.aoa_to_sheet(infoData)
    XLSX.utils.book_append_sheet(wb, infoWs, 'Información')

    const appointmentsData = [
      ['FECHA', 'PACIENTE', 'SERVICIO', 'MONTO', 'ESTADO'],
      ...appointments.map(app => [
        new Date(app.fecha).toLocaleDateString(),
        app.paciente_nombre || app.paciente?.nombre || 'Paciente',
        app.tipo_atencion_nombre || app.tipo_atencion,
        app.monto || app.valor_cobrado || 0,
        app.estado || (app.pagado ? 'Pagado' : 'Pendiente')
      ])
    ]

    const appointmentsWs = XLSX.utils.aoa_to_sheet(appointmentsData)
    XLSX.utils.book_append_sheet(wb, appointmentsWs, 'Atenciones')

    XLSX.writeFile(wb, `reporte_profesional_${professional.nombre.replace(/\s+/g, '_')}_${month}_${year}.xlsx`)
  }
}
