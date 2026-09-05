import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit, Trash2, Settings, MessageCircle, DollarSign, CheckCircle, XCircle, CalendarCheck2, CalendarX2, Repeat, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useSucursal } from '@/contexts/SucursalContext'
import { Atencion } from '@/types/database'
import { atencionesService } from '@/utils/supabase'
import { format as dateFormat, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, startOfMonth, endOfMonth, isSameMonth, differenceInYears } from 'date-fns'
import { es } from 'date-fns/locale'
import { getEstadoCitaBadgeClass, getEstadoCitaCardClass, getEstadoCitaLabel } from '@/utils/atencionEstado'
import { canManageAtencion, canManagePayment, hasPermission } from '@/utils/permissions'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const Agenda = () => {
  const { user } = useAuth()
  const { currentCentro, currentSucursal } = useSucursal()
  const [atenciones, setAtenciones] = useState<Atencion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week')
  const [estadoFilter, setEstadoFilter] = useState<'todos' | 'por_confirmar' | 'confirmada' | 'cancelada' | 'reagendada'>('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [atencionToDelete, setAtencionToDelete] = useState<Atencion | null>(null)

  useEffect(() => {
    if (currentSucursal) {
      loadData()
    }
  }, [currentMonth, currentWeek, selectedDate, currentSucursal])

  const loadData = async () => {
    try {
      setLoading(true)
      const atencionesData = await atencionesService.getAll(currentSucursal?.id, currentCentro?.id)
      
      const filteredAtenciones = (user?.rol === 'profesional' && user.profesional_id)
        ? atencionesData.filter(a => a.profesional_id === user.profesional_id)
        : atencionesData

      setAtenciones(filteredAtenciones)
    } catch (error) {
      toast.error('Error al cargar datos de la agenda')
      console.error('Error loading agenda data:', error)
    } finally {
      setLoading(false)
    }
  }

  const daysToShow = viewMode === 'month'
    ? eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
      })
    : viewMode === 'week' 
    ? eachDayOfInterval({
        start: startOfWeek(currentWeek, { weekStartsOn: 1 }),
        end: endOfWeek(currentWeek, { weekStartsOn: 1 })
      })
    : [selectedDate]

  const navigate = (direction: 'prev' | 'next') => {
    if (viewMode === 'month') {
      setCurrentMonth(prev => addDays(prev, direction === 'next' ? 30 : -30))
    } else if (viewMode === 'week') {
      setCurrentWeek(prev => addDays(prev, direction === 'next' ? 7 : -7))
    } else {
      setSelectedDate(prev => addDays(prev, direction === 'next' ? 1 : -1))
    }
  }

  const toggleAsistencia = async (atencion: Atencion, nuevoEstado: 'asistio' | 'no_asistio') => {
    const estadoCita = atencion.estado_cita || 'por_confirmar'

    if (estadoCita === 'cancelada' || estadoCita === 'reagendada') {
      toast.error(`No puedes registrar asistencia en una cita ${getEstadoCitaLabel(estadoCita).toLowerCase()}`)
      return
    }

    try {
      const estadoFinal = atencion.estado_asistencia === nuevoEstado ? 'pendiente' : nuevoEstado
      
      const updates: any = { estado_asistencia: estadoFinal }
      
      if (estadoFinal === 'no_asistio') {
        updates.valor_cobrado = 0
        updates.pagado = false
      } else if (atencion.valor_cobrado === 0) {
        if (atencion.tipos_atencion?.valor_base) {
          updates.valor_cobrado = atencion.tipos_atencion.valor_base
        }
      }
      
      await atencionesService.update(atencion.id, updates)
      
      const msj = estadoFinal === 'pendiente' ? 'Asistencia pendiente' : 
                  estadoFinal === 'asistio' ? 'Marcado como Asistió' : 'Marcado como No Asistió'
      toast.success(msj)
      loadData()
    } catch (error) {
      toast.error('Error al actualizar asistencia')
      console.error('Error toggling asistencia:', error)
    }
  }

  const togglePago = async (atencion: Atencion) => {
    if (!canManagePayment(user, atencion)) {
      toast.error('No tienes permisos para cambiar el estado de pago de esta atención')
      return
    }

    const estadoCita = atencion.estado_cita || 'por_confirmar'

    if (estadoCita === 'cancelada' || estadoCita === 'reagendada') {
      toast.error(`No puedes marcar pago en una cita ${getEstadoCitaLabel(estadoCita).toLowerCase()}`)
      return
    }

    try {
      const nuevoEstado = !atencion.pagado
      await atencionesService.setPagado(atencion.id, nuevoEstado)
      toast.success(`Pago marcado como ${nuevoEstado ? 'Pagado' : 'Pendiente'}`)
      loadData()
    } catch (error) {
      toast.error('Error al actualizar estado de pago')
      console.error('Error toggling payment:', error)
    }
  }

  const updateEstadoCita = async (atencion: Atencion, nuevoEstado: NonNullable<Atencion['estado_cita']>) => {
    if (atencion.es_bloqueo) {
      toast.error('Los bloques no clínicos no usan este flujo de estados')
      return
    }

    try {
      await atencionesService.updateEstadoCita(atencion.id, nuevoEstado)
      toast.success(`Cita marcada como ${getEstadoCitaLabel(nuevoEstado).toLowerCase()}`)
      loadData()
    } catch (error) {
      toast.error('Error al actualizar el estado de la cita')
      console.error('Error updating appointment status:', error)
    }
  }

  const deleteAtencion = async (id: string) => {
    try {
      await atencionesService.delete(id)
      toast.success('Atención eliminada exitosamente')
      setAtencionToDelete(null)
      loadData()
    } catch (error) {
      toast.error('Error al eliminar atención')
      console.error('Error deleting atencion:', error)
    }
  }

  const getWhatsAppLink = (atencion: Atencion) => {
    if (!atencion.paciente?.telefono) return null
    
    const formatTime = (timeStr: string) => {
      if (!timeStr) return ''
      // Asumimos que la hora ya viene en formato HH:mm:ss o HH:mm desde la BD
      // Simplemente cortamos los segundos si los hay para mostrar HH:mm (formato 24hrs)
      return timeStr.substring(0, 5) + ' hrs'
    }

    let phone = atencion.paciente.telefono.replace(/\D/g, '')
    
    if (phone.length === 9 && phone.startsWith('9')) {
      phone = '56' + phone
    } 
    else if (phone.length === 8) { 
       phone = '569' + phone
    }
    
    const fechaStr = dateFormat(parseISO(atencion.fecha), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
    const nombrePaciente = atencion.paciente.nombre
    const nombreProfesional = atencion.profesional?.nombre || 'el especialista'
    const horaAmPm = formatTime(atencion.hora)
    
    // Usamos asteriscos (*) para negrita en WhatsApp
    const mensaje = `Hola ${nombrePaciente}, escribo para confirmar la hora con ${nombreProfesional} para este *${fechaStr}* a las *${horaAmPm}*.

(NUEVO PROTOCOLO DE CONFIRMACIÓN)

1- Como parte de nuestra política de pago oportuno, toda consulta debe ser pagada a más tardar el día hábil anterior a la cita, de lo contrario la hora quedará libre para otro paciente.

2- En el caso que no pueda asistir a su cita, o que por fuerza mayor esta deba ser suspendida por nuestra parte, se podrá reagendar con el compromiso que ambas partes den aviso a tiempo. De no dar aviso oportuno se hará el cobro de la sesión correspondiente.

3- Datos para el pago:

CENTRO KUYEN ESPACIO TERAPEUTICO INTEGRAL LIMITADA 
77.773.463-6
Banco de Chile
Cuenta Vista
00-010-99232-54
Centrokuyenrengo@gmail.com

Solicitar Boleta a nuestra secretaria vía WhatsApp
+56 9 7976 3321

Gracias 🙌🏻`
    
    return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`
  }

  const getEdadPaciente = (atencion: Atencion) => {
    const fechaNacimiento = atencion.paciente?.fecha_nacimiento
    if (!fechaNacimiento) return null
    const date = parseISO(fechaNacimiento)
    if (Number.isNaN(date.getTime())) return null
    const edad = differenceInYears(new Date(), date)
    return edad >= 0 ? edad : null
  }

  const atencionesFiltradas = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return atenciones.filter((atencion) => {
      const matchesEstado =
        estadoFilter === 'todos' ? true : (atencion.estado_cita || 'por_confirmar') === estadoFilter
      const matchesSearch =
        normalizedSearch.length === 0 ||
        (atencion.paciente?.nombre || '').toLowerCase().includes(normalizedSearch) ||
        (atencion.profesional?.nombre || '').toLowerCase().includes(normalizedSearch) ||
        (atencion.tipos_atencion?.nombre || atencion.tipo_atencion || '').toLowerCase().includes(normalizedSearch)

      return matchesEstado && matchesSearch
    })
  }, [atenciones, estadoFilter, searchTerm])

  const renderAtencionCard = (atencion: Atencion, compact = false) => (
    <div
      key={atencion.id}
      className={`group relative rounded-md border shadow-sm transition-all hover:shadow-md ${
        compact ? 'p-3 text-sm' : 'p-2 text-xs'
      } ${getEstadoCitaCardClass(atencion.estado_cita, atencion.pagado, atencion.estado_asistencia)}`}
    >
      <div className="flex justify-between items-start mb-1.5">
        <span className={`font-bold text-gray-700 bg-gray-100 rounded ${compact ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]'}`}>
          {atencion.hora.substring(0, 5)}
        </span>
        <div className="flex space-x-1">
          {atencion.estado_asistencia === 'asistio' && (
            <CheckCircle className={`${compact ? 'h-4 w-4' : 'h-3 w-3'} text-green-600`} />
          )}
          {atencion.estado_asistencia === 'no_asistio' && (
            <XCircle className={`${compact ? 'h-4 w-4' : 'h-3 w-3'} text-red-600`} />
          )}
          {atencion.pagado && (
            <DollarSign className={`${compact ? 'h-4 w-4' : 'h-3 w-3'} text-green-600`} />
          )}
        </div>
      </div>

      <div className="mb-2">
        <div className={`font-semibold text-gray-900 truncate ${compact ? 'text-sm' : ''}`} title={atencion.paciente?.nombre}>
          {atencion.es_bloqueo ? atencion.tipo_atencion : atencion.paciente?.nombre}
        </div>

        {(() => {
          if (atencion.es_bloqueo) return null
          const edad = getEdadPaciente(atencion)
          return edad === null ? null : (
            <div className={`text-gray-500 truncate mt-0.5 ${compact ? 'text-xs' : 'text-[10px]'}`}>
              {edad} años
            </div>
          )
        })()}
        
        {!user?.profesional_id && (
          <div className={`text-gray-500 truncate mt-0.5 ${compact ? 'text-xs' : 'text-[10px]'}`}>
            {atencion.profesional?.nombre}
          </div>
        )}
        
        <div className={`text-gray-500 truncate mt-0.5 ${compact ? 'text-xs' : 'text-[10px]'}`}>
          {atencion.tipos_atencion?.nombre || atencion.tipo_atencion}
        </div>

        <div className="mt-1">
          <span className={`inline-flex items-center rounded-full font-medium border ${getEstadoCitaBadgeClass(atencion.estado_cita)} ${compact ? 'px-2 py-0.5 text-xs' : 'px-2 py-0.5 text-[10px]'}`}>
            {getEstadoCitaLabel(atencion.estado_cita)}
          </span>
        </div>

        {atencion.numero_boleta && (
          <div className={`text-gray-600 truncate mt-1 font-medium bg-gray-50 rounded inline-block ${compact ? 'px-2 py-1 text-xs' : 'px-1 py-0.5 text-[10px]'}`}>
            Boleta: {atencion.numero_boleta}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-end items-center gap-1 pt-1.5 border-t border-gray-100">
        {!atencion.es_bloqueo && canManageAtencion(user, atencion) && (
          <>
            <button
              onClick={() => updateEstadoCita(atencion, 'confirmada')}
              className={`p-1 rounded hover:bg-blue-50 ${atencion.estado_cita === 'confirmada' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
              title="Confirmar cita"
            >
              <CalendarCheck2 className="h-4 w-4" />
            </button>

            <button
              onClick={() => updateEstadoCita(atencion, 'cancelada')}
              className={`p-1 rounded hover:bg-red-50 ${atencion.estado_cita === 'cancelada' ? 'text-red-600' : 'text-gray-400 hover:text-red-600'}`}
              title="Cancelar cita"
            >
              <CalendarX2 className="h-4 w-4" />
            </button>

            <Link
              to={`/agenda/nueva?profesional_id=${atencion.profesional_id}&fecha=${atencion.fecha}&hora=${atencion.hora.substring(0, 5)}&paciente_id=${atencion.paciente_id || ''}&reagenda_id=${atencion.id}`}
              className={`p-1 rounded hover:bg-purple-50 ${atencion.estado_cita === 'reagendada' ? 'text-purple-600' : 'text-gray-400 hover:text-purple-600'}`}
              title="Reagendar cita"
            >
              <Repeat className="h-4 w-4" />
            </Link>

            <button
              onClick={() => toggleAsistencia(atencion, 'asistio')}
              className={`p-1 rounded hover:bg-green-50 ${atencion.estado_asistencia === 'asistio' ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`}
              title="Asistió"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => toggleAsistencia(atencion, 'no_asistio')}
              className={`p-1 rounded hover:bg-red-50 ${atencion.estado_asistencia === 'no_asistio' ? 'text-red-600' : 'text-gray-400 hover:text-red-600'}`}
              title="No Asistió"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </>
        )}

        <button
          onClick={() => {
            const link = getWhatsAppLink(atencion)
            if (link) window.open(link, '_blank')
            else toast.error('Sin teléfono')
          }}
          className="p-1 rounded hover:bg-green-50 text-gray-400 hover:text-green-600"
          title="WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
        </button>

        {canManagePayment(user, atencion) && (
          <button
            onClick={() => togglePago(atencion)}
            className={`p-1 rounded hover:bg-yellow-50 ${atencion.pagado ? 'text-green-600' : 'text-gray-400 hover:text-yellow-600'}`}
            title="Pago"
          >
            <DollarSign className="h-4 w-4" />
          </button>
        )}

        {canManageAtencion(user, atencion) && (
          <>
            <Link
              to={`/agenda/${atencion.id}`}
              className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"
              title="Editar"
            >
              <Edit className="h-4 w-4" />
            </Link>
            <button
                onClick={() => setAtencionToDelete(atencion)}
              className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )

  if (loading) {
    return <PageLoader label="Cargando agenda..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Agenda de Atenciones</h1>
        <div className="flex space-x-3">
          {hasPermission(user, 'manageTiposAtencion') && (
            <Link
              to="/tipos-atencion"
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Settings className="h-5 w-5" />
              <span>Tipos de Atención</span>
            </Link>
          )}
          <Link
            to="/agenda/nueva"
            className="bg-medical-blue hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Nueva Atención</span>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
          <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
             <button
               onClick={() => setViewMode('month')}
               className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'month' ? 'bg-white text-medical-blue shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
             >
               Mes
             </button>
             <button
               onClick={() => setViewMode('week')}
               className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'week' ? 'bg-white text-medical-blue shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
             >
               Semana
             </button>
             <button
               onClick={() => setViewMode('day')}
               className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'day' ? 'bg-white text-medical-blue shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
             >
               Día
             </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate('prev')}
              className="p-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              title="Anterior"
            >
              ←
            </button>
            <h2 className="text-lg font-semibold text-gray-800 text-center min-w-[240px] capitalize">
              {viewMode === 'month'
                ? dateFormat(currentMonth, "MMMM yyyy", { locale: es })
                : viewMode === 'week' 
                ? `Semana del ${dateFormat(daysToShow[0], 'd MMM', { locale: es })}`
                : dateFormat(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })
              }
            </h2>
            <button
              onClick={() => navigate('next')}
              className="p-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              title="Siguiente"
            >
              →
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por paciente, profesional o tipo..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-medical-blue focus:ring-medical-blue"
            />
          </label>
          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value as typeof estadoFilter)}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-medical-blue focus:ring-medical-blue"
          >
            <option value="todos">Todos los estados</option>
            <option value="por_confirmar">Por confirmar</option>
            <option value="confirmada">Confirmada</option>
            <option value="cancelada">Cancelada</option>
            <option value="reagendada">Reagendada</option>
          </select>
        </div>

        <div className="space-y-4 md:hidden">
          {daysToShow.map((day) => {
            const dayAppointments = atencionesFiltradas
              .filter((a) => isSameDay(parseISO(a.fecha), day))
              .sort((a, b) => a.hora.localeCompare(b.hora))

            const isCurrentMonth = viewMode === 'month' ? isSameMonth(day, currentMonth) : true

            return (
              <div key={`mobile-${day.toISOString()}`} className={`rounded-lg border ${!isCurrentMonth ? 'opacity-50' : 'border-gray-200'} overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${
                  isSameDay(day, new Date())
                    ? 'bg-blue-50 text-blue-800 border-blue-100'
                    : 'bg-gray-50 text-gray-700 border-gray-100'
                }`}>
                  <div className="text-xs font-semibold uppercase tracking-wider">
                    {dateFormat(day, 'EEEE', { locale: es })}
                  </div>
                  <div className="text-lg font-bold">
                    {dateFormat(day, "d 'de' MMMM", { locale: es })}
                  </div>
                </div>

                <div className="p-3 space-y-3 bg-gray-50/30">
                  {dayAppointments.length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-3">Sin citas con los filtros actuales</p>
                  ) : (
                    dayAppointments.map((atencion) => renderAtencionCard(atencion, true))
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="hidden md:block overflow-x-auto pb-4">
          <div className={`grid gap-3 ${viewMode === 'month' ? 'grid-cols-1 md:grid-cols-7 min-w-[1000px] md:min-w-0' : viewMode === 'week' ? 'grid-cols-1 md:grid-cols-7 min-w-[1000px] md:min-w-0' : 'grid-cols-1'}`}>
            {daysToShow.map((day) => {
              const dayAppointments = atencionesFiltradas
                .filter((a) => isSameDay(parseISO(a.fecha), day))
                .sort((a, b) => a.hora.localeCompare(b.hora))
              
              const isCurrentMonth = viewMode === 'month' ? isSameMonth(day, currentMonth) : true

              return (
                <div key={day.toISOString()} className={`flex flex-col bg-white rounded-lg border shadow-sm h-full ${!isCurrentMonth ? 'opacity-50' : 'border-gray-200'}`}>
                  <div className={`p-3 text-center border-b ${
                    isSameDay(day, new Date()) 
                      ? 'bg-blue-50 text-blue-800 border-blue-100' 
                      : 'bg-gray-50 text-gray-700 border-gray-100'
                  }`}>
                    <div className="text-xs font-semibold uppercase tracking-wider">
                      {dateFormat(day, 'EEEE', { locale: es })}
                    </div>
                    <div className="text-xl font-bold">
                      {dateFormat(day, 'd', { locale: es })}
                    </div>
                  </div>

                  <div className="p-2 space-y-2 flex-1 min-h-[200px] bg-gray-50/30">
                    {dayAppointments.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-xs text-gray-400 italic">Sin citas con filtros</p>
                      </div>
                    ) : (
                      dayAppointments.map((atencion) => renderAtencionCard(atencion))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {atencionesFiltradas.length === 0 && (
        <EmptyState
          icon={CalendarCheck2}
          title="No hay citas para mostrar"
          description="Los filtros actuales no devolvieron resultados. Prueba con otro estado o limpia la búsqueda."
        />
      )}

      <ConfirmDialog
        open={!!atencionToDelete}
        title="Eliminar atención"
        description={atencionToDelete ? `Vas a eliminar la cita de ${atencionToDelete.paciente?.nombre || 'este paciente'} del ${atencionToDelete.fecha} a las ${atencionToDelete.hora.substring(0, 5)}.` : ''}
        confirmLabel="Eliminar cita"
        cancelLabel="Cancelar"
        tone="danger"
        onCancel={() => setAtencionToDelete(null)}
        onConfirm={() => {
          if (atencionToDelete) {
            void deleteAtencion(atencionToDelete.id)
          }
        }}
      />
    </div>
  )
}

export default Agenda
