import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, DollarSign, TrendingDown, Home, Wrench, ArrowUpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useSucursal } from '@/contexts/SucursalContext'
import { Costo } from '@/types/database'
import { costosService } from '@/utils/supabase'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCLP } from '@/utils/currency'
import CostoForm from './CostoForm'

const Costos = () => {
  const { currentSucursal } = useSucursal()
  const [costos, setCostos] = useState<Costo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTipo, setSelectedTipo] = useState<'todos' | 'fijo' | 'variable' | 'aporte'>('todos')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [showForm, setShowForm] = useState(false)
  const [editingCosto, setEditingCosto] = useState<Costo | undefined>()

  useEffect(() => {
    if (currentSucursal) {
      loadCostos()
    }
  }, [selectedTipo, selectedMonth, currentSucursal])

  const loadCostos = async () => {
    try {
      setLoading(true)
      
      const [year, month] = selectedMonth.split('-').map(Number)
      const lastDay = new Date(year, month, 0).getDate()
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`

      let data = await costosService.getByDateRange(startDate, endDate, currentSucursal?.id)
      
      // Filtrar por tipo
      if (selectedTipo !== 'todos') {
        data = data.filter(costo => costo.tipo === selectedTipo)
      }
      
      setCostos(data)
    } catch (error) {
      toast.error('Error al cargar costos')
      console.error('Error loading costos:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteCosto = async (id: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este costo?')) {
      return
    }

    try {
      await costosService.delete(id)
      toast.success('Costo eliminado exitosamente')
      loadCostos()
    } catch (error) {
      toast.error('Error al eliminar costo')
      console.error('Error deleting costo:', error)
    }
  }

  const handleNewCosto = () => {
    setEditingCosto(undefined)
    setShowForm(true)
  }

  const handleEditCosto = (costo: Costo) => {
    setEditingCosto(costo)
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingCosto(undefined)
    loadCostos()
  }

  const handleFormCancel = () => {
    setShowForm(false)
    setEditingCosto(undefined)
  }

  const calcularTotales = () => {
    const costosFijos = costos.filter(c => c.tipo === 'fijo')
    const costosVariables = costos.filter(c => c.tipo === 'variable')
    const aportes = costos.filter(c => c.tipo === 'aporte')
    
    return {
      totalFijos: costosFijos.reduce((sum, c) => sum + c.monto, 0),
      totalVariables: costosVariables.reduce((sum, c) => sum + c.monto, 0),
      totalAportes: aportes.reduce((sum, c) => sum + c.monto, 0),
      totalGastos: (costosFijos.reduce((sum, c) => sum + c.monto, 0) + costosVariables.reduce((sum, c) => sum + c.monto, 0))
    }
  }

  const totales = calcularTotales()

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
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Costos</h1>
        <button
          onClick={handleNewCosto}
          className="bg-medical-blue hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Nuevo Registro</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mes</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Registro</label>
            <select
              value={selectedTipo}
              onChange={(e) => setSelectedTipo(e.target.value as 'todos' | 'fijo' | 'variable' | 'aporte')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-medical-blue focus:border-medical-blue"
            >
              <option value="todos">Todos</option>
              <option value="fijo">Costos Fijos</option>
              <option value="variable">Costos Variables</option>
              <option value="aporte">Aportes (Ingresos)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resumen financiero */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Aportes (Ingresos)</p>
              <p className="text-3xl font-bold text-green-600">{formatCLP(totales.totalAportes)}</p>
            </div>
            <div className="bg-green-600 text-white rounded-full p-3">
              <ArrowUpCircle className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Costos Fijos</p>
              <p className="text-3xl font-bold text-blue-600">{formatCLP(totales.totalFijos)}</p>
            </div>
            <div className="bg-blue-600 text-white rounded-full p-3">
              <Home className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Costos Variables</p>
              <p className="text-3xl font-bold text-orange-600">{formatCLP(totales.totalVariables)}</p>
            </div>
            <div className="bg-orange-600 text-white rounded-full p-3">
              <TrendingDown className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Gastos</p>
              <p className="text-3xl font-bold text-red-600">{formatCLP(totales.totalGastos)}</p>
            </div>
            <div className="bg-red-600 text-white rounded-full p-3">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Lista de costos */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Costos - {format(new Date(selectedMonth), 'MMMM yyyy', { locale: es })}
        </h2>
        
        {costos.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No hay costos registrados para este período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recurrente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {costos.map(costo => (
                  <tr key={costo.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(parseISO(costo.fecha), 'dd/MM/yyyy', { locale: es })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        costo.tipo === 'fijo' 
                          ? 'bg-blue-100 text-blue-800' 
                          : costo.tipo === 'variable'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {costo.tipo === 'fijo' ? 'Fijo' : costo.tipo === 'variable' ? 'Variable' : 'Aporte'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {costo.categoria}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {costo.descripcion}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCLP(costo.monto)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        costo.recurrente 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {costo.recurrente ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditCosto(costo)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteCosto(costo.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Categorías sugeridas */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Categorías Sugeridas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h3 className="font-medium text-gray-700 mb-2 flex items-center">
              <ArrowUpCircle className="h-4 w-4 mr-2 text-green-600" />
              Aportes (Ingresos)
            </h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Inversión inicial</li>
              <li>• Aporte extraordinario</li>
              <li>• Préstamo de socio</li>
              <li>• Otros aportes</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-700 mb-2 flex items-center">
              <Home className="h-4 w-4 mr-2 text-blue-600" />
              Costos Fijos Comunes
            </h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Alquiler del local</li>
              <li>• Servicios (luz, agua, gas)</li>
              <li>• Sueldos administrativos</li>
              <li>• Seguros</li>
              <li>• Mantenimiento mensual</li>
              <li>• Suscripciones software</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-700 mb-2 flex items-center">
              <Wrench className="h-4 w-4 mr-2 text-orange-600" />
              Costos Variables Comunes
            </h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Insumos médicos</li>
              <li>• Gastos de oficina</li>
              <li>• Marketing y publicidad</li>
              <li>• Reparaciones eventuales</li>
              <li>• Gastos de transporte</li>
              <li>• Eventos y capacitaciones</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <CostoForm
          costo={editingCosto}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  )
}

export default Costos