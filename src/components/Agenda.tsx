import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit, Trash2, Settings, MessageCircle, DollarSign, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useSucursal } from '@/contexts/SucursalContext'
import { Atencion } from '@/types/database'
import { atencionesService } from '@/utils/supabase'
import { format as dateFormat, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, startOfMonth, endOfMonth, isSameMonth } from 'date-fns'
import { es } from 'date-fns/locale'

const Agenda = () => {
  const { user } = useAuth()
  const { currentSucursal } = useSucursal()
  const [atenciones, setAtenciones] = useState<Atencion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week')

  useEffect(() => {
    if (currentSucursal) {
      loadData()
    }
  }, [currentMonth, currentWeek, selectedDate, currentSucursal])

  const loadData = async () => {
    try {
      setLoading(true)
      const atencionesData = await atencionesService.getAll(currentSucursal?.id)
      
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
    try {
      const nuevoEstado = !atencion.pagado
      await atencionesService.update(atencion.id, { pagado: nuevoEstado })
      toast.success(`Pago marcado como ${nuevoEstado ? 'Pagado' : 'Pendiente'}`)
      loadData()
    } catch (error) {
      toast.error('Error al actualizar estado de pago')
      console.error('Error toggling payment:', error)
    }
  }

  const deleteAtencion = async (id: string) => {
    if (!confirm('¿Está seguro de que desea eliminar esta atención?')) {
      return
    }

    try {
      await atencionesService.delete(id)
      toast.success('Atención eliminada exitosamente')
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Agenda de Atenciones</h1>
        <div className="flex space-x-3">
          {user?.rol === 'admin' && (
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

        <div className="overflow-x-auto pb-4">
          <div className={`grid gap-3 ${viewMode === 'month' ? 'grid-cols-1 md:grid-cols-7 min-w-[1000px] md:min-w-0' : viewMode === 'week' ? 'grid-cols-1 md:grid-cols-7 min-w-[1000px] md:min-w-0' : 'grid-cols-1'}`}>
            {daysToShow.map((day) => {
              const dayAppointments = atenciones
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
                        <p className="text-xs text-gray-400 italic">Sin citas</p>
                      </div>
                    ) : (
                      dayAppointments.map((atencion) => (
                        <div
                          key={atencion.id}
                          className={`relative p-2 rounded-md border text-xs shadow-sm transition-all hover:shadow-md group ${
                            atencion.estado_asistencia === 'no_asistio' ? 'bg-red-50 border-red-100' :
                            atencion.pagado ? 'bg-green-50 border-green-100' : 
                            'bg-white border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1.5">
                            <span className="font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                              {atencion.hora.substring(0, 5)}
                            </span>
                            <div className="flex space-x-1">
                              {atencion.estado_asistencia === 'asistio' && (
                                <CheckCircle className="h-3 w-3 text-green-600" />
                              )}
                              {atencion.estado_asistencia === 'no_asistio' && (
                                <XCircle className="h-3 w-3 text-red-600" />
                              )}
                              {atencion.pagado && (
                                <DollarSign className="h-3 w-3 text-green-600" />
                              )}
                            </div>
                          </div>

                          <div className="mb-2">
                            <div className="font-semibold text-gray-900 truncate" title={atencion.paciente?.nombre}>
                              {atencion.paciente?.nombre}
                            </div>
                            
                            {!user?.profesional_id && (
                              <div className="text-gray-500 truncate text-[10px] mt-0.5">
                                {atencion.profesional?.nombre}
                              </div>
                            )}
                            
                            <div className="text-gray-500 truncate text-[10px] mt-0.5">
                              {atencion.tipos_atencion?.nombre}
                            </div>

                            {atencion.numero_boleta && (
                              <div className="text-gray-600 truncate text-[10px] mt-0.5 font-medium bg-gray-50 px-1 rounded inline-block">
                                Boleta: {atencion.numero_boleta}
                              </div>
                            )}
                          </div>

                          <div className="flex justify-end items-center space-x-1 pt-1.5 border-t border-gray-100 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => toggleAsistencia(atencion, 'asistio')}
                              className={`p-1 rounded hover:bg-green-50 ${atencion.estado_asistencia === 'asistio' ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`}
                              title="Asistió"
                            >
                              <CheckCircle className="h-3 w-3" />
                            </button>
                            
                            <button
                              onClick={() => toggleAsistencia(atencion, 'no_asistio')}
                              className={`p-1 rounded hover:bg-red-50 ${atencion.estado_asistencia === 'no_asistio' ? 'text-red-600' : 'text-gray-400 hover:text-red-600'}`}
                              title="No Asistió"
                            >
                              <XCircle className="h-3 w-3" />
                            </button>

                            <button
                              onClick={() => {
                                const link = getWhatsAppLink(atencion)
                                if (link) window.open(link, '_blank')
                                else toast.error('Sin teléfono')
                              }}
                              className="p-1 rounded hover:bg-green-50 text-gray-400 hover:text-green-600"
                              title="WhatsApp"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </button>

                            {user?.rol === 'admin' && (
                                <button
                                  onClick={() => togglePago(atencion)}
                                  className={`p-1 rounded hover:bg-yellow-50 ${atencion.pagado ? 'text-green-600' : 'text-gray-400 hover:text-yellow-600'}`}
                                  title="Pago"
                                >
                                  <DollarSign className="h-3 w-3" />
                                </button>
                            )}

                            {(user?.rol === 'admin' || (user?.rol === 'profesional' && user.profesional_id === atencion.profesional_id)) && (
                              <>
                                <Link
                                  to={`/agenda/${atencion.id}`}
                                  className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"
                                  title="Editar"
                                >
                                  <Edit className="h-3 w-3" />
                                </Link>
                                <button
                                  onClick={() => deleteAtencion(atencion.id)}
                                  className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Agenda
