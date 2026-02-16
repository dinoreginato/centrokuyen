-- Tabla de profesionales
CREATE TABLE profesionales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    especialidad VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    telefono VARCHAR(50),
    porcentaje_pago DECIMAL(5,2) DEFAULT 70.00,
    monto_fijo_pago DECIMAL(10,2),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para profesionales
CREATE INDEX idx_profesionales_especialidad ON profesionales(especialidad);
CREATE INDEX idx_profesionales_activo ON profesionales(activo);

-- Tabla de pacientes
CREATE TABLE pacientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    dni VARCHAR(50) UNIQUE,
    telefono VARCHAR(50),
    email VARCHAR(255),
    obra_social VARCHAR(255),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para pacientes
CREATE INDEX idx_pacientes_nombre ON pacientes(nombre);
CREATE INDEX idx_pacientes_dni ON pacientes(dni);

-- Tabla de atenciones
CREATE TABLE atenciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profesional_id UUID REFERENCES profesionales(id) ON DELETE CASCADE,
    paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    tipo_atencion VARCHAR(255) NOT NULL,
    valor_cobrado DECIMAL(10,2) NOT NULL,
    pagado BOOLEAN DEFAULT false,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para atenciones
CREATE INDEX idx_atenciones_fecha ON atenciones(fecha);
CREATE INDEX idx_atenciones_profesional ON atenciones(profesional_id);
CREATE INDEX idx_atenciones_paciente ON atenciones(paciente_id);

-- Tabla de pagos a profesionales
CREATE TABLE pagos_profesionales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atencion_id UUID REFERENCES atenciones(id) ON DELETE CASCADE,
    profesional_id UUID REFERENCES profesionales(id) ON DELETE CASCADE,
    monto_pagado DECIMAL(10,2) NOT NULL,
    fecha_pago DATE NOT NULL,
    tipo_pago VARCHAR(50) NOT NULL, -- 'porcentaje' o 'monto_fijo'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para pagos_profesionales
CREATE INDEX idx_pagos_profesionales_profesional ON pagos_profesionales(profesional_id);
CREATE INDEX idx_pagos_profesionales_fecha ON pagos_profesionales(fecha_pago);

-- Tabla de costos
CREATE TABLE costos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('fijo', 'variable')),
    categoria VARCHAR(255) NOT NULL,
    descripcion TEXT,
    monto DECIMAL(10,2) NOT NULL,
    fecha DATE NOT NULL,
    recurrente BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para costos
CREATE INDEX idx_costos_tipo ON costos(tipo);
CREATE INDEX idx_costos_fecha ON costos(fecha);
CREATE INDEX idx_costos_categoria ON costos(categoria);

-- Tabla de tipos de atención
CREATE TABLE tipos_atencion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    valor_base DECIMAL(10,2),
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar tipos de atención por defecto
INSERT INTO tipos_atencion (nombre, valor_base, descripcion) VALUES
    ('Consulta general', 1500.00, 'Consulta médica general'),
    ('Consulta especialista', 2500.00, 'Consulta con especialista'),
    ('Práctica médica', 3000.00, 'Práctica o procedimiento médico'),
    ('Estudio médico', 1800.00, 'Estudio o análisis médico');

-- Tabla de configuración del centro
CREATE TABLE centro_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(50),
    cuit VARCHAR(50),
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar configuración por defecto
INSERT INTO centro_config (nombre, direccion, telefono) VALUES
    ('Centro Médico', 'Dirección del centro', 'Teléfono del centro');

-- Políticas de seguridad (Row Level Security)
-- Políticas para profesionales
ALTER TABLE profesionales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden ver profesionales activos" ON profesionales
    FOR SELECT USING (activo = true);

CREATE POLICY "Usuarios autenticados pueden gestionar profesionales" ON profesionales
    FOR ALL USING (auth.role() = 'authenticated');

-- Políticas para pacientes
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver todos los pacientes" ON pacientes
    FOR SELECT USING (true);

CREATE POLICY "Usuarios autenticados pueden gestionar pacientes" ON pacientes
    FOR ALL USING (auth.role() = 'authenticated');

-- Políticas para atenciones
ALTER TABLE atenciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver todas las atenciones" ON atenciones
    FOR SELECT USING (true);

CREATE POLICY "Usuarios autenticados pueden gestionar atenciones" ON atenciones
    FOR ALL USING (auth.role() = 'authenticated');

-- Políticas para pagos_profesionales
ALTER TABLE pagos_profesionales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver todos los pagos" ON pagos_profesionales
    FOR SELECT USING (true);

CREATE POLICY "Usuarios autenticados pueden gestionar pagos" ON pagos_profesionales
    FOR ALL USING (auth.role() = 'authenticated');

-- Políticas para costos
ALTER TABLE costos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver todos los costos" ON costos
    FOR SELECT USING (true);

CREATE POLICY "Usuarios autenticados pueden gestionar costos" ON costos
    FOR ALL USING (auth.role() = 'authenticated');

-- Políticas para tipos_atencion
ALTER TABLE tipos_atencion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver tipos de atención activos" ON tipos_atencion
    FOR SELECT USING (activo = true);

CREATE POLICY "Usuarios autenticados pueden gestionar tipos" ON tipos_atencion
    FOR ALL USING (auth.role() = 'authenticated');

-- Políticas para centro_config
ALTER TABLE centro_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver configuración del centro" ON centro_config
    FOR SELECT USING (true);

CREATE POLICY "Usuarios autenticados pueden gestionar configuración" ON centro_config
    FOR ALL USING (auth.role() = 'authenticated');

-- Otorgar permisos
GRANT SELECT ON profesionales TO anon;
GRANT ALL PRIVILEGES ON profesionales TO authenticated;

GRANT SELECT ON pacientes TO anon;
GRANT ALL PRIVILEGES ON pacientes TO authenticated;

GRANT SELECT ON atenciones TO anon;
GRANT ALL PRIVILEGES ON atenciones TO authenticated;

GRANT SELECT ON pagos_profesionales TO anon;
GRANT ALL PRIVILEGES ON pagos_profesionales TO authenticated;

GRANT SELECT ON costos TO anon;
GRANT ALL PRIVILEGES ON costos TO authenticated;

GRANT SELECT ON tipos_atencion TO anon;
GRANT ALL PRIVILEGES ON tipos_atencion TO authenticated;

GRANT SELECT ON centro_config TO anon;
GRANT ALL PRIVILEGES ON centro_config TO authenticated;