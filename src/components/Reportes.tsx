import { useState, useEffect, useMemo } from 'react'
import { FileText, DollarSign, TrendingUp, Users, Printer, Download, SearchX, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { Atencion, Profesional, ReporteMensual } from '@/types/database'
import { atencionesService, profesionalesService, reportesService, costosService, profesionalComisionesService } from '@/utils/supabase'
import { format as dateFormat, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { exportUtils } from '@/utils/export'
import { formatCLP } from '@/utils/currency'
import { getFinancialAmount, isBillableAtencion, sumFinancialAmounts } from '@/utils/financial'
import { getEstadoCitaBadgeClass, getEstadoCitaLabel } from '@/utils/atencionEstado'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'

interface AcumuladoMensual {
  month: number
  label: string
  ingresos: number
  aportes: number
  costosOperacionales: number
  costoProfesionales: number
  resultadoFinal: number
  cuentasPorCobrar: number
  acumuladoResultado: number
  acumuladoCobranzaPendiente: number
}

const Reportes = () => {
  const { currentCentro, currentSucursal } = useSucursal()
  const [selectedMonth, setSelectedMonth] = useState(dateFormat(new Date(), 'yyyy-MM'))
  const [selectedProfesional, setSelectedProfesional] = useState<string>('todos')
  const [reporteData, setReporteData] = useState<ReporteMensual | null>(null)
  const [atenciones, setAtenciones] = useState<Atencion[]>([])
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [comisiones, setComisiones] = useState<any[]>([])
  const [costos, setCostos] = useState<any[]>([])
  const [acumuladoMensual, setAcumuladoMensual] = useState<AcumuladoMensual[]>([])
  const [loading, setLoading] = useState(true)
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'excel' | 'csv' | 'json' | null>(null)

  useEffect(() => {
    if (currentSucursal) {
      loadReportData()
    }
  }, [selectedMonth, selectedProfesional, currentSucursal])

  const loadReportData = async () => {
    try {
      setLoading(true)
      
      const [year, month] = selectedMonth.split('-').map(Number)
      const reporte = await reportesService.getReporteMensual(year, month, currentSucursal?.id, currentCentro?.id)
      
      // Obtener atenciones del mes para detalle por profesional
      const lastDay = new Date(year, month, 0).getDate()
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`
      
      const [atencionesData, profesionalesData, costosData] = await Promise.all([
        atencionesService.getByDateRange(startDate, endDate, currentSucursal?.id, currentCentro?.id),
        profesionalesService.getAll(currentSucursal?.id, currentCentro?.id),
        costosService.getByDateRange(startDate, endDate, currentSucursal?.id, currentCentro?.id)
      ])
      
      let atencionesMes = atencionesData
      
      // Cargar comisiones de todos los profesionales cargados
      const comisionesPromises = profesionalesData.map(p => profesionalComisionesService.getAll(p.id))
      const comisionesResults = await Promise.all(comisionesPromises)
      const allComisiones = comisionesResults.flat()

      const reportesAcumulados = selectedProfesional === 'todos'
        ? await Promise.all(
            Array.from({ length: month }, (_, index) =>
              reportesService.getReporteMensual(year, index + 1, currentSucursal?.id, currentCentro?.id)
            )
          )
        : []

      // Filtrar por profesional si se seleccionó uno específico
      if (selectedProfesional !== 'todos') {
        atencionesMes = atencionesMes.filter(a => a.profesional_id === selectedProfesional)
      }

      let acumuladoResultado = 0
      let acumuladoCobranzaPendiente = 0
      const serieAcumulada = reportesAcumulados.map((item, index) => {
        acumuladoResultado += item.resultado_final
        acumuladoCobranzaPendiente += item.saldo_pendiente

        return {
          month: index + 1,
          label: dateFormat(new Date(year, index, 1), 'MMM yyyy', { locale: es }),
          ingresos: item.ingresos_totales,
          aportes: item.total_aportes,
          costosOperacionales: item.costos_operacionales,
          costoProfesionales: item.total_pagado_profesionales,
          resultadoFinal: item.resultado_final,
          cuentasPorCobrar: item.saldo_pendiente,
          acumuladoResultado,
          acumuladoCobranzaPendiente
        }
      })
      
      setReporteData(reporte)
      setAtenciones(atencionesMes)
      setProfesionales(profesionalesData)
      setComisiones(allComisiones)
      setCostos(costosData)
      setAcumuladoMensual(serieAcumulada)
    } catch (error: any) {
      const msg = error?.message || 'Error desconocido'
      toast.error(`Error al cargar datos del reporte: ${msg}`)
      console.error('Error loading report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calcularPagoProfesional = (atencion: Atencion) => {
    if (!isBillableAtencion(atencion)) return 0

    const profesional = profesionales.find(p => p.id === atencion.profesional_id)
    if (!profesional) return 0
    
    // 1. Buscar si hay comisión específica para este tipo de atención
    const comisionEspecifica = comisiones.find(c => 
      c.profesional_id === atencion.profesional_id && 
      c.tipo_atencion_id === atencion.tipo_atencion
    )

    if (comisionEspecifica) {
      const porcentaje = comisionEspecifica.porcentaje ?? 0
      const montoFijo = comisionEspecifica.monto_fijo ?? 0
      return ((atencion.valor_cobrado * porcentaje) / 100) + montoFijo
    }

    // 2. Si no hay específica, usar la general del profesional
    if (profesional.porcentaje_pago > 0) {
      return (atencion.valor_cobrado * profesional.porcentaje_pago) / 100
    } else if (profesional.monto_fijo_pago > 0) {
      return profesional.monto_fijo_pago
    }
    return 0
  }

  const getReporteEstadoLabel = (atencion: Atencion) => {
    if (!isBillableAtencion(atencion)) {
      return getEstadoCitaLabel(atencion.estado_cita)
    }

    return atencion.pagado ? 'Pagado' : 'Pendiente'
  }

  const getReporteEstadoClass = (atencion: Atencion) => {
    if (!isBillableAtencion(atencion)) {
      return getEstadoCitaBadgeClass(atencion.estado_cita)
    }

    return atencion.pagado
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-yellow-100 text-yellow-800 border-yellow-200'
  }

  const atencionesPorProfesional = useMemo(() => {
    const atencionesPorProfesional: { [key: string]: { profesional: Profesional, atenciones: Atencion[], total: number, pagosPendientes: number } } = {}
    
    atenciones.forEach(atencion => {
      const profesional = profesionales.find(p => p.id === atencion.profesional_id)
      if (profesional) {
        if (!atencionesPorProfesional[profesional.id]) {
          atencionesPorProfesional[profesional.id] = {
            profesional,
            atenciones: [],
            total: 0,
            pagosPendientes: 0
          }
        }
        atencionesPorProfesional[profesional.id].atenciones.push(atencion)
        const pagoProfesional = calcularPagoProfesional(atencion)
        atencionesPorProfesional[profesional.id].total += pagoProfesional
        
        if (isBillableAtencion(atencion) && !atencion.pagado) {
          atencionesPorProfesional[profesional.id].pagosPendientes += pagoProfesional
        }
      }
    })
    
    return Object.values(atencionesPorProfesional)
  }, [atenciones, comisiones, profesionales])

  const resumenPorTipoAtencion = useMemo(() => {
    const resumen: { [key: string]: { cantidad: number, total: number } } = {}
    
    atenciones.forEach(atencion => {
      const tipoNombre = atencion.tipos_atencion?.nombre || atencion.tipo_atencion_nombre || 'Sin tipo'
      if (!resumen[tipoNombre]) {
        resumen[tipoNombre] = { cantidad: 0, total: 0 }
      }
      resumen[tipoNombre].cantidad += 1
      resumen[tipoNombre].total += atencion.valor_cobrado
    })
    
    return Object.entries(resumen)
      .map(([tipo, data]) => ({ tipo, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [atenciones])

  const costosOperacionalesMes = useMemo(
    () => costos.filter(c => c.tipo === 'fijo' || c.tipo === 'variable').reduce((sum, c) => sum + c.monto, 0),
    [costos]
  )

  const totalAportesMes = useMemo(
    () => costos.filter(c => c.tipo === 'aporte').reduce((sum, c) => sum + c.monto, 0),
    [costos]
  )

  const costosFijosMes = useMemo(
    () => costos.filter(c => c.tipo === 'fijo').reduce((sum, c) => sum + c.monto, 0),
    [costos]
  )

  const costosVariablesMes = useMemo(
    () => costos.filter(c => c.tipo === 'variable').reduce((sum, c) => sum + c.monto, 0),
    [costos]
  )

  const resumenFinancieroGeneral = useMemo(() => {
    const ingresosAtenciones = reporteData?.ingresos_totales || 0
    const aportes = reporteData?.total_aportes ?? totalAportesMes
    const costosOperacionales = reporteData?.costos_operacionales ?? costosOperacionalesMes
    const costoProfesionales = reporteData?.total_pagado_profesionales || 0
    const totalOperacion = reporteData?.total_operacion ?? (costosOperacionales + costoProfesionales)
    const resultadoFinal = reporteData?.resultado_final ?? (ingresosAtenciones + aportes - totalOperacion)
    const cuentasPorCobrar = reporteData?.saldo_pendiente ?? Math.max(ingresosAtenciones - (reporteData?.ingresos_cobrados || 0), 0)

    return {
      ingresosAtenciones,
      aportes,
      ingresosConAportes: ingresosAtenciones + aportes,
      costosOperacionales,
      costoProfesionales,
      totalOperacion,
      resultadoFinal,
      cuentasPorCobrar
    }
  }, [costosOperacionalesMes, reporteData, totalAportesMes])

  const professionalPayments = useMemo(() => {
    return atencionesPorProfesional.map(({ profesional, atenciones, total, pagosPendientes }) => ({
      professional: profesional.nombre,
      speciality: profesional.especialidad,
      appointments: atenciones.length,
      totalIncome: sumFinancialAmounts(atenciones),
      totalPayment: total,
      pendingPayment: pagosPendientes,
      paymentType: profesional.porcentaje_pago > 0 ? `${profesional.porcentaje_pago}%` : formatCLP(profesional.monto_fijo_pago)
    }))
  }, [atencionesPorProfesional])

  const resumenTendencia = useMemo(() => {
    const ultimoMes = acumuladoMensual[acumuladoMensual.length - 1]
    const mesAnterior = acumuladoMensual[acumuladoMensual.length - 2]

    const cambioResultado = ultimoMes && mesAnterior ? ultimoMes.resultadoFinal - mesAnterior.resultadoFinal : 0
    const cambioCobranza = ultimoMes && mesAnterior ? ultimoMes.cuentasPorCobrar - mesAnterior.cuentasPorCobrar : 0

    const calcularPorcentajeCambio = (actual: number, anterior: number) => {
      if (anterior === 0) {
        if (actual === 0) {
          return null
        }

        return actual > 0 ? 100 : -100
      }

      return ((actual - anterior) / Math.abs(anterior)) * 100
    }

    const obtenerEstado = (valor: number, invertido = false) => {
      if (valor === 0) {
        return {
          etiqueta: 'Sin cambio',
          icono: Minus,
          clases: 'bg-slate-100 text-slate-700'
        }
      }

      const esPositivo = invertido ? valor < 0 : valor > 0
      return {
        etiqueta: esPositivo ? 'Mejorando' : 'Empeorando',
        icono: esPositivo ? ArrowUpRight : ArrowDownRight,
        clases: esPositivo ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
      }
    }

    return {
      ultimoMes,
      cambioResultado,
      cambioCobranza,
      porcentajeResultado: ultimoMes && mesAnterior ? calcularPorcentajeCambio(ultimoMes.resultadoFinal, mesAnterior.resultadoFinal) : null,
      porcentajeCobranza: ultimoMes && mesAnterior ? calcularPorcentajeCambio(ultimoMes.cuentasPorCobrar, mesAnterior.cuentasPorCobrar) : null,
      resultado: obtenerEstado(cambioResultado),
      cobranza: obtenerEstado(cambioCobranza, true)
    }
  }, [acumuladoMensual])

  const handleExport = async (format: 'pdf' | 'excel' | 'csv' | 'json') => {
    try {
      setExportingFormat(format)
      const heavyExportModule =
        format === 'pdf' || format === 'excel'
          ? await import('@/utils/exportHeavy')
          : null

      if (selectedProfesional !== 'todos') {
        // Export individual professional report
        const professional = profesionales.find(p => p.id === selectedProfesional)
        if (!professional) {
          toast.error('Profesional no encontrado')
          return
        }
        
        const professionalAppointments = atenciones.filter(a => a.profesional_id === selectedProfesional)
        const [year, month] = selectedMonth.split('-').map(Number)
        const monthName = dateFormat(new Date(year, month - 1), 'MMMM', { locale: es })
        const paymentSummary = atencionesPorProfesional.find(item => item.profesional.id === selectedProfesional)
        const totalPayment = paymentSummary?.total || 0
        
        if (format === 'pdf') {
          const { exportToPDF } = heavyExportModule!
          exportToPDF.professionalReport(professional, professionalAppointments, monthName, year, totalPayment, currentCentro?.nombre)
        } else if (format === 'excel') {
          const { exportToExcel } = heavyExportModule!
          exportToExcel.professionalReport(professional, professionalAppointments, monthName, year, totalPayment, currentCentro?.nombre)
        } else if (format === 'csv') {
          exportUtils.toCSV(
            professionalAppointments.map((item) => ({
              fecha: item.fecha,
              hora: item.hora.substring(0, 5),
              paciente: item.paciente?.nombre || '',
              tipo: item.tipos_atencion?.nombre || item.tipo_atencion || '',
              valor: getFinancialAmount(item),
              estado_cita: getEstadoCitaLabel(item.estado_cita),
              estado_cobro: getReporteEstadoLabel(item),
              pagado: isBillableAtencion(item) && item.pagado ? 'si' : 'no',
              pago_profesional: calcularPagoProfesional(item)
            })),
            `reporte_profesional_${professional.nombre.replace(/\s+/g, '_')}_${monthName}_${year}`
          )
        } else {
          exportUtils.toJSON(
            professionalAppointments.map((item) => ({
              ...item,
              estado_cita_label: getEstadoCitaLabel(item.estado_cita),
              estado_cobro: getReporteEstadoLabel(item),
              valor_reportable: getFinancialAmount(item),
              pago_profesional: calcularPagoProfesional(item)
            })),
            `reporte_profesional_${professional.nombre.replace(/\s+/g, '_')}_${monthName}_${year}`
          )
        }
        
        toast.success(`Reporte de ${professional.nombre} exportado exitosamente`)
      } else {
        // Export monthly report
        if (!reporteData) {
          toast.error('No hay datos para exportar')
          return
        }
        
        const [year, month] = selectedMonth.split('-').map(Number)
        const monthName = dateFormat(new Date(year, month - 1), 'MMMM', { locale: es })
        
        const costs = {
          fixed: costosFijosMes,
          variable: costosVariablesMes,
          contributions: totalAportesMes
        }
        
        if (format === 'pdf') {
          const { exportToPDF } = heavyExportModule!
          exportToPDF.monthlyReport({
            centerName: currentCentro?.nombre,
            month: monthName,
            year: year,
            totalIncome: resumenFinancieroGeneral.ingresosAtenciones,
            totalContributions: resumenFinancieroGeneral.aportes,
            totalIncomeWithContributions: resumenFinancieroGeneral.ingresosConAportes,
            totalOperationalCosts: resumenFinancieroGeneral.costosOperacionales,
            totalProfessionalCosts: resumenFinancieroGeneral.costoProfesionales,
            totalOperation: resumenFinancieroGeneral.totalOperacion,
            totalProfit: resumenFinancieroGeneral.resultadoFinal,
            totalPendingReceivables: resumenFinancieroGeneral.cuentasPorCobrar,
            professionalPayments,
            costs
          })
        } else if (format === 'excel') {
          const { exportToExcel } = heavyExportModule!
          exportToExcel.monthlyReport({
            centerName: currentCentro?.nombre,
            month: monthName,
            year: year,
            totalIncome: resumenFinancieroGeneral.ingresosAtenciones,
            totalContributions: resumenFinancieroGeneral.aportes,
            totalIncomeWithContributions: resumenFinancieroGeneral.ingresosConAportes,
            totalOperationalCosts: resumenFinancieroGeneral.costosOperacionales,
            totalProfessionalCosts: resumenFinancieroGeneral.costoProfesionales,
            totalOperation: resumenFinancieroGeneral.totalOperacion,
            totalProfit: resumenFinancieroGeneral.resultadoFinal,
            totalPendingReceivables: resumenFinancieroGeneral.cuentasPorCobrar,
            professionalPayments,
            costs,
            appointments: atenciones,
            costsList: costos,
            accumulatedRows: acumuladoMensual
          })
        } else if (format === 'csv') {
          exportUtils.toCSV(
            atenciones.map((item) => ({
              fecha: item.fecha,
              hora: item.hora.substring(0, 5),
              paciente: item.paciente?.nombre || '',
              profesional: item.profesional?.nombre || '',
              tipo: item.tipos_atencion?.nombre || item.tipo_atencion || '',
              valor: getFinancialAmount(item),
              estado_cita: getEstadoCitaLabel(item.estado_cita),
              estado_cobro: getReporteEstadoLabel(item),
              pagado: isBillableAtencion(item) && item.pagado ? 'si' : 'no',
              pago_profesional: calcularPagoProfesional(item)
            })),
            `reporte_mensual_${monthName}_${year}`
          )
        } else {
          exportUtils.toJSON(
            {
              centro: currentCentro?.nombre || null,
              mes: monthName,
              anio: year,
              resumen: reporteData,
              resumen_financiero: resumenFinancieroGeneral,
              acumulado_mensual: acumuladoMensual,
              pagos_profesionales: professionalPayments,
              costos,
              atenciones
            },
            `reporte_mensual_${monthName}_${year}`
          )
        }
        
        toast.success(`Reporte mensual exportado exitosamente`)
      }
    } catch (error) {
      console.error('Error exporting report:', error)
      toast.error('Error al exportar el reporte')
    } finally {
      setExportingFormat(null)
    }
  }

  if (loading) {
    return <PageLoader label="Generando reporte del período..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Reportes Financieros</h1>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:space-x-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-2">
            <label className="text-sm font-medium text-gray-700">Profesional:</label>
            <select
              value={selectedProfesional}
              onChange={(e) => setSelectedProfesional(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
            >
              <option value="todos">Todos los profesionales</option>
              {profesionales.map(profesional => (
                <option key={profesional.id} value={profesional.id}>
                  {profesional.nombre} - {profesional.especialidad}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-2">
            <label className="text-sm font-medium text-gray-700">Mes:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
            />
          </div>
          {selectedProfesional === 'todos' && reporteData && (
            <div className="flex flex-wrap gap-2">
              {['pdf', 'excel', 'csv', 'json'].map((type) => (
                <button
                  key={type}
                  onClick={() => handleExport(type as 'pdf' | 'excel' | 'csv' | 'json')}
                  disabled={exportingFormat !== null}
                  className={`px-3 py-2 rounded-md flex items-center space-x-1 text-sm text-white ${
                    type === 'pdf'
                      ? 'bg-red-600 hover:bg-red-700'
                      : type === 'excel'
                      ? 'bg-green-600 hover:bg-green-700'
                      : type === 'csv'
                      ? 'bg-slate-700 hover:bg-slate-800'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <Download className="h-4 w-4" />
                  <span>{exportingFormat === type ? 'Procesando...' : type.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resumen financiero */}
      {reporteData && (
        <div className={selectedProfesional !== 'todos' ? 'print-section' : ''}>
          {selectedProfesional !== 'todos' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-blue-800">
                    Reporte de {profesionales.find(p => p.id === selectedProfesional)?.nombre}
                  </h3>
                  <p className="text-blue-600">
                    {profesionales.find(p => p.id === selectedProfesional)?.especialidad}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-800">
                    {formatCLP(atencionesPorProfesional.find(item => item.profesional.id === selectedProfesional)?.total || 0)}
                  </p>
                  <p className="text-blue-600 text-sm">Total a pagar</p>
                </div>
              </div>
            </div>
          )}

          {selectedProfesional === 'todos' ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-lg bg-white p-6 shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Ingresos por atenciones</p>
                      <p className="text-3xl font-bold text-green-600">{formatCLP(resumenFinancieroGeneral.ingresosAtenciones)}</p>
                    </div>
                    <div className="rounded-full bg-green-600 p-3 text-white">
                      <DollarSign className="h-6 w-6" />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Aportes</p>
                      <p className="text-3xl font-bold text-cyan-600">{formatCLP(resumenFinancieroGeneral.aportes)}</p>
                    </div>
                    <div className="rounded-full bg-cyan-600 p-3 text-white">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Ingresos + aportes</p>
                      <p className="text-3xl font-bold text-blue-600">{formatCLP(resumenFinancieroGeneral.ingresosConAportes)}</p>
                    </div>
                    <div className="rounded-full bg-blue-600 p-3 text-white">
                      <FileText className="h-6 w-6" />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Costos operacionales</p>
                      <p className="text-3xl font-bold text-red-600">{formatCLP(resumenFinancieroGeneral.costosOperacionales)}</p>
                    </div>
                    <div className="rounded-full bg-red-600 p-3 text-white">
                      <DollarSign className="h-6 w-6" />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Costo de profesionales</p>
                      <p className="text-3xl font-bold text-orange-600">{formatCLP(resumenFinancieroGeneral.costoProfesionales)}</p>
                    </div>
                    <div className="rounded-full bg-orange-600 p-3 text-white">
                      <Users className="h-6 w-6" />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Resultado final</p>
                      <p className={`text-3xl font-bold ${resumenFinancieroGeneral.resultadoFinal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCLP(resumenFinancieroGeneral.resultadoFinal)}
                      </p>
                    </div>
                    <div className={`rounded-full p-3 text-white ${resumenFinancieroGeneral.resultadoFinal >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                      <TrendingUp className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="rounded-lg bg-white p-6 shadow-md xl:col-span-2">
                  <h3 className="mb-4 text-lg font-semibold text-gray-800">Resumen del período</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-700">Ingresos por atenciones</p>
                        <p className="text-xs text-gray-500">Total facturado en el mes</p>
                      </div>
                      <span className="font-semibold text-slate-900">{formatCLP(resumenFinancieroGeneral.ingresosAtenciones)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-cyan-50 px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-700">Aportes</p>
                        <p className="text-xs text-gray-500">Ingresos adicionales registrados en costos como aporte</p>
                      </div>
                      <span className="font-semibold text-cyan-700">+ {formatCLP(resumenFinancieroGeneral.aportes)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-700">Costos operacionales</p>
                        <p className="text-xs text-gray-500">Arriendo, luz, agua, insumos y otros costos del mes</p>
                      </div>
                      <span className="font-semibold text-red-700">- {formatCLP(resumenFinancieroGeneral.costosOperacionales)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-orange-50 px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-700">Costo de profesionales</p>
                        <p className="text-xs text-gray-500">Monto a pagar por sesiones realizadas</p>
                      </div>
                      <span className="font-semibold text-orange-700">- {formatCLP(resumenFinancieroGeneral.costoProfesionales)}</span>
                    </div>
                    <div className="grid gap-3 border-t border-gray-200 pt-4 md:grid-cols-2">
                      <div className="rounded-lg bg-blue-50 px-4 py-3">
                        <p className="text-sm font-medium text-blue-800">Costo total de operación</p>
                        <p className="mt-1 text-2xl font-bold text-blue-900">{formatCLP(resumenFinancieroGeneral.totalOperacion)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-900 px-4 py-3 text-white">
                        <p className="text-sm font-medium text-slate-200">Resultado final del mes</p>
                        <p className="mt-1 text-2xl font-bold">{formatCLP(resumenFinancieroGeneral.resultadoFinal)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-md">
                  <h3 className="mb-4 text-lg font-semibold text-gray-800">Control de cobranza</h3>
                  <div className="space-y-4">
                    <div className="rounded-lg bg-amber-50 px-4 py-3">
                      <p className="text-sm font-medium text-amber-800">Cuentas por cobrar del mes</p>
                      <p className="mt-1 text-2xl font-bold text-amber-900">{formatCLP(resumenFinancieroGeneral.cuentasPorCobrar)}</p>
                      <p className="mt-1 text-xs text-amber-700">Corresponde a sesiones registradas pero todavía no marcadas como pagadas.</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-4 py-3">
                      <p className="text-sm font-medium text-slate-700">Total atenciones</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{reporteData.total_atenciones}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-4 py-3">
                      <p className="text-sm font-medium text-emerald-800">Ingresos cobrados</p>
                      <p className="mt-1 text-2xl font-bold text-emerald-900">{formatCLP(reporteData.ingresos_cobrados)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-lg bg-white p-6 shadow-md">
                  <h3 className="mb-4 text-lg font-semibold text-gray-800">Desglose de costos operacionales</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center rounded-lg bg-red-50 p-3">
                      <div>
                        <p className="font-medium text-gray-700">Costos fijos</p>
                        <p className="text-xs text-gray-500">Arriendo, servicios base y otros costos regulares</p>
                      </div>
                      <span className="text-lg font-bold text-red-600">{formatCLP(costosFijosMes)}</span>
                    </div>
                    <div className="flex justify-between items-center rounded-lg bg-orange-50 p-3">
                      <div>
                        <p className="font-medium text-gray-700">Costos variables</p>
                        <p className="text-xs text-gray-500">Insumos, mantenciones, compras y extras</p>
                      </div>
                      <span className="text-lg font-bold text-orange-600">{formatCLP(costosVariablesMes)}</span>
                    </div>
                    <div className="flex justify-between items-center rounded-lg bg-cyan-50 p-3">
                      <div>
                        <p className="font-medium text-gray-700">Aportes registrados</p>
                        <p className="text-xs text-gray-500">Se muestran separados porque son ingresos adicionales</p>
                      </div>
                      <span className="text-lg font-bold text-cyan-700">{formatCLP(totalAportesMes)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-md">
                  <h3 className="mb-4 text-lg font-semibold text-gray-800">Resumen por tipo de actividad</h3>
                  <div className="space-y-3 overflow-y-auto max-h-64">
                    {resumenPorTipoAtencion.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border-b border-gray-100 last:border-0">
                        <div className="flex items-center">
                          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full mr-3">
                            {item.cantidad}
                          </span>
                          <span className="text-gray-700 font-medium">{item.tipo}</span>
                        </div>
                        <span className="font-bold text-gray-900">{formatCLP(item.total)}</span>
                      </div>
                    ))}
                    {resumenPorTipoAtencion.length === 0 && (
                      <p className="text-center text-gray-500 py-4">No hay actividades registradas</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-lg bg-white p-6 shadow-md">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Acumulado del año</h3>
                    <p className="text-sm text-gray-500">Suma mes a mes del resultado final y de las cuentas por cobrar para detectar si el negocio mejora o si la deuda va creciendo.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Acumulado resultado</p>
                      <p className={`mt-1 text-xl font-bold ${((acumuladoMensual[acumuladoMensual.length - 1]?.acumuladoResultado) || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCLP(acumuladoMensual[acumuladoMensual.length - 1]?.acumuladoResultado || 0)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-amber-50 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Acumulado por cobrar</p>
                      <p className="mt-1 text-xl font-bold text-amber-900">
                        {formatCLP(acumuladoMensual[acumuladoMensual.length - 1]?.acumuladoCobranzaPendiente || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tendencia resultado</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-600">
                          {resumenTendencia.ultimoMes ? `Comparado con ${resumenTendencia.ultimoMes.label}` : 'Aun no hay comparación'}
                        </p>
                        <p className={`mt-1 text-2xl font-bold ${resumenTendencia.cambioResultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatCLP(resumenTendencia.cambioResultado)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {resumenTendencia.porcentajeResultado === null
                            ? 'Sin base porcentual'
                            : `${resumenTendencia.porcentajeResultado >= 0 ? '+' : ''}${resumenTendencia.porcentajeResultado.toFixed(1)}% vs mes anterior`}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${resumenTendencia.resultado.clases}`}>
                        <resumenTendencia.resultado.icono className="h-4 w-4" />
                        {resumenTendencia.resultado.etiqueta}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Tendencia cuentas por cobrar</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-amber-800">Cambio del mes seleccionado frente al anterior</p>
                        <p className={`mt-1 text-2xl font-bold ${resumenTendencia.cambioCobranza <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatCLP(resumenTendencia.cambioCobranza)}
                        </p>
                        <p className="mt-1 text-xs text-amber-700">
                          {resumenTendencia.porcentajeCobranza === null
                            ? 'Sin base porcentual'
                            : `${resumenTendencia.porcentajeCobranza >= 0 ? '+' : ''}${resumenTendencia.porcentajeCobranza.toFixed(1)}% vs mes anterior`}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${resumenTendencia.cobranza.clases}`}>
                        <resumenTendencia.cobranza.icono className="h-4 w-4" />
                        {resumenTendencia.cobranza.etiqueta}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Lectura rápida</p>
                    <div className="mt-3 space-y-2 text-sm text-blue-900">
                      <p>
                        Resultado acumulado:
                        <span className={`ml-2 font-semibold ${((acumuladoMensual[acumuladoMensual.length - 1]?.acumuladoResultado) || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {((acumuladoMensual[acumuladoMensual.length - 1]?.acumuladoResultado) || 0) >= 0 ? 'positivo' : 'negativo'}
                        </span>
                      </p>
                      <p>
                        Deuda acumulada:
                        <span className="ml-2 font-semibold text-amber-800">
                          {((acumuladoMensual[acumuladoMensual.length - 1]?.acumuladoCobranzaPendiente) || 0) > 0 ? 'hay sesiones pendientes de cobro' : 'sin deuda pendiente'}
                        </span>
                      </p>
                      <p className="text-xs text-blue-700">
                        Esta separación evita mezclar pérdida operacional con dinero aún no cobrado.
                      </p>
                    </div>
                  </div>
                </div>

                {acumuladoMensual.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="Sin acumulado disponible"
                    description="Selecciona un período general para revisar el avance financiero del año."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Mes</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Ingresos</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Aportes</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Costos operacionales</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Profesionales</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Resultado mes</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Acumulado</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Por cobrar mes</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Por cobrar acumulado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {acumuladoMensual.map((item) => (
                          <tr key={item.month}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.label}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{formatCLP(item.ingresos)}</td>
                            <td className="px-4 py-3 text-sm text-cyan-700">{formatCLP(item.aportes)}</td>
                            <td className="px-4 py-3 text-sm text-red-700">{formatCLP(item.costosOperacionales)}</td>
                            <td className="px-4 py-3 text-sm text-orange-700">{formatCLP(item.costoProfesionales)}</td>
                            <td className={`px-4 py-3 text-sm font-semibold ${item.resultadoFinal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {formatCLP(item.resultadoFinal)}
                            </td>
                            <td className={`px-4 py-3 text-sm font-semibold ${item.acumuladoResultado >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {formatCLP(item.acumuladoResultado)}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-amber-700">{formatCLP(item.cuentasPorCobrar)}</td>
                            <td className="px-4 py-3 text-sm font-medium text-amber-800">{formatCLP(item.acumuladoCobranzaPendiente)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total atenciones</p>
                    <p className="text-3xl font-bold text-medical-blue">{atenciones.length}</p>
                  </div>
                  <div className="bg-medical-blue text-white rounded-full p-3">
                    <FileText className="h-6 w-6" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Ingresos generados</p>
                    <p className="text-3xl font-bold text-green-600">
                      {formatCLP(sumFinancialAmounts(atenciones))}
                    </p>
                  </div>
                  <div className="bg-green-600 text-white rounded-full p-3">
                    <DollarSign className="h-6 w-6" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Costo profesional</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {formatCLP(atenciones.reduce((sum, a) => sum + calcularPagoProfesional(a), 0))}
                    </p>
                  </div>
                  <div className="bg-orange-600 text-white rounded-full p-3">
                    <Users className="h-6 w-6" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Resultado profesional</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {formatCLP(
                        sumFinancialAmounts(atenciones) -
                          atenciones.reduce((sum, a) => sum + calcularPagoProfesional(a), 0)
                      )}
                    </p>
                  </div>
                  <div className="bg-purple-600 text-white rounded-full p-3">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detalle por profesional */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-xl font-semibold text-gray-800">
            {selectedProfesional === 'todos' ? 'Detalle por Profesional' : 'Detalle de Atenciones'}
          </h2>
          {selectedProfesional !== 'todos' && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => window.print()}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm flex items-center space-x-1"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir</span>
              </button>
              {['pdf', 'excel', 'csv', 'json'].map((type) => (
                <button
                  key={type}
                  onClick={() => handleExport(type as 'pdf' | 'excel' | 'csv' | 'json')}
                  disabled={exportingFormat !== null}
                  className={`px-3 py-1 rounded text-sm flex items-center space-x-1 text-white ${
                    type === 'pdf'
                      ? 'bg-red-600 hover:bg-red-700'
                      : type === 'excel'
                      ? 'bg-green-600 hover:bg-green-700'
                      : type === 'csv'
                      ? 'bg-slate-700 hover:bg-slate-800'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <Download className="h-4 w-4" />
                  <span>{exportingFormat === type ? 'Procesando...' : type.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {atencionesPorProfesional.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin atenciones para este período"
            description="Cambia el mes o el profesional para revisar actividad y pagos del período."
          />
        ) : (
          <div className="space-y-4">
            {atencionesPorProfesional.map(({ profesional, atenciones, total, pagosPendientes }) => (
              <div key={profesional.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">{profesional.nombre}</h3>
                    <p className="text-sm text-gray-600">{profesional.especialidad}</p>
                    <p className="text-sm text-gray-500">
                      {atenciones.length} atenciones - Pago: {profesional.porcentaje_pago > 0 ? `${profesional.porcentaje_pago}%` : `$${profesional.monto_fijo_pago}`}
                    </p>
                    {pagosPendientes > 0 && (
                      <p className="text-sm text-orange-600 font-medium">
                        {formatCLP(pagosPendientes)} en pagos pendientes
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">{formatCLP(total)}</p>
                    <p className="text-sm text-gray-500">Total a pagar</p>
                    {pagosPendientes > 0 && (
                      <p className="text-sm text-orange-600 font-medium">
                        {formatCLP(pagosPendientes)} pendiente
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {atenciones.slice(0, 3).map(atencion => (
                    <div key={atencion.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{atencion.paciente?.nombre}</span>
                        <span className="text-gray-500 ml-2">
                          {dateFormat(parseISO(atencion.fecha), 'dd/MM/yyyy')} {atencion.hora}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{formatCLP(getFinancialAmount(atencion))}</span>
                        <span className="text-green-600 ml-2">
                          ({formatCLP(calcularPagoProfesional(atencion))})
                        </span>
                      </div>
                    </div>
                  ))}
                  {atenciones.length > 3 && (
                    <div className="text-center text-sm text-gray-500 py-2">
                      Ver {atenciones.length - 3} atenciones más...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lista de atenciones del mes */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Todas las Atenciones - {(() => {
            const [year, month] = selectedMonth.split('-').map(Number)
            return dateFormat(new Date(year, month - 1), 'MMMM yyyy', { locale: es })
          })()}
        </h2>
        
        {atenciones.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Sin atenciones en este mes"
              description="No hay registros para el período seleccionado con los filtros actuales."
            />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {atenciones.map(atencion => (
                <div key={atencion.id} className="rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {dateFormat(parseISO(atencion.fecha), 'dd/MM/yyyy')} {atencion.hora}
                      </p>
                      <p className="text-sm text-gray-700">{atencion.paciente?.nombre || 'Sin paciente'}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getReporteEstadoClass(atencion)}`}>
                      {getReporteEstadoLabel(atencion)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Profesional</p>
                      <p>{atencion.profesional?.nombre || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Tipo</p>
                      <p>{atencion.tipos_atencion?.nombre || atencion.tipo_atencion_nombre || 'Sin tipo'}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Valor</p>
                        <p className="font-semibold text-gray-900">{formatCLP(getFinancialAmount(atencion))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Pago profesional</p>
                        <p className="font-semibold text-green-600">{formatCLP(calcularPagoProfesional(atencion))}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paciente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Profesional
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pago Prof.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {atenciones.map(atencion => (
                  <tr key={atencion.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {dateFormat(parseISO(atencion.fecha), 'dd/MM/yyyy')} {atencion.hora}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {atencion.paciente?.nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {atencion.profesional?.nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {atencion.tipos_atencion?.nombre || atencion.tipo_atencion_nombre || 'Sin tipo'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCLP(getFinancialAmount(atencion))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      {formatCLP(calcularPagoProfesional(atencion))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getReporteEstadoClass(atencion)}`}>
                        {getReporteEstadoLabel(atencion)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Reportes
