-- Actualizar tabla pacientes: cambiar DNI por RUT, quitar obra_social, agregar direccion
ALTER TABLE pacientes 
RENAME COLUMN dni TO rut;

ALTER TABLE pacientes 
DROP COLUMN obra_social;

ALTER TABLE pacientes 
ADD COLUMN direccion TEXT DEFAULT '';

-- Actualizar políticas RLS si es necesario (las políticas existentes deberían seguir funcionando)
-- No necesitan cambios ya que no hacen referencia a los campos modificados