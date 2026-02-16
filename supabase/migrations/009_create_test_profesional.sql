-- Insertar un profesional de prueba con un ID conocido para vincularlo al usuario demo
INSERT INTO profesionales (id, nombre, especialidad, telefono, email, activo)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- ID fijo para vincular
  'Dr. Profesional Demo', 
  'Medicina General', 
  '+56912345678', 
  'dr@centrokuyen.com', 
  true
)
ON CONFLICT (id) DO UPDATE 
SET nombre = EXCLUDED.nombre; -- Si ya existe, actualizamos el nombre para asegurar que sea reconocible
