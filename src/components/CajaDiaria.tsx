import { useEffect, useMemo, useState } from 'react'
import { Calendar, Clock, CreditCard, DollarSign, User, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'
import { useSucursal } from '@/contexts/SucursalContext'
import { Atencion, Profesional } from '@/types/database'
import { atencionesService, profesionalesService } from '@/utils/supabase'
import { formatCLP } from '@/utils/currency'
import { getEstadoCitaBadgeClass, getEstadoCitaLabel } from '@/utils/atencionEstado'
import { getBloqueoBadgeClass, getBloqueoLabel } from '@/utils/bloqueos'
import { isActiveClinicalAtencion, isBillableAtencion, sumFinancialAmounts } from '@/utils/financial'

const CajaDiaria = () => {
  const { user } = useAuth()
  const { currentSucursal } = useSucursal()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedProfesional, setSelectedProfesional] = useState('todos')
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [atenciones, setAtenciones] = useState<Atencion[]>([])
  const [loading, setLoading] = useState(true)

  const isProfesional = user?.rol === 'profesional' && !!user.profesional_id

  useEffect(() => {
    if (!currentSucursal?.id) return
    loadData()
  }, [currentSucursal?.id, selectedDate])

  const loadData = async () => {
    if (!currentSucursal?.id) return

    try {
      setLoading(true)
      const [atencionesData, profesionalesData] = await Promise.all([
        atencionesService.getByDateRange(selectedDate, selectedDate, currentSucursal.id),
        profesionalesService.getAll(currentSucursal.id)
      ])

      const filteredProfesionales = isProfesional
        ? profesionalesData.filter(p => p.id === user?.profesional_id)
        : profesionalesData

      setProfesionales(filteredProfesionales)
      if (isProfesional && user?.profesional_id) {
        setSelectedProfesional(user.profesional_id)
      }

      setAtenciones(atencionesData)
    } catch (error) {
      toast.error('Error al cargar caja diaria')
      console.error('Error loading caja diaria:', error)
    } finally {
      setLoading(false)
    }
  }

  const atencionesFiltradas = useMemo(() => {
    return atenciones.filter(atencion => {
      if (selectedProfesional === 'todos') return true
      return atencion.profesional_id === selectedProfesional
    })
  }, [atenciones, selectedProfesional])

  const atencionesClinicas = useMemo(() => {
    return atencionesFiltradas.filter(a => !a.es_bloqueo)
  }, [atencionesFiltradas])

  const atencionesActivas = useMemo(() => {
    return atencionesClinicas.filter(isActiveClinicalAtencion)
  }, [atencionesClinicas])

  const atencionesFacturables = useMemo(() => {
    return atencionesActivas.filter(isBillableAtencion)
  }, [atencionesActivas])

  const bloqueos = useMemo(() => {
    return atencionesFiltradas.filter(a => a.es_bloqueo)
  }, [atencionesFiltradas])

  const resumen = useMemo(() => {
    const cobrado = atencionesActivas
      .filter(a => a.pagado)
      .filter(isBillableAtencion)

    const pendiente = atencionesActivas
      .filter(a => !a.pagado)
      .filter(isBillableAtencion)

    const proyectado = sumFinancialAmounts(atencionesFacturables)

    return {
      totalAtenciones: atencionesClinicas.length,
      activas: atencionesActivas.length,
      cobrado: sumFinancialAmounts(cobrado),
      pendiente: sumFinancialAmounts(pendiente),
      proyectado,
      bloqueos: bloqueos.length
    }
  }, [atencionesClinicas, atencionesActivas, atencionesFacturables, bloqueos])

  const resumenPorProfesional = useMemo(() => {
    const grouped = new Map<string, {
      profesional: string
      atenciones: number
      cobrado: number
      pendiente: number
    }>()

    atencionesActivas.forEach(atencion => {
      const key = atencion.profesional_id
      const current = grouped.get(key) || {
        profesional: atencion.profesional?.nombre || 'Sin profesional',
        atenciones: 0,
        cobrado: 0,
        pendiente: 0
      }

      current.atenciones += 1
      if (isBillableAtencion(atencion)) {
        if (atencion.pagado) current.cobrado += atencion.valor_cobrado
        else current.pendiente += atencion.valor_cobrado
      }

      grouped.set(key, current)
    })

    return Array.from(grouped.values()).sort((a, b) => b.cobrado - a.cobrado)
  }, [atencionesActivas])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Caja Diaria</h1>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
            />
          </div>

          {!isProfesional && (
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
          )}
        </div>
      </div>

      <div className="text-sm text-gray-500 capitalize">
        {format(parseISO(selectedDate), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-md p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cobrado</p>
              <p className="text-2xl font-bold text-green-600">{formatCLP(resumen.cobrado)}</p>
            </div>
            <div className="bg-green-100 text-green-700 rounded-full p-3">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pendiente</p>
              <p className="text-2xl font-bold text-amber-600">{formatCLP(resumen.pendiente)}</p>
            </div>
            <div className="bg-amber-100 text-amber-700 rounded-full p-3">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Proyectado día</p>
              <p className="text-2xl font-bold text-medical-blue">{formatCLP(resumen.proyectado)}</p>
            </div>
            <div className="bg-blue-100 text-blue-700 rounded-full p-3">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Atenciones</p>
              <p className="text-2xl font-bold text-gray-800">{resumen.activas}</p>
              <p className="text-xs text-gray-500">Total registros: {resumen.totalAtenciones}</p>
            </div>
            <div className="bg-slate-100 text-slate-700 rounded-full p-3">
              <User className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Bloques</p>
              <p className="text-2xl font-bold text-orange-600">{resumen.bloqueos}</p>
            </div>
            <div className="bg-orange-100 text-orange-700 rounded-full p-3">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {!isProfesional && resumenPorProfesional.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumen por Profesional</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profesional</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Atenciones</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cobrado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pendiente</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {resumenPorProfesional.map(item => (
                  <tr key={item.profesional}>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.profesional}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.atenciones}</td>
                    <td className="px-4 py-3 text-sm text-green-700 font-medium">{formatCLP(item.cobrado)}</td>
                    <td className="px-4 py-3 text-sm text-amber-700 font-medium">{formatCLP(item.pendiente)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Detalle de Atenciones del Día</h2>
        {atencionesClinicas.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No hay atenciones clínicas para la fecha seleccionada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paciente</th>
                  {!isProfesional && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profesional</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cita</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pago</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {atencionesClinicas
                  .sort((a, b) => a.hora.localeCompare(b.hora))
                  .map(atencion => (
                    <tr key={atencion.id} className={atencion.estado_cita === 'cancelada' ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3 text-sm text-gray-900">{atencion.hora.substring(0, 5)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{atencion.paciente?.nombre || '-'}</td>
                      {!isProfesional && (
                        <td className="px-4 py-3 text-sm text-gray-700">{atencion.profesional?.nombre || '-'}</td>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-700">{atencion.tipos_atencion?.nombre || atencion.tipo_atencion}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getEstadoCitaBadgeClass(atencion.estado_cita)}`}>
                          {getEstadoCitaLabel(atencion.estado_cita)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${atencion.pagado ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                          {atencion.pagado ? 'Pagado' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCLP(atencion.valor_cobrado)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Bloques del Día</h2>
        {bloqueos.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No hay bloques no clínicos para la fecha seleccionada.</div>
        ) : (
          <div className="space-y-3">
            {bloqueos
              .sort((a, b) => a.hora.localeCompare(b.hora))
              .map(bloqueo => (
                <div key={bloqueo.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900">{bloqueo.hora.substring(0, 5)}</div>
                    <div className="text-sm text-gray-600">{bloqueo.profesional?.nombre || '-'}</div>
                    {bloqueo.observaciones && (
                      <div className="text-sm text-gray-500 mt-1">{bloqueo.observaciones}</div>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border w-fit ${getBloqueoBadgeClass(bloqueo.tipo_bloqueo)}`}>
                    {getBloqueoLabel(bloqueo.tipo_bloqueo)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CajaDiaria
