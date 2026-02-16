import { seedDatabase } from './seedData'

// Función global para ejecutar desde la consola del navegador
export const runDataSeeding = async () => {
  console.log('🚀 Ejecutando inserción de datos de prueba...')
  console.log('📋 Esto insertará:')
  console.log('• 5 profesionales médicos')
  console.log('• 8 pacientes con RUT chileno')
  console.log('• 6 tipos de atención')
  console.log('• 20 citas para las próximas 2 semanas')
  console.log('• 6 costos fijos y variables')
  console.log('• Configuración del Centro Kuyen')
  
  try {
    await seedDatabase()
    console.log('✅ ¡Datos insertados exitosamente!')
    console.log('🔄 Por favor, actualiza la página para ver los cambios.')
    return true
  } catch (error) {
    console.error('❌ Error al insertar datos:', error)
    return false
  }
}

// Hacer la función disponible globalmente
declare global {
  interface Window {
    runDataSeeding: () => Promise<boolean>
  }
}

if (typeof window !== 'undefined') {
  window.runDataSeeding = runDataSeeding
}

console.log('💡 Para insertar datos de prueba, abre la consola (F12) y ejecuta: runDataSeeding()')