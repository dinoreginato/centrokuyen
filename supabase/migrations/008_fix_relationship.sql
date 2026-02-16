-- Intentar convertir la columna tipo_atencion a UUID para poder crear la relación
-- Nota: Esto fallará si hay valores que no sean UUIDs válidos en la columna.
ALTER TABLE atenciones 
  ALTER COLUMN tipo_atencion TYPE UUID 
  USING tipo_atencion::uuid;

-- Agregar la restricción de clave foránea para que Supabase detecte la relación
ALTER TABLE atenciones
  ADD CONSTRAINT fk_atenciones_tipos
  FOREIGN KEY (tipo_atencion)
  REFERENCES tipos_atencion(id);
