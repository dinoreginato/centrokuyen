import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserPlus, Calendar, DollarSign, TrendingUp, Activity, BarChart3, Bell, LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useSucursal } from '@/contexts/SucursalContext'
import { profesionalesService, pacientesService, atencionesService, profesionalComisionesService } from '@/utils/supabase'
import { format as dateFormat, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import DashboardCharts from './DashboardCharts'
import { autoNotificationService, notificationService } from '@/utils/notifications'
import { formatCLP } from '@/utils/currency'
import { hasPermission } from '@/utils/permissions'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'

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
          <p className={`overflow-hidden text-ellipsis text-[clamp(1.9rem,2.5vw,2.8rem)] font-bold leading-[0.95] tracking-tight tabular-nums whitespace-nowrap ${valueClassName}`}>
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
  const { currentCentro, currentSucursal } = useSucursal()
  const [stats, setStats] = useState({
    totalProfesionales: 0,
    totalPacientes: 0,
    totalAtencionesMes: 0,
    ingresosMes: 0,
    gananciasAcumuladas: 0,
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
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      
      const startDate = today.toISOString().split('T')[0]
      const endDate = nextWeek.toISOString().split('T')[0]
      
      const appointments = await atencionesService.getByDateRange(startDate, endDate, currentSucursal?.id, currentCentro?.id)
      
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
        profesionalesService.getAll(currentSucursal?.id, currentCentro?.id),
        pacientesService.getAll(currentSucursal?.id, currentCentro?.id),
        atencionesService.getAll(currentSucursal?.id, currentCentro?.id)
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

      // 4. Ingresos Este Mes / Mis Ganancias (SOLO PAGADAS)
      let ingresosMes = 0
      let gananciasAcumuladas = 0

      // Filtramos solo las pagadas para el cálculo de dinero
      const atencionesPagadasMes = atencionesMes.filter(a => a.pagado)
      const atencionesPagadasHistoricas = filteredAtenciones.filter(a => a.pagado)

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
          gananciasAcumuladas = calcularGananciaProfesional(atencionesPagadasHistoricas)
        }
      } else {
        // Para admin, sumamos el total cobrado de las atenciones pagadas
        ingresosMes = atencionesPagadasMes.reduce((total, atencion) => total + atencion.valor_cobrado, 0)
        gananciasAcumuladas = ingresosMes
      }

      // 5. Atenciones Pendientes (filtered)
      const atencionesPendientes = filteredAtenciones.filter(a => !a.pagado && a.estado_asistencia !== 'no_asistio').length

      // 6. Próximas Atenciones (filtered)
      const proximosDias = new Date()
      proximosDias.setDate(proximosDias.getDate() + 7)
      
      const proximasAtenciones = filteredAtenciones
        .filter(atencion => {
          const atencionDate = parseISO(atencion.fecha)
          return atencionDate >= new Date() && atencionDate <= proximosDias
        })
        .sort((a, b) => new Date(`${a.fecha}T${a.hora}`).getTime() - new Date(`${b.fecha}T${b.hora}`).getTime())
        .slice(0, 5)

      setStats({
        totalProfesionales: metric1Value,
        totalPacientes: metric2Value,
        totalAtencionesMes: atencionesMes.length,
        ingresosMes,
        gananciasAcumuladas,
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
    return <PageLoader label="Cargando dashboard..." />
  }

  const isProfesional = user?.rol === 'profesional'
  const canManagePacientes = hasPermission(user, 'managePacientes')
  const canViewFinancialMetrics = hasPermission(user, 'viewFinancialMetrics')
  const professionalIncomeTitle = 'Mis Ganancias del Mes'
  const professionalIncomeValue = stats.ingresosMes
  const professionalIncomeSubtitle = 'Total cobrado del mes'

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
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 shadow-sm hidden sm:block">
            {dateFormat(new Date(), 'EEEE d MMMM yyyy', { locale: es })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 items-stretch">
        <DashboardStatCard
          to={isProfesional ? '/agenda' : '/profesionales'}
          title={isProfesional ? 'Total Atenciones' : 'Total Profesionales'}
          value={stats.totalProfesionales}
          icon={Users}
          iconClassName="bg-medical-blue text-white"
          valueClassName="text-medical-blue"
        />

        <DashboardStatCard
          to={isProfesional ? '/agenda' : '/pacientes'}
          title={isProfesional ? 'Mis Pacientes' : 'Total Pacientes'}
          value={stats.totalPacientes}
          icon={UserPlus}
          iconClassName="bg-medical-green text-white"
          valueClassName="text-medical-green"
        />

        <DashboardStatCard
          to="/agenda"
          title={isProfesional ? 'Mis Atenciones del Mes' : 'Atenciones Este Mes'}
          value={stats.totalAtencionesMes}
          icon={Calendar}
          iconClassName="bg-orange-600 text-white"
          valueClassName="text-orange-600"
        />

        <DashboardStatCard
          title={isProfesional ? professionalIncomeTitle : 'Ingresos Este Mes'}
          value={formatCLP(isProfesional ? professionalIncomeValue : stats.ingresosMes)}
          icon={DollarSign}
          iconClassName="bg-purple-600 text-white"
          valueClassName="text-purple-600"
          subtitle={isProfesional ? professionalIncomeSubtitle : 'Ingresos cobrados del mes'}
        />
      </div>
      
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Accesos Rápidos</h2>
            <p className="text-sm text-gray-500">Atajos para las acciones que usas con mayor frecuencia.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {hasPermission(user, 'manageProfesionales') && (
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

          {hasPermission(user, 'viewReportes') && (
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

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Próximas Atenciones</h2>
            <p className="text-sm text-gray-500">Resumen de las próximas citas agendadas.</p>
          </div>
        </div>
        {stats.proximasAtenciones.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Sin próximas atenciones"
            description="No hay citas futuras registradas para el período visible."
          />
        ) : (
          <div className="space-y-3">
            {stats.proximasAtenciones.map(atencion => (
              <div key={atencion.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center space-x-3 min-w-0">
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
        )}
      </div>

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
          {canViewFinancialMetrics && stats.atencionesPendientes > 0 && (
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

      {canViewFinancialMetrics && (
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
