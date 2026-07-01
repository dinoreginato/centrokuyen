import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserPlus, Calendar, DollarSign, TrendingUp, Activity, BarChart3, Bell, Wallet, CreditCard, PiggyBank, LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useSucursal } from '@/contexts/SucursalContext'
import { profesionalesService, pacientesService, atencionesService, profesionalComisionesService, reportesService } from '@/utils/supabase'
import { format as dateFormat, startOfMonth, endOfMonth, parseISO, addDays, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import DashboardCharts from './DashboardCharts'
import { autoNotificationService, notificationService } from '@/utils/notifications'
import { formatCLP } from '@/utils/currency'
import { isActiveClinicalAtencion, isBillableAtencion, sumFinancialAmounts } from '@/utils/financial'

interface DashboardStatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconClassName: string
  valueClassName: string
  subtitle?: string
  to?: string
}

const DashboardStatCard = ({
  title,
  value,
  icon: Icon,
  iconClassName,
  valueClassName,
  subtitle,
  to
}: DashboardStatCardProps) => {
  const cardContent = (
    <div className="h-full rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="min-h-[44px] text-sm font-semibold leading-5 text-gray-600">
              {title}
            </p>
          </div>
          <div className={`shrink-0 rounded-full p-3 ${iconClassName}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-auto">
          <p className={`text-[clamp(1.55rem,2.15vw,2.45rem)] font-bold leading-tight tracking-tight tabular-nums break-words ${valueClassName}`}>
            {value}
          </p>
          {subtitle && (
            <p className="mt-3 text-xs leading-4 text-gray-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  )

  if (to) {
    return <Link to={to} className="block h-full">{cardContent}</Link>
  }

  return cardContent
}

const Dashboard = () => {
  const { user } = useAuth()
  const { currentSucursal } = useSucursal()
  const [stats, setStats] = useState({
    totalProfesionales: 0,
    totalPacientes: 0,
    totalAtencionesMes: 0,
    ingresosMes: 0,
    ingresosCobradosMes: 0,
    ingresosPendientesMes: 0,
    ingresosProyectadosMes: 0,
    pagosProfesionalesMes: 0,
    costosOperativosMes: 0,
    costosMes: 0,
    utilidadMes: 0,
    margenMes: 0,
    citasCanceladasMes: 0,
    atencionesPendientes: 0,
    proximasAtenciones: [] as any[]
  })
  const [selectedMonth, setSelectedMonth] = useState(dateFormat(new Date(), 'yyyy-MM'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
    checkNotifications()
    return () => {
      autoNotificationService.stop()
    }
  }, [currentSucursal, selectedMonth])
  
  const checkNotifications = async () => {
    try {
      const today = new Date()
      const startWindow = subDays(today, 45)
      const nextWeek = addDays(today, 7)
      
      const startDate = startWindow.toISOString().split('T')[0]
      const endDate = nextWeek.toISOString().split('T')[0]
      
      const appointments = await atencionesService.getByDateRange(startDate, endDate, currentSucursal?.id)
      
      // Filter notifications for professional
      const filteredAppointments = (user?.rol === 'profesional' && user.profesional_id)
        ? appointments.filter(a => a.profesional_id === user.profesional_id)
        : appointments

      autoNotificationService.start(filteredAppointments)
    } catch (error) {
      console.error('Error starting notification service:', error)
    }
  }

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      const [year, month] = selectedMonth.split('-').map(Number)
      const currentDate = new Date(year, month - 1, 1)
      const startOfCurrentMonth = startOfMonth(currentDate)
      const endOfCurrentMonth = endOfMonth(currentDate)
      
      const [profesionales, pacientes, atenciones] = await Promise.all([
        profesionalesService.getAll(currentSucursal?.id),
        pacientesService.getAll(currentSucursal?.id),
        atencionesService.getAll(currentSucursal?.id)
      ])

      // Determine filters based on role
      const isProfesional = user?.rol === 'profesional' && user.profesional_id
      
      let filteredAtenciones = atenciones
      if (isProfesional) {
        filteredAtenciones = atenciones.filter(a => a.profesional_id === user.profesional_id)
      }

      // 1. Total Profesionales / Atenciones Históricas
      // If Admin: Total Profesionales
      // If Profesional: Total Historical Appointments (or maybe "Mis Atenciones Totales")
      let metric1Value = profesionales.length
      
      if (isProfesional) {
         metric1Value = filteredAtenciones.length
      }

      // 2. Total Pacientes
      // If Admin: Total Pacientes in DB
      // If Profesional: Unique patients seen by me
      let metric2Value = pacientes.length
      
      if (isProfesional) {
        const uniquePatients = new Set(filteredAtenciones.map(a => a.paciente_id))
        metric2Value = uniquePatients.size
      }

      // 3. Atenciones Este Mes (Todas, pagadas o no, para estadísticas de cantidad)
      const atencionesMes = filteredAtenciones.filter(atencion => {
        const atencionDate = parseISO(atencion.fecha)
        return atencionDate >= startOfCurrentMonth && atencionDate <= endOfCurrentMonth
      })

      const atencionesMesActivas = atencionesMes.filter(isActiveClinicalAtencion)
      const atencionesMesFacturables = atencionesMesActivas.filter(isBillableAtencion)
      const citasCanceladasMes = atencionesMes.filter(a => !a.es_bloqueo && a.estado_cita === 'cancelada').length

      // 4. Ingresos Este Mes / Mis Ganancias (SOLO PAGADAS)
      let ingresosMes = 0
      let ingresosCobradosMes = 0
      let ingresosPendientesMes = 0
      let ingresosProyectadosMes = 0
      let pagosProfesionalesMes = 0
      let costosOperativosMes = 0
      let costosMes = 0
      let utilidadMes = 0
      let margenMes = 0

      // Filtramos solo las pagadas para el cálculo de dinero
      const atencionesPagadasMes = atencionesMesFacturables.filter(a => a.pagado)
      const atencionesPendientesMesList = atencionesMesFacturables.filter(a => !a.pagado)

      ingresosPendientesMes = sumFinancialAmounts(atencionesPendientesMesList)
      ingresosProyectadosMes = sumFinancialAmounts(atencionesMesFacturables)
      ingresosCobradosMes = sumFinancialAmounts(atencionesPagadasMes)

      if (isProfesional && user?.profesional_id) {
        const pid = user.profesional_id
        const profesionalActual = profesionales.find(p => p.id === pid)
        if (profesionalActual) {
          const comisiones = await profesionalComisionesService.getAll(pid)

          const calcularGananciaProfesional = (atencionesPagadas: typeof filteredAtenciones) => {
            return atencionesPagadas.reduce((total, atencion) => {
            const comisionEspecifica = comisiones.find(c => c.tipo_atencion_id === atencion.tipo_atencion)
            const porcentaje = comisionEspecifica?.porcentaje ?? profesionalActual.porcentaje_pago ?? 0
            const montoFijo = comisionEspecifica?.monto_fijo ?? profesionalActual.monto_fijo_pago ?? 0
            const pagoPorcentaje = (atencion.valor_cobrado * porcentaje) / 100
            return total + pagoPorcentaje + montoFijo
            }, 0)
          }

          ingresosMes = calcularGananciaProfesional(atencionesPagadasMes)
        }
        utilidadMes = ingresosMes
        margenMes = ingresosProyectadosMes > 0 ? (ingresosMes / ingresosProyectadosMes) * 100 : 0
      } else {
        // Para admin, mostramos un flujo simple: ingresos -> costos -> utilidad
        const reporteMensual = await reportesService.getReporteMensual(year, month, currentSucursal?.id)
        ingresosMes = reporteMensual.ingresos_totales
        ingresosCobradosMes = reporteMensual.ingresos_cobrados
        ingresosPendientesMes = Math.max(ingresosMes - ingresosCobradosMes, 0)
        ingresosProyectadosMes = reporteMensual.ingresos_totales
        pagosProfesionalesMes = reporteMensual.total_pagado_profesionales
        costosOperativosMes = reporteMensual.total_costos
        costosMes = pagosProfesionalesMes + costosOperativosMes
        utilidadMes = ingresosMes - costosMes
        margenMes = ingresosMes > 0 ? (utilidadMes / ingresosMes) * 100 : 0
      }

      // 5. Atenciones Pendientes (filtered)
      const atencionesPendientes = filteredAtenciones.filter(
        a => isBillableAtencion(a) && !a.pagado && a.estado_asistencia !== 'no_asistio'
      ).length

      // 6. Próximas Atenciones (filtered)
      const proximosDias = new Date()
      proximosDias.setDate(proximosDias.getDate() + 7)
      
      const proximasAtenciones = filteredAtenciones
        .filter(atencion => {
          const atencionDate = parseISO(atencion.fecha)
          return !atencion.es_bloqueo && atencion.estado_cita !== 'cancelada' && atencionDate >= new Date() && atencionDate <= proximosDias
        })
        .sort((a, b) => new Date(`${a.fecha}T${a.hora}`).getTime() - new Date(`${b.fecha}T${b.hora}`).getTime())
        .slice(0, 5)

      setStats({
        totalProfesionales: metric1Value,
        totalPacientes: metric2Value,
        totalAtencionesMes: atencionesMesActivas.length,
        ingresosMes,
        ingresosCobradosMes,
        ingresosPendientesMes,
        ingresosProyectadosMes,
        pagosProfesionalesMes,
        costosOperativosMes,
        costosMes,
        utilidadMes,
        margenMes,
        citasCanceladasMes,
        atencionesPendientes,
        proximasAtenciones
      })
    } catch (error) {
      toast.error('Error al cargar datos del dashboard')
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
      </div>
    )
  }

  const isProfesional = user?.rol === 'profesional'
  const esProfesionalEnRengo = isProfesional && currentSucursal?.nombre?.toLowerCase().includes('rengo')
  const isDalcahue = currentSucursal?.nombre?.toLowerCase().includes('dalcahue')
  const canManagePacientes = !isProfesional || (isProfesional && isDalcahue)
  const professionalIncomeTitle = esProfesionalEnRengo ? 'Mis Ganancias del Mes' : 'Mis Ganancias Cobradas'
  const professionalIncomeSubtitle = esProfesionalEnRengo
    ? 'Total del mes seleccionado'
    : undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard Principal</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-medical-blue focus:border-transparent"
          />
          <div className="hidden rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 shadow-sm sm:block">
            {dateFormat(new Date(), 'EEEE d MMMM yyyy', { locale: es })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 items-stretch sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          to={isProfesional ? "/agenda" : "/profesionales"}
          title={isProfesional ? 'Total Atenciones' : 'Total Profesionales'}
          value={stats.totalProfesionales}
          icon={Users}
          iconClassName="bg-medical-blue text-white"
          valueClassName="text-medical-blue"
        />

        <DashboardStatCard
          to={isProfesional ? "/agenda" : "/pacientes"}
          title={isProfesional ? 'Mis Pacientes' : 'Total Pacientes'}
          value={stats.totalPacientes}
          icon={UserPlus}
          iconClassName="bg-medical-green text-white"
          valueClassName="text-medical-green"
        />

        <DashboardStatCard
          to="/agenda"
          title={isProfesional ? 'Mis Atenciones (Mes)' : 'Atenciones Este Mes'}
          value={stats.totalAtencionesMes}
          icon={Calendar}
          iconClassName="bg-orange-600 text-white"
          valueClassName="text-orange-600"
        />

        <DashboardStatCard
          title={isProfesional ? professionalIncomeTitle : 'Ingresos del Mes'}
          value={formatCLP(stats.ingresosMes)}
          icon={DollarSign}
          iconClassName="bg-purple-600 text-white"
          valueClassName="text-purple-600"
          subtitle={isProfesional ? professionalIncomeSubtitle : `Cobrado: ${formatCLP(stats.ingresosCobradosMes)}`}
        />
      </div>

      {!esProfesionalEnRengo && (
        <div className={`grid grid-cols-1 gap-5 items-stretch md:grid-cols-2 ${isProfesional ? 'xl:grid-cols-4' : 'xl:grid-cols-3 2xl:grid-cols-4'}`}>
          {isProfesional ? (
          <>
            <DashboardStatCard
              title="Por Cobrar"
              value={formatCLP(stats.ingresosPendientesMes)}
              icon={CreditCard}
              iconClassName="bg-amber-100 text-amber-700"
              valueClassName="text-amber-600"
            />

            <DashboardStatCard
              title="Proyección del Mes"
              value={formatCLP(stats.ingresosProyectadosMes)}
              icon={Wallet}
              iconClassName="bg-blue-100 text-blue-700"
              valueClassName="text-blue-600"
            />

            <DashboardStatCard
              title="Rendimiento Cobrado"
              value={formatCLP(stats.utilidadMes)}
              icon={TrendingUp}
              iconClassName={stats.utilidadMes >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
              valueClassName={stats.utilidadMes >= 0 ? 'text-green-600' : 'text-red-600'}
            />

            <DashboardStatCard
              title="Cobrado / Proyectado"
              value={`${stats.margenMes.toFixed(1)}%`}
              icon={BarChart3}
              iconClassName="bg-slate-100 text-slate-700"
              valueClassName="text-slate-700"
            />
          </>
        ) : (
          <>
            <DashboardStatCard
              title="Cobrado"
              value={formatCLP(stats.ingresosCobradosMes)}
              icon={CreditCard}
              iconClassName="bg-amber-100 text-amber-700"
              valueClassName="text-amber-600"
            />

            <DashboardStatCard
              title="Por Cobrar"
              value={formatCLP(stats.ingresosPendientesMes)}
              icon={Wallet}
              iconClassName="bg-blue-100 text-blue-700"
              valueClassName="text-blue-600"
            />

            <DashboardStatCard
              title="Costos Totales"
              value={formatCLP(stats.costosMes)}
              icon={PiggyBank}
              iconClassName="bg-rose-100 text-rose-700"
              valueClassName="text-rose-600"
              subtitle={`Prof: ${formatCLP(stats.pagosProfesionalesMes)} + Op: ${formatCLP(stats.costosOperativosMes)}`}
            />

            <DashboardStatCard
              title="Utilidad Neta"
              value={formatCLP(stats.utilidadMes)}
              icon={TrendingUp}
              iconClassName={stats.utilidadMes >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
              valueClassName={stats.utilidadMes >= 0 ? 'text-green-600' : 'text-red-600'}
              subtitle="Ingresos - Costos totales"
            />

            <DashboardStatCard
              title="Margen del Mes"
              value={`${stats.margenMes.toFixed(1)}%`}
              icon={BarChart3}
              iconClassName="bg-slate-100 text-slate-700"
              valueClassName="text-slate-700"
              subtitle={`Canceladas: ${stats.citasCanceladasMes}`}
            />
          </>
          )}
        </div>
      )}
      
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Accesos Rápidos</h2>
            <p className="text-sm text-gray-500">Atajos para las acciones que usas con mayor frecuencia.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {!isProfesional && (
            <Link
              to="/profesionales/nuevo"
              className="group rounded-2xl border border-gray-100 bg-gray-50/80 p-4 transition-all hover:-translate-y-0.5 hover:border-medical-blue/20 hover:bg-white hover:shadow-sm"
            >
              <div className="mb-3 inline-flex rounded-full bg-medical-blue p-3 text-white shadow-sm transition-transform group-hover:scale-105">
                <Users className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Nuevo Profesional</p>
              <p className="mt-1 text-xs text-gray-500">Registrar un nuevo integrante del equipo.</p>
            </Link>
          )}

          {canManagePacientes && (
            <Link
              to="/pacientes/nuevo"
              className="group rounded-2xl border border-gray-100 bg-gray-50/80 p-4 transition-all hover:-translate-y-0.5 hover:border-medical-green/20 hover:bg-white hover:shadow-sm"
            >
              <div className="mb-3 inline-flex rounded-full bg-medical-green p-3 text-white shadow-sm transition-transform group-hover:scale-105">
                <UserPlus className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Nuevo Paciente</p>
              <p className="mt-1 text-xs text-gray-500">Agregar una ficha nueva al sistema.</p>
            </Link>
          )}

          <Link
            to="/agenda/nueva"
            className="group rounded-2xl border border-gray-100 bg-gray-50/80 p-4 transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:bg-white hover:shadow-sm"
          >
            <div className="mb-3 inline-flex rounded-full bg-orange-600 p-3 text-white shadow-sm transition-transform group-hover:scale-105">
              <Calendar className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-gray-800">Nueva Atención</p>
            <p className="mt-1 text-xs text-gray-500">Agendar una nueva sesión o control.</p>
          </Link>

          {!isProfesional && (
              <Link
                to="/reportes"
                className="group rounded-2xl border border-gray-100 bg-gray-50/80 p-4 transition-all hover:-translate-y-0.5 hover:border-purple-200 hover:bg-white hover:shadow-sm"
              >
                <div className="mb-3 inline-flex rounded-full bg-purple-600 p-3 text-white shadow-sm transition-transform group-hover:scale-105">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-gray-800">Ver Reportes</p>
                <p className="mt-1 text-xs text-gray-500">Revisar indicadores y resultados del centro.</p>
              </Link>
          )}
        </div>
      </div>

      {stats.proximasAtenciones.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-gray-800">Próximas Atenciones</h2>
            <p className="text-sm text-gray-500">Resumen de las próximas citas agendadas.</p>
          </div>
          <div className="space-y-3">
            {stats.proximasAtenciones.map(atencion => (
              <div key={atencion.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center space-x-3">
                  <div className="rounded-full bg-medical-blue p-2.5 text-white shadow-sm">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-800">{atencion.paciente?.nombre}</p>
                    <p className="truncate text-sm text-gray-600">
                      {atencion.profesional?.nombre} - {atencion.tipos_atencion?.nombre || 'Sin tipo'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {dateFormat(parseISO(atencion.fecha), 'dd/MM/yyyy')} a las {atencion.hora}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  atencion.estado_asistencia === 'no_asistio'
                    ? 'bg-red-100 text-red-800'
                    : atencion.pagado ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {atencion.estado_asistencia === 'no_asistio' ? 'No Asistió' : (atencion.pagado ? 'Pagado' : 'Pendiente')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center">
            <Bell className="h-6 w-6 text-medical-blue mr-2" />
            <h2 className="text-xl font-semibold text-gray-800">Notificaciones Recientes</h2>
          </div>
          <div className="space-y-3">
            {(() => {
              const notifications = notificationService.loadNotifications()
              const recentNotifications = notifications.slice(0, 3)
              
              if (recentNotifications.length === 0) {
                return (
                  <div className="rounded-2xl border border-dashed border-gray-200 py-8 text-center">
                    <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No hay notificaciones recientes</p>
                  </div>
                )
              }
              
              return recentNotifications.map(notification => (
                <div key={notification.id} className="flex items-start space-x-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                  <div className="flex-shrink-0 pt-0.5">
                    {notification.type === 'appointment_reminder' && <Calendar className="h-4 w-4 text-blue-500" />}
                    {notification.type === 'payment_due' && <DollarSign className="h-4 w-4 text-orange-500" />}
                    {!notification.read && <div className="w-2 h-2 bg-red-500 rounded-full mt-1"></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {dateFormat(notification.timestamp, 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              ))
            })()}
          </div>
          <div className="mt-5 text-center">
            <Link to="/agenda" className="inline-flex items-center rounded-full bg-medical-blue/10 px-4 py-2 text-sm font-medium text-medical-blue transition-colors hover:bg-medical-blue/15 hover:text-blue-700">
              Ver todas las notificaciones
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {!esProfesionalEnRengo && stats.atencionesPendientes > 0 && (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 rounded-full bg-yellow-100 p-2">
                  <Calendar className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-yellow-900">Pendientes de pago</p>
                  <p className="mt-1 text-sm text-yellow-800">
                    Hay {stats.atencionesPendientes} atenciones pendientes de pago.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0 rounded-full bg-blue-100 p-2">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900">Agenda de la semana</p>
                <p className="mt-1 text-sm text-blue-800">
                  {stats.proximasAtenciones.length} citas programadas para los próximos 7 días.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!esProfesionalEnRengo && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center">
            <BarChart3 className="h-6 w-6 text-medical-blue mr-2" />
            <h2 className="text-xl font-semibold text-gray-800">Análisis y Estadísticas</h2>
          </div>
          <DashboardCharts profesionalId={isProfesional && user?.profesional_id ? user.profesional_id : undefined} />
        </div>
      )}
    </div>
  )
}

export default Dashboard
