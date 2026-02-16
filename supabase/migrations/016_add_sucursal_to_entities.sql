-- Agregar sucursal_id a profesionales
ALTER TABLE profesionales 
ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES sucursales(id);

-- Agregar sucursal_id a pacientes
ALTER TABLE pacientes 
ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES sucursales(id);

-- Agregar sucursal_id a tipos_atencion
ALTER TABLE tipos_atencion 
ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES sucursales(id);
