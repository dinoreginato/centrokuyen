import { useState } from 'react'
import { Database, Plus, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { seedDatabase } from '@/utils/seedData'

const DataSeeder = () => {
  const [loading, setLoading] = useState(false)
  const [completed, setCompleted] = useState(false)

  const handleSeedData = async () => {
    try {
      setLoading(true)
      await seedDatabase()
      setCompleted(true)
      toast.success('✅ Datos de prueba insertados exitosamente!')
    } catch (error) {
      console.error('Error al insertar datos de prueba:', error)
      toast.error('❌ Error al insertar datos de prueba')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-4">
        <Database className="h-6 w-6 text-medical-blue mr-2" />
        <h2 className="text-lg font-semibold text-gray-800">Datos de Prueba</h2>
      </div>
      
      <div className="space-y-4">
        <p className="text-gray-600">
          Inserta datos de prueba en el sistema para poder ver todas las funcionalidades en acción.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-2">Datos que se insertarán:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 5 profesionales médicos (Medicina General, Pediatría, Dermatología, Ginecología, Cardiología)</li>
            <li>• 8 pacientes con datos completos y RUT chileno</li>
            <li>• 6 tipos de atención con valores base</li>
            <li>• 20 citas distribuidas en las próximas 2 semanas</li>
            <li>• 6 costos fijos y variables del centro</li>
          </ul>
        </div>

        {completed && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="bg-green-100 rounded-full p-1 mr-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-green-800 font-medium">
                ¡Datos insertados correctamente! Puedes explorar todas las secciones del sistema.
              </p>
            </div>
          </div>
        )}
        
        <button
          onClick={handleSeedData}
          disabled={loading || completed}
          className={`w-full flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors ${
            loading || completed
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-medical-blue text-white hover:bg-medical-dark'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Insertando datos...
            </>
          ) : completed ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Datos insertados
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Insertar datos de prueba
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default DataSeeder