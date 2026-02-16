-- Insertar tipo de atención si no existe
INSERT INTO tipos_atencion (nombre, valor_base, descripcion)
SELECT 'Consulta General', 35000, 'Atención médica estándar'
WHERE NOT EXISTS (SELECT 1 FROM tipos_atencion WHERE nombre = 'Consulta General');

-- Insertar profesional
INSERT INTO profesionales (nombre, especialidad, email, telefono, porcentaje_pago, monto_fijo_pago)
SELECT 'Dr. Ejemplo', 'Medicina General', 'dr.ejemplo@centrokuyen.com', '56911111111', 50, 0
WHERE NOT EXISTS (SELECT 1 FROM profesionales WHERE email = 'dr.ejemplo@centrokuyen.com');

-- Insertar paciente
INSERT INTO pacientes (nombre, rut, telefono, email, direccion)
SELECT 'Paciente Demo', '11.111.111-1', '56922222222', 'paciente@demo.com', 'Av. Siempre Viva 742'
WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE rut = '11.111.111-1');

-- Insertar atención para hoy
WITH prof AS (SELECT id FROM profesionales WHERE email = 'dr.ejemplo@centrokuyen.com' LIMIT 1),
     pac AS (SELECT id FROM pacientes WHERE rut = '11.111.111-1' LIMIT 1),
     suc AS (SELECT id FROM sucursales LIMIT 1),
     tipo AS (SELECT id FROM tipos_atencion WHERE nombre = 'Consulta General' LIMIT 1)
INSERT INTO atenciones (profesional_id, paciente_id, sucursal_id, fecha, hora, tipo_atencion, valor_cobrado, pagado, observaciones)
SELECT prof.id, pac.id, suc.id, CURRENT_DATE, '15:30', tipo.id, 45000, true, 'Paciente de prueba para dashboard'
FROM prof, pac, suc, tipo
WHERE NOT EXISTS (SELECT 1 FROM atenciones WHERE profesional_id = prof.id AND fecha = CURRENT_DATE AND hora = '15:30');
