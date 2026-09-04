import { useState, useEffect, useMemo } from 'react'
import { FileText, DollarSign, TrendingUp, Users, Printer, Download, SearchX } from 'lucide-react'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { Atencion, Profesional } from '@/types/database'
import { atencionesService, profesionalesService, reportesService, costosService, profesionalComisionesService } from '@/utils/supabase'
import { format as dateFormat, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { exportUtils } from '@/utils/export'
import { formatCLP } from '@/utils/currency'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'

const Reportes = () => {
  const { currentCentro, currentSucursal } = useSucursal()
  const [selectedMonth, setSelectedMonth] = useState(dateFormat(new Date(), 'yyyy-MM'))
  const [selectedProfesional, setSelectedProfesional] = useState<string>('todos')
  const [reporteData, setReporteData] = useState<any>(null)
  const [atenciones, setAtenciones] = useState<Atencion[]>([])
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [comisiones, setComisiones] = useState<any[]>([])
  const [costos, setCostos] = useState<any[]>([])
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

      // Filtrar por profesional si se seleccionó uno específico
      if (selectedProfesional !== 'todos') {
        atencionesMes = atencionesMes.filter(a => a.profesional_id === selectedProfesional)
      }
      
      setReporteData(reporte)
      setAtenciones(atencionesMes)
      setProfesionales(profesionalesData)
      setComisiones(allComisiones)
      setCostos(costosData)
    } catch (error: any) {
      const msg = error?.message || 'Error desconocido'
      toast.error(`Error al cargar datos del reporte: ${msg}`)
      console.error('Error loading report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calcularPagoProfesional = (atencion: Atencion) => {
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
        
        // Sumar solo si no está pagado
        if (!atencion.pagado) {
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

  const professionalPayments = useMemo(() => {
    return atencionesPorProfesional.map(({ profesional, atenciones, total, pagosPendientes }) => ({
      professional: profesional.nombre,
      speciality: profesional.especialidad,
      appointments: atenciones.length,
      totalIncome: atenciones.reduce((sum, atencion) => sum + (atencion.valor_cobrado || 0), 0),
      totalPayment: total,
      pendingPayment: pagosPendientes,
      paymentType: profesional.porcentaje_pago > 0 ? `${profesional.porcentaje_pago}%` : formatCLP(profesional.monto_fijo_pago)
    }))
  }, [atencionesPorProfesional])

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
              valor: item.valor_cobrado,
              pagado: item.pagado ? 'si' : 'no',
              pago_profesional: calcularPagoProfesional(item)
            })),
            `reporte_profesional_${professional.nombre.replace(/\s+/g, '_')}_${monthName}_${year}`
          )
        } else {
          exportUtils.toJSON(
            professionalAppointments.map((item) => ({
              ...item,
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
          fixed: costos.filter(c => c.tipo === 'fijo').reduce((sum, c) => sum + c.monto, 0),
          variable: costos.filter(c => c.tipo === 'variable').reduce((sum, c) => sum + c.monto, 0)
        }
        
        if (format === 'pdf') {
          const { exportToPDF } = heavyExportModule!
          exportToPDF.monthlyReport({
            centerName: currentCentro?.nombre,
            month: monthName,
            year: year,
            totalIncome: reporteData.ingresos_totales,
            totalCosts: reporteData.total_costos,
            totalProfit: reporteData.utilidad_neta,
            professionalPayments,
            costs
          })
        } else if (format === 'excel') {
          const { exportToExcel } = heavyExportModule!
          exportToExcel.monthlyReport({
            centerName: currentCentro?.nombre,
            month: monthName,
            year: year,
            totalIncome: reporteData.ingresos_totales,
            totalCosts: reporteData.total_costos,
            totalProfit: reporteData.utilidad_neta,
            professionalPayments,
            costs,
            appointments: atenciones,
            costsList: costos
          })
        } else if (format === 'csv') {
          exportUtils.toCSV(
            atenciones.map((item) => ({
              fecha: item.fecha,
              hora: item.hora.substring(0, 5),
              paciente: item.paciente?.nombre || '',
              profesional: item.profesional?.nombre || '',
              tipo: item.tipos_atencion?.nombre || item.tipo_atencion || '',
              valor: item.valor_cobrado,
              pagado: item.pagado ? 'si' : 'no',
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Atenciones</p>
                  <p className="text-3xl font-bold text-medical-blue">{selectedProfesional === 'todos' ? reporteData.total_atenciones : atenciones.length}</p>
                </div>
                <div className="bg-medical-blue text-white rounded-full p-3">
                  <FileText className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
                  <p className="text-3xl font-bold text-green-600">
                    {formatCLP(selectedProfesional === 'todos' ? reporteData.ingresos_totales : atenciones.reduce((sum, a) => sum + a.valor_cobrado, 0))}
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
                  <p className="text-sm font-medium text-gray-600">Pagos a Profesionales</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {formatCLP(selectedProfesional === 'todos' ? reporteData.total_pagado_profesionales : atenciones.reduce((sum, a) => sum + calcularPagoProfesional(a), 0))}
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
                  <p className="text-sm font-medium text-gray-600">Utilidad Neta</p>
                  <p className="text-xs text-gray-400 mb-1">
                    {selectedProfesional === 'todos' ? '(Ingresos - Pagos - Costos)' : '(Ingresos - Pago Profesional)'}
                  </p>
                  <p className="text-3xl font-bold text-purple-600">
                    {formatCLP(selectedProfesional === 'todos' ? reporteData.utilidad_neta : 
                      (atenciones.reduce((sum, a) => sum + a.valor_cobrado, 0) - atenciones.reduce((sum, a) => sum + calcularPagoProfesional(a), 0))
                    )}
                  </p>
                </div>
                <div className="bg-purple-600 text-white rounded-full p-3">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>

          {/* Nueva Sección: Desglose de Costos y Actividad (Solo visible en vista general) */}
          {selectedProfesional === 'todos' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 mb-6">
              {/* Costos Operativos */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <DollarSign className="h-5 w-5 mr-2 text-red-500" />
                  Costos Operativos del Mes
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Costos Fijos</p>
                      <p className="text-xs text-gray-500">Alquiler, Servicios, Sueldos fijos</p>
                    </div>
                    <span className="text-lg font-bold text-red-600">
                      {formatCLP(costos.filter(c => c.tipo === 'fijo').reduce((sum, c) => sum + c.monto, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Costos Variables</p>
                      <p className="text-xs text-gray-500">Insumos, Mantenimiento, Extras</p>
                    </div>
                    <span className="text-lg font-bold text-orange-600">
                      {formatCLP(costos.filter(c => c.tipo === 'variable').reduce((sum, c) => sum + c.monto, 0))}
                    </span>
                  </div>
                  <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                    <span className="font-bold text-gray-800">Total Costos Operativos</span>
                    <span className="font-bold text-xl text-gray-900">
                      {formatCLP(reporteData.total_costos || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Resumen por Tipo de Actividad */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-blue-500" />
                  Resumen por Tipo de Actividad
                </h3>
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
                        <span className="font-medium">{formatCLP(atencion.valor_cobrado)}</span>
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
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      atencion.pagado ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {atencion.pagado ? 'Pagado' : 'Pendiente'}
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
                        <p className="font-semibold text-gray-900">{formatCLP(atencion.valor_cobrado)}</p>
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
                      {formatCLP(atencion.valor_cobrado)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      {formatCLP(calcularPagoProfesional(atencion))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        atencion.pagado ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {atencion.pagado ? 'Pagado' : 'Pendiente'}
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
