-- 1. Crear tabla de sucursales
CREATE TABLE IF NOT EXISTS sucursales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    direccion VARCHAR(255),
    telefono VARCHAR(50),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Asegurar existencia de tabla usuarios (si no existía)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  rol TEXT CHECK (rol IN ('admin', 'profesional', 'usuario')),
  nombre TEXT,
  activo BOOLEAN DEFAULT true,
  profesional_id UUID REFERENCES profesionales(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Insertar sucursales iniciales (usando IDs fijos para referencia)
INSERT INTO sucursales (id, nombre, direccion) VALUES 
('11111111-1111-1111-1111-111111111111', 'Casa Matriz', 'Av. Central 1234'),
('22222222-2222-2222-2222-222222222222', 'Sucursal Norte', 'Calle Norte 567')
ON CONFLICT (id) DO NOTHING;

-- 4. Agregar columna sucursal_id a tablas clave
-- Atenciones
ALTER TABLE atenciones ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES sucursales(id);
-- Costos
ALTER TABLE costos ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES sucursales(id);
-- Usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES sucursales(id);

-- 5. Migrar datos existentes a la Casa Matriz
UPDATE atenciones SET sucursal_id = '11111111-1111-1111-1111-111111111111' WHERE sucursal_id IS NULL;
UPDATE costos SET sucursal_id = '11111111-1111-1111-1111-111111111111' WHERE sucursal_id IS NULL;
UPDATE usuarios SET sucursal_id = '11111111-1111-1111-1111-111111111111' WHERE sucursal_id IS NULL;

-- 6. Insertar usuarios demo en la tabla usuarios (para que el login funcione contra BD)
INSERT INTO usuarios (email, password_hash, rol, nombre, sucursal_id) VALUES
('admin@centrokuyen.com', 'admin123', 'admin', 'Administrador', '11111111-1111-1111-1111-111111111111'),
('profesional@centrokuyen.com', 'admin123', 'profesional', 'Profesional Demo', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (email) DO NOTHING;

-- Vincular profesional demo
UPDATE usuarios SET profesional_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' WHERE email = 'profesional@centrokuyen.com';

-- 7. Hacer obligatoria la sucursal (ahora que hay datos)
ALTER TABLE atenciones ALTER COLUMN sucursal_id SET NOT NULL;
ALTER TABLE costos ALTER COLUMN sucursal_id SET NOT NULL;
