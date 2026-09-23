import { useState, useEffect, useMemo } from 'react'
import { atencionesService } from '@/utils/supabase'
import { Atencion, Paciente } from '@/types/database'
import { useSucursal } from '@/contexts/SucursalContext'
import { toast } from 'sonner'
import { CheckCircle2, Calendar, User, DollarSign, ChevronDown, ChevronUp, AlertCircle, MessageCircle, Search } from 'lucide-react'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCLP } from '@/utils/currency'
import { isBillableAtencion } from '@/utils/financial'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface PacienteConDeuda extends Paciente {
  atenciones_pendientes: Atencion[]
  total_deuda: number
}

interface MesConDeuda {
  mes: string
  anio: string
  clave: string
  total_deuda: number
  pacientes: PacienteConDeuda[]
}

const PagosPendientes = () => {
  const [mesesDeuda, setMesesDeuda] = useState<MesConDeuda[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMes, setExpandedMes] = useState<string | null>(null)
  const [expandedPaciente, setExpandedPaciente] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false)
  const [pacienteToMarkPaid, setPacienteToMarkPaid] = useState<PacienteConDeuda | null>(null)
  const { currentCentro, currentSucursal } = useSucursal()

  const normalizePhoneCL = (raw: string) => {
    let phone = raw.replace(/\D/g, '')
    if (phone.length === 9 && phone.startsWith('9')) return `56${phone}`
    if (phone.length === 8) return `569${phone}`
    return phone
  }

  const isOverdue = (atencion: Atencion) => {
    const atencionDate = parseISO(atencion.fecha)
    if (Number.isNaN(atencionDate.getTime())) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return atencionDate < today
  }

  const isOverdue3Days = (atencion: Atencion) => {
    const atencionDate = parseISO(atencion.fecha)
    if (Number.isNaN(atencionDate.getTime())) return false
    return differenceInCalendarDays(new Date(), atencionDate) >= 3
  }

  const isValidPendingPayment = (atencion: Atencion) => {
    if (atencion.pagado) return false
    return isBillableAtencion(atencion)
  }

  const getWhatsAppReminderLink = (paciente: PacienteConDeuda) => {
    if (!paciente.telefono) return null
    const phone = normalizePhoneCL(paciente.telefono)
    if (!phone) return null

    const atencionesAtrasadas = paciente.atenciones_pendientes
      .filter(a => isOverdue(a))
      .sort((a, b) => `${a.fecha}T${a.hora}`.localeCompare(`${b.fecha}T${b.hora}`))

    if (atencionesAtrasadas.length === 0) return null

    const total = atencionesAtrasadas.reduce((sum, a) => sum + (a.valor_cobrado || 0), 0)
    const detalle = atencionesAtrasadas
      .map((a, idx) => {
        const fechaStr = format(parseISO(a.fecha), "dd/MM/yyyy", { locale: es })
        const horaStr = a.hora?.substring(0, 5) || ''
        const tipo = a.tipos_atencion?.nombre || a.tipo_atencion || 'Sesión'
        const monto = formatCLP(a.valor_cobrado || 0)
        const tag = isOverdue3Days(a) ? ' (3+ días)' : ''
        return `${idx + 1}) ${fechaStr} ${horaStr} - ${tipo} - ${monto}${tag}`
      })
      .join('\n')

    const mensaje = `Hola ${paciente.nombre}, te escribo para recordar el pago de sesiones pendientes:\n\n${detalle}\n\nTotal pendiente: ${formatCLP(total)}\n\nSi ya realizaste el pago, por favor ignora este mensaje. Muchas gracias.`

    return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`
  }

  const loadPendientes = async () => {
    try {
      setLoading(true)
      const data = await atencionesService.getPendientes(currentSucursal?.id, currentCentro?.id)
      const filteredData = data.filter(isValidPendingPayment)
      
      // Agrupar atenciones por mes y luego por paciente
      const agrupadosPorMes = filteredData.reduce((acc, atencion) => {
        if (!atencion.paciente) return acc
        
        // Obtener el mes y año de la atención
        const fecha = new Date(`${atencion.fecha}T00:00:00`)
        const mesStr = format(fecha, 'MMMM', { locale: es })
        const anioStr = format(fecha, 'yyyy')
        const claveMes = `${anioStr}-${fecha.getMonth()}` // Para ordenar cronológicamente
        
        if (!acc[claveMes]) {
          acc[claveMes] = {
            mes: mesStr,
            anio: anioStr,
            clave: claveMes,
            total_deuda: 0,
            pacientes_map: {} as Record<string, PacienteConDeuda>
          }
        }
        
        const pacienteId = atencion.paciente.id
        if (!acc[claveMes].pacientes_map[pacienteId]) {
          acc[claveMes].pacientes_map[pacienteId] = {
            ...atencion.paciente,
            atenciones_pendientes: [],
            total_deuda: 0
          }
        }
        
        acc[claveMes].pacientes_map[pacienteId].atenciones_pendientes.push(atencion)
        acc[claveMes].pacientes_map[pacienteId].total_deuda += atencion.valor_cobrado
        acc[claveMes].total_deuda += atencion.valor_cobrado
        
        return acc
      }, {} as Record<string, any>)

      // Convertir a arrays y ordenar
      const arrayMeses = Object.values(agrupadosPorMes).map(mesGroup => {
        const pacientesArray = Object.values(mesGroup.pacientes_map as Record<string, PacienteConDeuda>).sort((a, b) => 
          a.nombre.localeCompare(b.nombre)
        )
        return {
          mes: mesGroup.mes,
          anio: mesGroup.anio,
          clave: mesGroup.clave,
          total_deuda: mesGroup.total_deuda,
          pacientes: pacientesArray
        } as MesConDeuda
      }).sort((a, b) => {
        // Ordenar meses del más reciente al más antiguo
        return b.clave.localeCompare(a.clave)
      })
      
      setMesesDeuda(arrayMeses)
      
      // Expandir el mes más reciente por defecto si hay datos
      if (arrayMeses.length > 0 && !expandedMes) {
        setExpandedMes(arrayMeses[0].clave)
      }
    } catch (error) {
      console.error('Error loading pagos pendientes:', error)
      toast.error('Error al cargar los pagos pendientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPendientes()
  }, [currentSucursal])

  const mesesFiltrados = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return mesesDeuda
      .map((mesGroup) => {
        const pacientes = mesGroup.pacientes
          .map((paciente) => {
            const atencionesPendientes = paciente.atenciones_pendientes.filter((atencion) => {
              const matchesSearch =
                normalizedSearch.length === 0 ||
                paciente.nombre.toLowerCase().includes(normalizedSearch) ||
                (paciente.rut || '').toLowerCase().includes(normalizedSearch) ||
                (paciente.telefono || '').toLowerCase().includes(normalizedSearch) ||
                (atencion.profesional?.nombre || '').toLowerCase().includes(normalizedSearch) ||
                (atencion.tipos_atencion?.nombre || atencion.tipo_atencion || '').toLowerCase().includes(normalizedSearch)

              const matchesOverdue = !showOnlyOverdue || isOverdue(atencion)

              return matchesSearch && matchesOverdue
            })

            if (atencionesPendientes.length === 0) return null

            return {
              ...paciente,
              atenciones_pendientes: atencionesPendientes,
              total_deuda: atencionesPendientes.reduce((sum, atencion) => sum + (atencion.valor_cobrado || 0), 0)
            }
          })
          .filter((paciente): paciente is PacienteConDeuda => paciente !== null)
          .sort((a, b) => a.nombre.localeCompare(b.nombre))

        if (pacientes.length === 0) return null

        return {
          ...mesGroup,
          pacientes,
          total_deuda: pacientes.reduce((sum, paciente) => sum + paciente.total_deuda, 0)
        }
      })
      .filter((mes): mes is MesConDeuda => mes !== null)
  }, [mesesDeuda, searchTerm, showOnlyOverdue])

  const totalDeudaFiltrada = useMemo(() => {
    return mesesFiltrados.reduce((sum, mes) => sum + mes.total_deuda, 0)
  }, [mesesFiltrados])

  const totalPacientesFiltrados = useMemo(() => {
    return mesesFiltrados.reduce((sum, mes) => sum + mes.pacientes.length, 0)
  }, [mesesFiltrados])

  const toggleExpandMes = (claveMes: string) => {
    setExpandedMes(expandedMes === claveMes ? null : claveMes)
  }

  const toggleExpandPaciente = (pacienteId: string) => {
    setExpandedPaciente(expandedPaciente === pacienteId ? null : pacienteId)
  }

  const handleMarcarPagado = async (atencionId: string) => {
    try {
      await atencionesService.setPagado(atencionId, true)
      toast.success('Pago registrado correctamente')
      loadPendientes() // Recargar para actualizar la lista
    } catch (error) {
      console.error('Error al registrar pago:', error)
      toast.error('No se pudo registrar el pago')
    }
  }

  const handleMarcarTodoPagado = async (paciente: PacienteConDeuda) => {
    try {
      const resultados = await Promise.allSettled(
        paciente.atenciones_pendientes.map(atencion =>
        atencionesService.setPagado(atencion.id, true)
        )
      )

      const exitos = resultados.filter((resultado) => resultado.status === 'fulfilled').length
      const fallidos = resultados.length - exitos

      setPacienteToMarkPaid(null)

      if (exitos > 0) {
        if (fallidos === 0) {
          toast.success(`Se registraron todos los pagos de ${paciente.nombre}`)
        } else {
          toast.warning(`Se marcaron ${exitos} sesiones como pagadas y ${fallidos} fallaron`)
        }
        loadPendientes()
        return
      }

      throw new Error('No se pudo registrar ningún pago del lote')
    } catch (error) {
      console.error('Error al registrar pagos:', error)
      toast.error('No se pudieron registrar todos los pagos')
    }
  }

  if (loading) {
    return <PageLoader label="Calculando pagos pendientes..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pagos Pendientes</h1>
          <p className="text-gray-600">Seguimiento de sesiones no abonadas por pacientes</p>
        </div>
        <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-lg font-semibold flex items-center shadow-sm">
          <AlertCircle className="w-5 h-5 mr-2" />
          Total Deuda Global: {formatCLP(
            totalDeudaFiltrada
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_auto] gap-4 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por paciente, RUT, teléfono, profesional o tipo de atención"
              className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-medical-blue focus:border-medical-blue"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showOnlyOverdue}
              onChange={(e) => setShowOnlyOverdue(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-medical-blue focus:ring-medical-blue"
            />
            Solo atrasadas
          </label>

          <div className="text-sm text-gray-600">
            {totalPacientesFiltrados} paciente(s)
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Esta vista excluye citas canceladas, reagendadas, bloques no clínicos y montos menores o iguales a $1.
        </p>
      </div>

      {mesesFiltrados.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Sin resultados pendientes"
          description="No hay registros pendientes con los filtros actuales. Prueba cambiando la búsqueda o quitando el filtro de atrasadas."
        />
      ) : (
        <div className="space-y-6">
          {mesesFiltrados.map((mesGroup) => (
            <div key={mesGroup.clave} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div 
                className="bg-medical-blue text-white p-4 cursor-pointer flex justify-between items-center transition-colors hover:bg-blue-700"
                onClick={() => toggleExpandMes(mesGroup.clave)}
              >
                <div className="flex items-center space-x-3">
                  <Calendar className="w-6 h-6" />
                  <h2 className="text-xl font-bold capitalize">{mesGroup.mes} {mesGroup.anio}</h2>
                  <span className="bg-white text-medical-blue text-xs font-bold px-2 py-1 rounded-full ml-3">
                    {mesGroup.pacientes.length} paciente(s)
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-xs text-blue-100 uppercase tracking-wider">Deuda del mes</p>
                    <p className="text-lg font-bold">{formatCLP(mesGroup.total_deuda)}</p>
                  </div>
                  {expandedMes === mesGroup.clave ? <ChevronUp /> : <ChevronDown />}
                </div>
              </div>

              {expandedMes === mesGroup.clave && (
                <div className="p-4 space-y-4 bg-gray-50">
                  {mesGroup.pacientes.map((paciente) => (
                    <div key={paciente.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-200">
                      <div 
                        className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center border-b border-transparent"
                        onClick={() => toggleExpandPaciente(paciente.id)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="bg-blue-100 p-3 rounded-full text-medical-blue">
                            <User className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-800">{paciente.nombre}</h3>
                            <p className="text-sm text-gray-500">
                              {paciente.atenciones_pendientes.length} sesión(es) pendiente(s)
                            </p>
                            <p className="text-xs text-red-600 font-medium mt-1">
                              {paciente.atenciones_pendientes.filter(a => isOverdue(a)).length} atrasada(s)
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6">
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Total a pagar</p>
                            <p className="text-lg font-bold text-red-600">{formatCLP(paciente.total_deuda)}</p>
                          </div>
                          <button className="text-gray-400 hover:text-gray-600">
                            {expandedPaciente === paciente.id ? <ChevronUp /> : <ChevronDown />}
                          </button>
                        </div>
                      </div>

                      {expandedPaciente === paciente.id && (
                        <div className="p-4 bg-gray-50 border-t border-gray-200">
                          <div className="flex flex-col sm:flex-row justify-end gap-2 mb-4">
                            {getWhatsAppReminderLink(paciente) && (
                              <button
                                onClick={() => {
                                  const link = getWhatsAppReminderLink(paciente)
                                  if (link) window.open(link, '_blank')
                                  else toast.error('Sin teléfono o sin sesiones atrasadas')
                                }}
                                className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm text-sm font-medium"
                              >
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Enviar recordatorio (WhatsApp)
                              </button>
                            )}
                            <button
                              onClick={() => setPacienteToMarkPaid(paciente)}
                              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm text-sm font-medium"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Marcar todo como pagado
                            </button>
                          </div>
                          
                          <div className="space-y-3">
                            {paciente.atenciones_pendientes.map((atencion) => (
                              <div key={atencion.id} className="bg-white p-4 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 mr-4">
                                  <div>
                                    <p className="text-xs text-gray-500 flex items-center"><Calendar className="w-3 h-3 mr-1"/> Fecha</p>
                                    <p className="text-sm font-medium text-gray-800">
                                      {format(new Date(`${atencion.fecha}T${atencion.hora}`), "dd 'de' MMMM yyyy, HH:mm", { locale: es })}
                                    </p>
                                    {isOverdue3Days(atencion) && (
                                      <p className="text-[10px] text-red-600 font-semibold mt-1">Atrasado 3+ días</p>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 flex items-center"><User className="w-3 h-3 mr-1"/> Profesional</p>
                                    <p className="text-sm font-medium text-gray-800">{atencion.profesional?.nombre}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Tipo de Atención</p>
                                    <p className="text-sm font-medium text-gray-800">
                                      {atencion.tipos_atencion?.nombre || atencion.tipo_atencion}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 flex items-center"><DollarSign className="w-3 h-3 mr-1"/> Valor</p>
                                    <p className="text-sm font-bold text-gray-800">{formatCLP(atencion.valor_cobrado)}</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleMarcarPagado(atencion.id)}
                                  className="px-3 py-1.5 bg-medical-blue text-white text-sm rounded hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap flex items-center"
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  Pagó
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pacienteToMarkPaid}
        title="Marcar sesiones como pagadas"
        description={pacienteToMarkPaid ? `Vas a marcar como pagadas todas las sesiones pendientes de ${pacienteToMarkPaid.nombre}.` : ''}
        confirmLabel="Marcar todo pagado"
        cancelLabel="Cancelar"
        tone="primary"
        onCancel={() => setPacienteToMarkPaid(null)}
        onConfirm={() => {
          if (pacienteToMarkPaid) {
            void handleMarcarTodoPagado(pacienteToMarkPaid)
          }
        }}
      />
    </div>
  )
}

export default PagosPendientes
