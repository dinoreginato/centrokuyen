import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { DollarSign, TrendingUp, Users, Activity } from 'lucide-react'
import { profesionalesService, atencionesService } from '@/utils/supabase'
import { useSucursal } from '@/contexts/SucursalContext'
import { format as dateFormat, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCLP } from '@/utils/currency'
import { Atencion } from '@/types/database'
import { isBillableAtencion, sumFinancialAmounts } from '@/utils/financial'

interface ChartData {
  month: string
  atenciones: number
  ingresos: number
}

interface ProfessionalData {
  name: string
  atenciones: number
  ingresos: number
}

interface PaymentStatusData {
  name: string
  value: number
  color: string
}

interface DashboardChartsProps {
  profesionalId?: string
}

const DashboardCharts = ({ profesionalId }: DashboardChartsProps) => {
  const { currentSucursal } = useSucursal()
  const [monthlyData, setMonthlyData] = useState<ChartData[]>([])
  const [professionalData, setProfessionalData] = useState<ProfessionalData[]>([])
  const [paymentStatusData, setPaymentStatusData] = useState<PaymentStatusData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChartData()
  }, [currentSucursal, profesionalId])

  const loadChartData = async () => {
    try {
      setLoading(true)
      
      const monthlyStats = await loadMonthlyData()
      // Si es profesional, cargamos desglose por tipo, si no, top profesionales
      const professionalStats = profesionalId ? await loadTypeData() : await loadProfessionalData()
      const paymentStats = await loadPaymentStatusData()
      
      setMonthlyData(monthlyStats)
      setProfessionalData(professionalStats)
      setPaymentStatusData(paymentStats)
    } catch (error) {
      console.error('Error loading chart data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFinancialAtenciones = (items: Atencion[]) => {
    return items.filter(isBillableAtencion)
  }

  const loadMonthlyData = async (): Promise<ChartData[]> => {
    const data: ChartData[] = []
    
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i)
      const startDate = startOfMonth(date)
      const endDate = endOfMonth(date)
      
      const startStr = dateFormat(startDate, 'yyyy-MM-dd')
      const endStr = dateFormat(endDate, 'yyyy-MM-dd')
      
      const atenciones = await atencionesService.getByDateRange(startStr, endStr, currentSucursal?.id)
      const filtered = profesionalId ? atenciones.filter(a => a.profesional_id === profesionalId) : atenciones
      const active = getFinancialAtenciones(filtered)
      
      const ingresos = sumFinancialAmounts(active.filter(a => a.pagado))
      
      data.push({
        month: dateFormat(date, 'MMM yyyy', { locale: es }),
        atenciones: active.length,
        ingresos: ingresos
      })
    }
    
    return data
  }

  const loadProfessionalData = async (): Promise<ProfessionalData[]> => {
    const profesionales = await profesionalesService.getAll()
    const currentMonth = new Date()
    const startDate = dateFormat(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const endDate = dateFormat(endOfMonth(currentMonth), 'yyyy-MM-dd')
    
    const atenciones = getFinancialAtenciones(await atencionesService.getByDateRange(startDate, endDate, currentSucursal?.id))
    
    const data = profesionales.map(profesional => {
      const atencionesProf = atenciones.filter(a => a.profesional_id === profesional.id)
      const ingresos = sumFinancialAmounts(atencionesProf.filter(a => a.pagado))
      
      return {
        name: profesional.nombre.split(' ')[0], // Primer nombre
        atenciones: atencionesProf.length,
        ingresos: ingresos
      }
    }).filter(p => p.atenciones > 0) // Solo mostrar profesionales con atenciones
    
    return data.sort((a, b) => b.atenciones - a.atenciones).slice(0, 5) // Top 5
  }

  const loadTypeData = async (): Promise<ProfessionalData[]> => {
    const currentMonth = new Date()
    const startDate = dateFormat(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const endDate = dateFormat(endOfMonth(currentMonth), 'yyyy-MM-dd')
    
    const atenciones = getFinancialAtenciones(await atencionesService.getByDateRange(startDate, endDate, currentSucursal?.id))
    const filtered = atenciones.filter(a => a.profesional_id === profesionalId)

    // Group by tipo_atencion
    const groups: {[key: string]: {atenciones: number, ingresos: number}} = {}
    
    filtered.forEach(a => {
        const typeName = a.tipos_atencion?.nombre || 'Sin tipo'
        if (!groups[typeName]) {
            groups[typeName] = { atenciones: 0, ingresos: 0 }
        }
        groups[typeName].atenciones += 1
        if (a.pagado) {
          groups[typeName].ingresos += a.valor_cobrado
        }
    })

    return Object.entries(groups).map(([name, stats]) => ({
        name,
        atenciones: stats.atenciones,
        ingresos: stats.ingresos
    })).sort((a, b) => b.atenciones - a.atenciones)
  }

  const loadPaymentStatusData = async (): Promise<PaymentStatusData[]> => {
    const currentMonth = new Date()
    const startDate = dateFormat(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const endDate = dateFormat(endOfMonth(currentMonth), 'yyyy-MM-dd')
    
    const atenciones = getFinancialAtenciones(await atencionesService.getByDateRange(startDate, endDate, currentSucursal?.id))
    const filtered = profesionalId ? atenciones.filter(a => a.profesional_id === profesionalId) : atenciones
    
    const pagadas = filtered.filter(a => a.pagado).length
    const pendientes = filtered.filter(a => !a.pagado && a.estado_asistencia !== 'no_asistio').length
    
    return [
      {
        name: 'Pagadas',
        value: pagadas,
        color: '#10b981' // green-500
      },
      {
        name: 'Pendientes',
        value: pendientes,
        color: '#f59e0b' // amber-500
      }
    ]
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-lg shadow-md p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Gráfico de tendencias mensuales */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-6 w-6 text-medical-blue mr-2" />
          <h3 className="text-lg font-semibold text-gray-800">Tendencias de los Últimos 6 Meses</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value, name) => [
                name === 'ingresos' ? formatCLP(Number(value)) : value,
                name === 'atenciones' ? 'Atenciones' : 'Ingresos'
              ]} />
              <Line 
                type="monotone" 
                dataKey="atenciones" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="atenciones"
              />
              <Line 
                type="monotone" 
                dataKey="ingresos" 
                stroke="#10b981" 
                strokeWidth={2}
                name="ingresos"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top profesionales del mes */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            {profesionalId ? (
                <Activity className="h-6 w-6 text-medical-green mr-2" />
            ) : (
                <Users className="h-6 w-6 text-medical-green mr-2" />
            )}
            <h3 className="text-lg font-semibold text-gray-800">
                {profesionalId ? 'Atenciones por Tipo' : 'Top Profesionales del Mes'}
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={professionalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="atenciones" fill="#059669" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Estado de pagos */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <DollarSign className="h-6 w-6 text-orange-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Estado de Pagos del Mes</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardCharts
