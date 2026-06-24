import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserPlus, Calendar, DollarSign, TrendingUp, Activity, BarChart3, Bell, Wallet, CreditCard, PiggyBank } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useSucursal } from '@/contexts/SucursalContext'
import { profesionalesService, pacientesService, atencionesService, profesionalComisionesService, reportesService } from '@/utils/supabase'
import { format as dateFormat, startOfMonth, endOfMonth, parseISO, addDays, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import DashboardCharts from './DashboardCharts'
import { autoNotificationService, notificationService } from '@/utils/notifications'
import { formatCLP } from '@/utils/currency'

const Dashboard = () => {
  const { user } = useAuth()
  const { currentSucursal } = useSucursal()
  const [stats, setStats] = useState({
    totalProfesionales: 0,
    totalPacientes: 0,
    totalAtencionesMes: 0,
    ingresosMes: 0,
    ingresosPendientesMes: 0,
    ingresosProyectadosMes: 0,
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

      const atencionesMesClinicas = atencionesMes.filter(a => !a.es_bloqueo)
      const atencionesMesActivas = atencionesMesClinicas.filter(a => a.estado_cita !== 'cancelada')
      const citasCanceladasMes = atencionesMesClinicas.filter(a => a.estado_cita === 'cancelada').length

      // 4. Ingresos Este Mes / Mis Ganancias (SOLO PAGADAS)
      let ingresosMes = 0
      let ingresosPendientesMes = 0
      let ingresosProyectadosMes = 0
      let costosMes = 0
      let utilidadMes = 0
      let margenMes = 0

      // Filtramos solo las pagadas para el cálculo de dinero
      const atencionesPagadasMes = atencionesMesActivas.filter(a => a.pagado)
      const atencionesPendientesMesList = atencionesMesActivas.filter(a => !a.pagado)

      ingresosPendientesMes = atencionesPendientesMesList.reduce((total, atencion) => total + atencion.valor_cobrado, 0)
      ingresosProyectadosMes = atencionesMesActivas.reduce((total, atencion) => total + atencion.valor_cobrado, 0)

      if (isProfesional && user?.profesional_id) {
        const pid = user.profesional_id
        const profesionalActual = profesionales.find(p => p.id === pid)
        if (profesionalActual) {
          const comisiones = await profesionalComisionesService.getAll(pid)
          
          ingresosMes = atencionesPagadasMes.reduce((total, atencion) => {
            const comisionEspecifica = comisiones.find(c => c.tipo_atencion_id === atencion.tipo_atencion)
            const porcentaje = comisionEspecifica?.porcentaje ?? profesionalActual.porcentaje_pago ?? 0
            const montoFijo = comisionEspecifica?.monto_fijo ?? profesionalActual.monto_fijo_pago ?? 0
            const pagoPorcentaje = (atencion.valor_cobrado * porcentaje) / 100
            return total + pagoPorcentaje + montoFijo
          }, 0)
        }
        utilidadMes = ingresosMes
        margenMes = ingresosProyectadosMes > 0 ? (ingresosMes / ingresosProyectadosMes) * 100 : 0
      } else {
        // Para admin, sumamos el total cobrado de las atenciones pagadas
        ingresosMes = atencionesPagadasMes.reduce((total, atencion) => total + atencion.valor_cobrado, 0)
        const reporteMensual = await reportesService.getReporteMensual(year, month, currentSucursal?.id)
        costosMes = reporteMensual.total_costos
        utilidadMes = reporteMensual.utilidad_neta
        margenMes = reporteMensual.ingresos_totales > 0 ? (reporteMensual.utilidad_neta / reporteMensual.ingresos_totales) * 100 : 0
      }

      // 5. Atenciones Pendientes (filtered)
      const atencionesPendientes = filteredAtenciones.filter(
        a => !a.es_bloqueo && a.estado_cita !== 'cancelada' && !a.pagado && a.estado_asistencia !== 'no_asistio'
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
        ingresosPendientesMes,
        ingresosProyectadosMes,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard Principal</h1>
        <div className="flex items-center space-x-4">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-medical-blue focus:border-transparent text-sm"
          />
          <div className="text-sm text-gray-500 hidden sm:block">
            {dateFormat(new Date(), 'EEEE d MMMM yyyy', { locale: es })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to={isProfesional ? "/agenda" : "/profesionales"} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                  {isProfesional ? 'Total Atenciones' : 'Total Profesionales'}
              </p>
              <p className="text-3xl font-bold text-medical-blue">{stats.totalProfesionales}</p>
            </div>
            <div className="bg-medical-blue text-white rounded-full p-3">
              <Users className="h-6 w-6" />
            </div>
          </div>
        </Link>

        <Link to={isProfesional ? "/agenda" : "/pacientes"} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                  {isProfesional ? 'Mis Pacientes' : 'Total Pacientes'}
              </p>
              <p className="text-3xl font-bold text-medical-green">{stats.totalPacientes}</p>
            </div>
            <div className="bg-medical-green text-white rounded-full p-3">
              <UserPlus className="h-6 w-6" />
            </div>
          </div>
        </Link>

        <Link to="/agenda" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                  {isProfesional ? 'Mis Atenciones (Mes)' : 'Atenciones Este Mes'}
              </p>
              <p className="text-3xl font-bold text-orange-600">{stats.totalAtencionesMes}</p>
            </div>
            <div className="bg-orange-600 text-white rounded-full p-3">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
        </Link>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {isProfesional ? 'Mis Ganancias Cobradas' : 'Ingresos Cobrados'}
              </p>
              <p className="text-3xl font-bold text-purple-600">{formatCLP(stats.ingresosMes)}</p>
            </div>
            <div className="bg-purple-600 text-white rounded-full p-3">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${isProfesional ? 'xl:grid-cols-3' : 'xl:grid-cols-5'} gap-6`}>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{isProfesional ? 'Por Cobrar' : 'Pendiente por Cobrar'}</p>
              <p className="text-2xl font-bold text-amber-600">{formatCLP(stats.ingresosPendientesMes)}</p>
            </div>
            <div className="bg-amber-100 text-amber-700 rounded-full p-3">
              <CreditCard className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{isProfesional ? 'Proyección del Mes' : 'Ingreso Proyectado'}</p>
              <p className="text-2xl font-bold text-blue-600">{formatCLP(stats.ingresosProyectadosMes)}</p>
            </div>
            <div className="bg-blue-100 text-blue-700 rounded-full p-3">
              <Wallet className="h-6 w-6" />
            </div>
          </div>
        </div>

        {!isProfesional && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Costos del Mes</p>
                <p className="text-2xl font-bold text-rose-600">{formatCLP(stats.costosMes)}</p>
              </div>
              <div className="bg-rose-100 text-rose-700 rounded-full p-3">
                <PiggyBank className="h-6 w-6" />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{isProfesional ? 'Rendimiento Cobrado' : 'Utilidad Neta'}</p>
              <p className={`text-2xl font-bold ${stats.utilidadMes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCLP(stats.utilidadMes)}
              </p>
            </div>
            <div className={`${stats.utilidadMes >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} rounded-full p-3`}>
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{isProfesional ? 'Cobrado / Proyectado' : 'Margen del Mes'}</p>
              <p className="text-2xl font-bold text-slate-700">{stats.margenMes.toFixed(1)}%</p>
              {!isProfesional && (
                <p className="text-xs text-gray-500 mt-1">Canceladas: {stats.citasCanceladasMes}</p>
              )}
            </div>
            <div className="bg-slate-100 text-slate-700 rounded-full p-3">
              <BarChart3 className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Accesos Rápidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {!isProfesional && (
            <Link
              to="/profesionales/nuevo"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="bg-medical-blue text-white rounded-full p-3 mb-2">
                <Users className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium text-gray-700">Nuevo Profesional</span>
            </Link>
          )}

          {canManagePacientes && (
            <Link
              to="/pacientes/nuevo"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="bg-medical-green text-white rounded-full p-3 mb-2">
                <UserPlus className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium text-gray-700">Nuevo Paciente</span>
            </Link>
          )}

          <Link
            to="/agenda/nueva"
            className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="bg-orange-600 text-white rounded-full p-3 mb-2">
              <Calendar className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium text-gray-700">Nueva Atención</span>
          </Link>

          {!isProfesional && (
              <Link
                to="/reportes"
                className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="bg-purple-600 text-white rounded-full p-3 mb-2">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-gray-700">Ver Reportes</span>
              </Link>
          )}
        </div>
      </div>

      {stats.proximasAtenciones.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Próximas Atenciones</h2>
          <div className="space-y-3">
            {stats.proximasAtenciones.map(atencion => (
              <div key={atencion.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="bg-medical-blue text-white rounded-full p-2">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{atencion.paciente?.nombre}</p>
                    <p className="text-sm text-gray-600">
                      {atencion.profesional?.nombre} - {atencion.tipos_atencion?.nombre || 'Sin tipo'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {dateFormat(parseISO(atencion.fecha), 'dd/MM/yyyy')} a las {atencion.hora}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <Bell className="h-6 w-6 text-medical-blue mr-2" />
            <h2 className="text-xl font-semibold text-gray-800">Notificaciones Recientes</h2>
          </div>
          <div className="space-y-3">
            {(() => {
              const notifications = notificationService.loadNotifications()
              const recentNotifications = notifications.slice(0, 3)
              
              if (recentNotifications.length === 0) {
                return (
                  <div className="text-center py-4">
                    <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No hay notificaciones recientes</p>
                  </div>
                )
              }
              
              return recentNotifications.map(notification => (
                <div key={notification.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
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
          <div className="mt-4 text-center">
            <Link to="/agenda" className="text-sm text-medical-blue hover:text-blue-700">
              Ver todas las notificaciones
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {stats.atencionesPendientes > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Calendar className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-800">
                    Hay {stats.atencionesPendientes} atenciones pendientes de pago.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Activity className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  {stats.proximasAtenciones.length} citas programadas para los próximos 7 días.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!esProfesionalEnRengo && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
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
