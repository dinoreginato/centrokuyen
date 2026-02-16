// Script para insertar datos de prueba directamente
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dqqcvjxoxaasftgrgpsm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxcWN2anhveGFhc2Z0Z3JncHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc5MDAyNCwiZXhwIjoyMDgyMzY2MDI0fQ.QZ7jFwvFT4kpsvMMLct48axoSts00ZFUUrrjvzms1XE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function insertTestData() {
  console.log('🚀 Iniciando inserción de datos de prueba...');

  try {
    // 1. Insertar profesionales
    console.log('👨‍⚕️ Insertando profesionales...');
    const profesionales = [
      {
        nombre: 'Dr. Carlos Rodríguez',
        especialidad: 'Medicina General',
        email: 'carlos.rodriguez@centrokuyen.cl',
        telefono: '+56912345678',
        porcentaje_pago: 70,
        monto_fijo_pago: null,
        activo: true
      },
      {
        nombre: 'Dra. María González',
        especialidad: 'Pediatría',
        email: 'maria.gonzalez@centrokuyen.cl',
        telefono: '+56987654321',
        porcentaje_pago: 65,
        monto_fijo_pago: null,
        activo: true
      },
      {
        nombre: 'Dr. Juan Pérez',
        especialidad: 'Dermatología',
        email: 'juan.perez@centrokuyen.cl',
        telefono: '+56911223344',
        porcentaje_pago: 75,
        monto_fijo_pago: null,
        activo: true
      },
      {
        nombre: 'Dra. Ana López',
        especialidad: 'Ginecología',
        email: 'ana.lopez@centrokuyen.cl',
        telefono: '+56944332211',
        porcentaje_pago: 68,
        monto_fijo_pago: null,
        activo: true
      },
      {
        nombre: 'Dr. Roberto Silva',
        especialidad: 'Cardiología',
        email: 'roberto.silva@centrokuyen.cl',
        telefono: '+56999887766',
        porcentaje_pago: 72,
        monto_fijo_pago: null,
        activo: true
      }
    ];

    for (const profesional of profesionales) {
      const { error } = await supabase.from('profesionales').insert(profesional);
      if (error) console.error('Error insertando profesional:', error);
      else console.log(`✅ Profesional ${profesional.nombre} insertado`);
    }

    // 2. Insertar pacientes
    console.log('👥 Insertando pacientes...');
    const pacientes = [
      {
        nombre: 'Patricia González',
        rut: '12.345.678-9',
        telefono: '+56923456789',
        email: 'patricia.gonzalez@email.com',
        direccion: 'Av. Principal 123, Santiago',
        notas: 'Paciente con hipertensión controlada'
      },
      {
        nombre: 'Eduardo Martínez',
        rut: '13.456.789-0',
        telefono: '+56934567890',
        email: 'eduardo.martinez@email.com',
        direccion: 'Calle Los Robles 456, Providencia',
        notas: 'Alergia a penicilina'
      },
      {
        nombre: 'Carmen Soto',
        rut: '14.567.890-1',
        telefono: '+56945678901',
        email: 'carmen.soto@email.com',
        direccion: 'Pasaje Las Flores 789, Las Condes',
        notas: 'Diabetes tipo 2'
      },
      {
        nombre: 'Miguel Torres',
        rut: '15.678.901-2',
        telefono: '+56956789012',
        email: 'miguel.torres@email.com',
        direccion: 'Av. Central 321, Ñuñoa',
        notas: 'Control check-up anual'
      },
      {
        nombre: 'Isabel Reyes',
        rut: '16.789.012-3',
        telefono: '+56967890123',
        email: 'isabel.reyes@email.com',
        direccion: 'Calle Norte 654, La Reina',
        notas: 'Embarazo 3er trimestre'
      },
      {
        nombre: 'Ricardo Mendoza',
        rut: '17.890.123-4',
        telefono: '+56978901234',
        email: 'ricardo.mendoza@email.com',
        direccion: 'Av. Sur 987, Peñalolén',
        notas: 'Problemas de tiroides'
      },
      {
        nombre: 'Marcela Jiménez',
        rut: '18.901.234-5',
        telefono: '+56989012345',
        email: 'marcela.jimenez@email.com',
        direccion: 'Calle Este 147, Macul',
        notas: 'Control nutricional'
      },
      {
        nombre: 'Alberto Cruz',
        rut: '19.012.345-6',
        telefono: '+56990123456',
        email: 'alberto.cruz@email.com',
        direccion: 'Pasaje Oeste 258, San Joaquín',
        notas: 'Hipercolesterolemia'
      }
    ];

    for (const paciente of pacientes) {
      const { error } = await supabase.from('pacientes').insert(paciente);
      if (error) console.error('Error insertando paciente:', error);
      else console.log(`✅ Paciente ${paciente.nombre} insertado`);
    }

    // 3. Insertar tipos de atención
    console.log('📋 Insertando tipos de atención...');
    const tiposAtencion = [
      {
        nombre: 'Consulta General',
        valor_base: 35000,
        descripcion: 'Consulta médica general de rutina',
        activo: true
      },
      {
        nombre: 'Control Pediatría',
        valor_base: 30000,
        descripcion: 'Control de salud para niños',
        activo: true
      },
      {
        nombre: 'Dermatología',
        valor_base: 45000,
        descripcion: 'Consulta especializada en enfermedades de la piel',
        activo: true
      },
      {
        nombre: 'Ginecología',
        valor_base: 40000,
        descripcion: 'Consulta especializada en salud de la mujer',
        activo: true
      },
      {
        nombre: 'Cardiología',
        valor_base: 60000,
        descripcion: 'Consulta especializada en enfermedades del corazón',
        activo: true
      },
      {
        nombre: 'Chequeo Preventivo',
        valor_base: 25000,
        descripcion: 'Chequeo médico preventivo anual',
        activo: true
      }
    ];

    for (const tipo of tiposAtencion) {
      const { error } = await supabase.from('tipos_atencion').insert(tipo);
      if (error) console.error('Error insertando tipo de atención:', error);
      else console.log(`✅ Tipo de atención ${tipo.nombre} insertado`);
    }

    // 4. Insertar costos
    console.log('💰 Insertando costos...');
    const costos = [
      {
        tipo: 'fijo',
        categoria: 'Alquiler Local',
        descripcion: 'Alquiler mensual del consultorio',
        monto: 800000,
        fecha: new Date().toISOString().split('T')[0],
        recurrente: true
      },
      {
        tipo: 'fijo',
        categoria: 'Servicios Básicos',
        descripcion: 'Electricidad, agua, gas',
        monto: 150000,
        fecha: new Date().toISOString().split('T')[0],
        recurrente: true
      },
      {
        tipo: 'fijo',
        categoria: 'Internet y Telefonía',
        descripcion: 'Servicio de internet y líneas telefónicas',
        monto: 80000,
        fecha: new Date().toISOString().split('T')[0],
        recurrente: true
      },
      {
        tipo: 'fijo',
        categoria: 'Personal Administrativo',
        descripcion: 'Secretaria y personal de apoyo',
        monto: 500000,
        fecha: new Date().toISOString().split('T')[0],
        recurrente: true
      },
      {
        tipo: 'variable',
        categoria: 'Materiales Médicos',
        descripcion: 'Guantes, mascarillas, desinfectantes',
        monto: 120000,
        fecha: new Date().toISOString().split('T')[0],
        recurrente: false
      },
      {
        tipo: 'variable',
        categoria: 'Equipamiento',
        descripcion: 'Mantenimiento de equipos médicos',
        monto: 200000,
        fecha: new Date().toISOString().split('T')[0],
        recurrente: false
      }
    ];

    for (const costo of costos) {
      const { error } = await supabase.from('costos').insert(costo);
      if (error) console.error('Error insertando costo:', error);
      else console.log(`✅ Costo ${costo.categoria} insertado`);
    }

    // 5. Insertar configuración del centro
    console.log('🏥 Insertando configuración del centro...');
    const config = {
      nombre: 'Centro Kuyen',
      direccion: 'Av. Principal 123, Santiago, Chile',
      telefono: '+56223456789',
      cuit: '76.543.210-1',
      logo_url: ''
    };

    const { error: configError } = await supabase.from('centro_config').insert(config);
    if (configError) console.error('Error insertando configuración:', configError);
    else console.log('✅ Configuración del Centro Kuyen insertada');

    // 6. Crear citas de prueba
    console.log('📅 Creando citas de prueba...');
    
    // Obtener IDs de profesionales, pacientes y tipos de atención
    const { data: profesionalesData } = await supabase.from('profesionales').select('id').eq('activo', true);
    const { data: pacientesData } = await supabase.from('pacientes').select('id');
    const { data: tiposData } = await supabase.from('tipos_atencion').select('id, valor_base').eq('activo', true);

    if (profesionalesData && pacientesData && tiposData) {
      const citas = [];
      const horarios = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
      const fechas = [];
      
      for (let i = 0; i < 14; i++) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + i);
        fechas.push(fecha.toISOString().split('T')[0]);
      }

      // Crear 20 citas aleatorias
      for (let i = 0; i < 20; i++) {
        const fecha = fechas[Math.floor(Math.random() * fechas.length)];
        const hora = horarios[Math.floor(Math.random() * horarios.length)];
        const profesional = profesionalesData[Math.floor(Math.random() * profesionalesData.length)];
        const paciente = pacientesData[Math.floor(Math.random() * pacientesData.length)];
        const tipoAtencion = tiposData[Math.floor(Math.random() * tiposData.length)];
        
        citas.push({
          profesional_id: profesional.id,
          paciente_id: paciente.id,
          fecha,
          hora,
          tipo_atencion: tipoAtencion.id,
          valor_cobrado: tipoAtencion.valor_base,
          pagado: Math.random() > 0.3, // 70% de las citas están pagadas
          observaciones: i % 3 === 0 ? 'Paciente con síntomas de resfriado' : null
        });
      }

      for (const cita of citas) {
        const { error } = await supabase.from('atenciones').insert(cita);
        if (error) console.error('Error insertando cita:', error);
        else console.log(`✅ Cita creada para ${cita.fecha} a las ${cita.hora}`);
      }
    }

    console.log('🎉 ¡Todos los datos de prueba han sido insertados exitosamente!');
    console.log('🔄 Por favor, actualiza la página del navegador para ver los cambios.');

  } catch (error) {
    console.error('❌ Error al insertar datos de prueba:', error);
  } finally {
    process.exit(0);
  }
}

// Ejecutar el script
insertTestData();