import React, { useState, useEffect } from 'react'
import { atencionesService } from '@/utils/supabase'
import { Atencion, Paciente } from '@/types/database'
import { useSucursal } from '@/contexts/SucursalContext'
import { toast } from 'sonner'
import { CheckCircle2, Calendar, User, DollarSign, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency } from '@/utils/currency'

interface PacienteConDeuda extends Paciente {
  atenciones_pendientes: Atencion[]
  total_deuda: number
}

const PagosPendientes = () => {
  const [pacientesDeuda, setPacientesDeuda] = useState<PacienteConDeuda[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPaciente, setExpandedPaciente] = useState<string | null>(null)
  const { sucursal } = useSucursal()

  const loadPendientes = async () => {
    try {
      setLoading(true)
      const data = await atencionesService.getPendientes(sucursal?.id)
      
      // Agrupar atenciones por paciente
      const agrupados = data.reduce((acc, atencion) => {
        if (!atencion.paciente) return acc
        
        const pacienteId = atencion.paciente.id
        if (!acc[pacienteId]) {
          acc[pacienteId] = {
            ...atencion.paciente,
            atenciones_pendientes: [],
            total_deuda: 0
          }
        }
        
        acc[pacienteId].atenciones_pendientes.push(atencion)
        acc[pacienteId].total_deuda += atencion.valor_cobrado
        
        return acc
      }, {} as Record<string, PacienteConDeuda>)

      // Convertir a array y ordenar por nombre
      const arrayPacientes = Object.values(agrupados).sort((a, b) => 
        a.nombre.localeCompare(b.nombre)
      )
      
      setPacientesDeuda(arrayPacientes)
    } catch (error) {
      console.error('Error loading pagos pendientes:', error)
      toast.error('Error al cargar los pagos pendientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPendientes()
  }, [sucursal])

  const toggleExpand = (pacienteId: string) => {
    setExpandedPaciente(expandedPaciente === pacienteId ? null : pacienteId)
  }

  const handleMarcarPagado = async (atencionId: string) => {
    try {
      await atencionesService.update(atencionId, { pagado: true })
      toast.success('Pago registrado correctamente')
      loadPendientes() // Recargar para actualizar la lista
    } catch (error) {
      console.error('Error al registrar pago:', error)
      toast.error('No se pudo registrar el pago')
    }
  }

  const handleMarcarTodoPagado = async (paciente: PacienteConDeuda) => {
    if (!window.confirm(`¿Estás seguro de marcar como pagadas todas las sesiones pendientes de ${paciente.nombre}?`)) {
      return
    }

    try {
      // Actualizar todas las atenciones del paciente a pagado: true
      const promesas = paciente.atenciones_pendientes.map(atencion => 
        atencionesService.update(atencion.id, { pagado: true })
      )
      await Promise.all(promesas)
      
      toast.success(`Se registraron todos los pagos de ${paciente.nombre}`)
      loadPendientes() // Recargar para actualizar la lista
    } catch (error) {
      console.error('Error al registrar pagos:', error)
      toast.error('No se pudieron registrar todos los pagos')
    }
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
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pagos Pendientes</h1>
          <p className="text-gray-600">Seguimiento de sesiones no abonadas por pacientes</p>
        </div>
        <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-lg font-semibold flex items-center shadow-sm">
          <AlertCircle className="w-5 h-5 mr-2" />
          Total Deuda Global: {formatCurrency(
            pacientesDeuda.reduce((sum, p) => sum + p.total_deuda, 0)
          )}
        </div>
      </div>

      {pacientesDeuda.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-10 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">¡Todo al día!</h2>
          <p className="text-gray-600">No hay pagos pendientes registrados en el sistema.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pacientesDeuda.map((paciente) => (
            <div key={paciente.id} className="bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200">
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center border-b border-transparent"
                onClick={() => toggleExpand(paciente.id)}
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
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total a pagar</p>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(paciente.total_deuda)}</p>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    {expandedPaciente === paciente.id ? <ChevronUp /> : <ChevronDown />}
                  </button>
                </div>
              </div>

              {expandedPaciente === paciente.id && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => handleMarcarTodoPagado(paciente)}
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
                              {format(new Date(`${atencion.fecha}T${atencion.hora}`), "dd 'de' MMMM, HH:mm", { locale: es })}
                            </p>
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
                            <p className="text-sm font-bold text-gray-800">{formatCurrency(atencion.valor_cobrado)}</p>
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
  )
}

export default PagosPendientes
