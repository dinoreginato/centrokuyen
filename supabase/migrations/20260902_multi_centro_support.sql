CREATE TABLE IF NOT EXISTS centros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(50),
    cuit VARCHAR(50),
    logo_url TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_centros_nombre ON centros(nombre);
CREATE INDEX IF NOT EXISTS idx_centros_activo ON centros(activo);

ALTER TABLE sucursales
ADD COLUMN IF NOT EXISTS centro_id UUID REFERENCES centros(id);

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS centro_id UUID REFERENCES centros(id);

ALTER TABLE profesionales
ADD COLUMN IF NOT EXISTS centro_id UUID REFERENCES centros(id);

ALTER TABLE pacientes
ADD COLUMN IF NOT EXISTS centro_id UUID REFERENCES centros(id);

ALTER TABLE tipos_atencion
ADD COLUMN IF NOT EXISTS centro_id UUID REFERENCES centros(id);

ALTER TABLE atenciones
ADD COLUMN IF NOT EXISTS centro_id UUID REFERENCES centros(id);

ALTER TABLE costos
ADD COLUMN IF NOT EXISTS centro_id UUID REFERENCES centros(id);

DO $$
DECLARE
    default_centro_id UUID;
BEGIN
    SELECT id
    INTO default_centro_id
    FROM centros
    ORDER BY created_at
    LIMIT 1;

    IF default_centro_id IS NULL THEN
        INSERT INTO centros (nombre, direccion, telefono, cuit, logo_url, activo)
        SELECT
            COALESCE(nombre, 'Centro Principal'),
            direccion,
            telefono,
            cuit,
            logo_url,
            true
        FROM centro_config
        ORDER BY created_at
        LIMIT 1
        RETURNING id INTO default_centro_id;
    END IF;

    IF default_centro_id IS NULL THEN
        INSERT INTO centros (nombre, activo)
        VALUES ('Centro Principal', true)
        RETURNING id INTO default_centro_id;
    END IF;

    UPDATE sucursales
    SET centro_id = default_centro_id
    WHERE centro_id IS NULL;

    UPDATE usuarios u
    SET centro_id = COALESCE(
        u.centro_id,
        (
            SELECT s.centro_id
            FROM sucursales s
            WHERE s.id = u.sucursal_id
        ),
        default_centro_id
    )
    WHERE u.centro_id IS NULL;

    UPDATE profesionales p
    SET centro_id = COALESCE(
        p.centro_id,
        (
            SELECT s.centro_id
            FROM sucursales s
            WHERE s.id = p.sucursal_id
        ),
        default_centro_id
    )
    WHERE p.centro_id IS NULL;

    UPDATE pacientes p
    SET centro_id = COALESCE(
        p.centro_id,
        (
            SELECT s.centro_id
            FROM sucursales s
            WHERE s.id = p.sucursal_id
        ),
        default_centro_id
    )
    WHERE p.centro_id IS NULL;

    UPDATE tipos_atencion t
    SET centro_id = COALESCE(
        t.centro_id,
        (
            SELECT s.centro_id
            FROM sucursales s
            WHERE s.id = t.sucursal_id
        ),
        default_centro_id
    )
    WHERE t.centro_id IS NULL;

    UPDATE atenciones a
    SET centro_id = COALESCE(
        a.centro_id,
        (
            SELECT s.centro_id
            FROM sucursales s
            WHERE s.id = a.sucursal_id
        ),
        default_centro_id
    )
    WHERE a.centro_id IS NULL;

    UPDATE costos c
    SET centro_id = COALESCE(
        c.centro_id,
        (
            SELECT s.centro_id
            FROM sucursales s
            WHERE s.id = c.sucursal_id
        ),
        default_centro_id
    )
    WHERE c.centro_id IS NULL;
END $$;

ALTER TABLE sucursales
ALTER COLUMN centro_id SET NOT NULL;

ALTER TABLE profesionales
ALTER COLUMN centro_id SET NOT NULL;

ALTER TABLE pacientes
ALTER COLUMN centro_id SET NOT NULL;

ALTER TABLE tipos_atencion
ALTER COLUMN centro_id SET NOT NULL;

ALTER TABLE atenciones
ALTER COLUMN centro_id SET NOT NULL;

ALTER TABLE costos
ALTER COLUMN centro_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sucursales_centro_id ON sucursales(centro_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_centro_id ON usuarios(centro_id);
CREATE INDEX IF NOT EXISTS idx_profesionales_centro_id ON profesionales(centro_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_centro_id ON pacientes(centro_id);
CREATE INDEX IF NOT EXISTS idx_tipos_atencion_centro_id ON tipos_atencion(centro_id);
CREATE INDEX IF NOT EXISTS idx_atenciones_centro_id ON atenciones(centro_id);
CREATE INDEX IF NOT EXISTS idx_costos_centro_id ON costos(centro_id);
