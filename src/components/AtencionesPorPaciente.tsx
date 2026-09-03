import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, User, DollarSign, FileText, Edit } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'
import { useSucursal } from '@/contexts/SucursalContext'
import { Atencion, Paciente } from '@/types/database'
import { atencionesService, pacientesService } from '@/utils/supabase'
import { formatCLP } from '@/utils/currency'
import { getEstadoCitaBadgeClass, getEstadoCitaLabel } from '@/utils/atencionEstado'

const AtencionesPorPaciente = () => {
  const { user } = useAuth()
  const { currentCentro, currentSucursal } = useSucursal()

  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loadingPacientes, setLoadingPacientes] = useState(true)

  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null)
  const [pacienteSearch, setPacienteSearch] = useState('')
  const [showPacienteOptions, setShowPacienteOptions] = useState(false)

  const [atenciones, setAtenciones] = useState<Atencion[]>([])
  const [loadingAtenciones, setLoadingAtenciones] = useState(false)
  const [pagoFilter, setPagoFilter] = useState<'todos' | 'pagadas' | 'pendientes'>('todos')

  useEffect(() => {
    loadPacientes()
    setSelectedPaciente(null)
    setPacienteSearch('')
    setAtenciones([])
  }, [currentSucursal])

  const loadPacientes = async () => {
    try {
      setLoadingPacientes(true)
      const data = await pacientesService.getAll(currentSucursal?.id, currentCentro?.id)
      setPacientes(data)
    } catch (error) {
      toast.error('Error al cargar pacientes')
      console.error('Error loading pacientes:', error)
    } finally {
      setLoadingPacientes(false)
    }
  }

  const loadAtenciones = async (paciente: Paciente) => {
    try {
      setLoadingAtenciones(true)
      const profesionalId = user?.rol === 'profesional' ? user.profesional_id : undefined
      const data = await atencionesService.getByPacienteId(paciente.id, currentSucursal?.id, profesionalId, currentCentro?.id)
      setAtenciones(data)
    } catch (error) {
      toast.error('Error al cargar atenciones')
      console.error('Error loading atenciones by paciente:', error)
    } finally {
      setLoadingAtenciones(false)
    }
  }

  const togglePago = async (atencion: Atencion) => {
    if (user?.rol !== 'admin') return

    const estadoCita = atencion.estado_cita || 'por_confirmar'
    if (estadoCita === 'cancelada' || estadoCita === 'reagendada') {
      toast.error(`No puedes marcar pago en una cita ${getEstadoCitaLabel(estadoCita).toLowerCase()}`)
      return
    }

    try {
      const nuevoEstado = !atencion.pagado
      await atencionesService.update(atencion.id, { pagado: nuevoEstado })
      toast.success(`Pago marcado como ${nuevoEstado ? 'Pagado' : 'Pendiente'}`)
      if (selectedPaciente) await loadAtenciones(selectedPaciente)
    } catch (error) {
      toast.error('Error al actualizar estado de pago')
      console.error('Error toggling payment:', error)
    }
  }

  const pacientesFiltrados = useMemo(() => {
    const term = pacienteSearch.trim().toLowerCase()
    if (!term) return pacientes
    return pacientes.filter(p =>
      p.nombre.toLowerCase().includes(term) ||
      p.rut.toLowerCase().includes(term)
    )
  }, [pacienteSearch, pacientes])

  const atencionesFiltradas = useMemo(() => {
    if (pagoFilter === 'pagadas') return atenciones.filter(a => a.pagado)
    if (pagoFilter === 'pendientes') return atenciones.filter(a => !a.pagado)
    return atenciones
  }, [atenciones, pagoFilter])

  if (loadingPacientes) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Atenciones por Paciente</h1>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Paciente</label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={pacienteSearch}
                onChange={(e) => {
                  setPacienteSearch(e.target.value)
                  setShowPacienteOptions(true)
                  if (e.target.value === '') {
                    setSelectedPaciente(null)
                    setAtenciones([])
                  }
                }}
                onFocus={() => setShowPacienteOptions(true)}
                onBlur={() => setTimeout(() => setShowPacienteOptions(false), 200)}
                placeholder="Buscar por nombre o RUT..."
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
                autoComplete="off"
              />

              {showPacienteOptions && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {pacientesFiltrados.length > 0 ? (
                    pacientesFiltrados.map(paciente => (
                      <div
                        key={paciente.id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => {
                          setSelectedPaciente(paciente)
                          setPacienteSearch(paciente.nombre)
                          setShowPacienteOptions(false)
                          loadAtenciones(paciente)
                        }}
                      >
                        <div className="font-medium">{paciente.nombre}</div>
                        <div className="text-gray-500 text-xs">RUT: {paciente.rut}</div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-gray-500 text-sm">No se encontraron pacientes</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado de Pago</label>
            <select
              value={pagoFilter}
              onChange={(e) => setPagoFilter(e.target.value as 'todos' | 'pagadas' | 'pendientes')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
              disabled={!selectedPaciente}
            >
              <option value="todos">Todos</option>
              <option value="pagadas">Pagadas</option>
              <option value="pendientes">Pendientes</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        {!selectedPaciente ? (
          <div className="text-center py-10">
            <Search className="h-14 w-14 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Busca y selecciona un paciente para ver sus atenciones</p>
          </div>
        ) : loadingAtenciones ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
          </div>
        ) : atencionesFiltradas.length === 0 ? (
          <div className="text-center py-10">
            <FileText className="h-14 w-14 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No hay atenciones para este paciente con el filtro seleccionado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                  {!user?.profesional_id && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profesional</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cita</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pago</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boleta</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {atencionesFiltradas.map((atencion) => (
                  <tr key={atencion.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(parseISO(atencion.fecha), 'dd/MM/yyyy', { locale: es })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {atencion.hora?.substring(0, 5)}
                    </td>
                    {!user?.profesional_id && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {atencion.profesional?.nombre || '-'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {atencion.tipos_atencion?.nombre || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getEstadoCitaBadgeClass(atencion.estado_cita)}`}>
                        {getEstadoCitaLabel(atencion.estado_cita)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatCLP(atencion.valor_cobrado)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          atencion.pagado ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        <DollarSign className="h-3 w-3 mr-1" />
                        {atencion.pagado ? 'Pagado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {atencion.numero_boleta || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <div className="flex justify-end space-x-3">
                        {user?.rol === 'admin' && (
                          <button
                            onClick={() => togglePago(atencion)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Cambiar estado de pago"
                          >
                            <DollarSign className="h-4 w-4" />
                          </button>
                        )}
                        <Link
                          to={`/agenda/${atencion.id}`}
                          className="text-blue-600 hover:text-blue-800"
                          title="Ver / Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default AtencionesPorPaciente
