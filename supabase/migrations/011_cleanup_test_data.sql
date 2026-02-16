-- Migración para limpiar datos de prueba antes de producción

-- 1. Eliminar datos transaccionales (orden por dependencias)
DELETE FROM pagos_profesionales;
DELETE FROM atenciones;
DELETE FROM costos;

-- 2. Eliminar entidades principales
DELETE FROM pacientes;

-- 3. Eliminar usuarios de prueba (mantener solo al administrador principal)
-- Asumimos que el admin real es 'admin@centrokuyen.com'
DELETE FROM usuarios 
WHERE email != 'admin@centrokuyen.com';

-- 4. Eliminar profesionales
-- Primero desvincular cualquier usuario remanente para evitar error de FK (aunque ya borramos usuarios)
UPDATE usuarios SET profesional_id = NULL;

DELETE FROM profesionales;

-- 5. (Opcional) Si se desea mantener las sucursales creadas, no hacemos nada.
-- Si se quiere reiniciar a solo Casa Matriz, se podría borrar las otras.
-- Mantenemos las sucursales por ahora ya que el usuario quizás ya configuró nombres.
