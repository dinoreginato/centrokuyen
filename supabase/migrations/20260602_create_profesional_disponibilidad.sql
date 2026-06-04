CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE IF NOT EXISTS profesional_disponibilidad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profesional_disponibilidad_profesional ON profesional_disponibilidad(profesional_id);
CREATE INDEX IF NOT EXISTS idx_profesional_disponibilidad_sucursal ON profesional_disponibilidad(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_profesional_disponibilidad_dia ON profesional_disponibilidad(dia_semana);

DROP TRIGGER IF EXISTS update_profesional_disponibilidad_updated_at ON profesional_disponibilidad;
CREATE TRIGGER update_profesional_disponibilidad_updated_at
  BEFORE UPDATE ON profesional_disponibilidad
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE profesional_disponibilidad DISABLE ROW LEVEL SECURITY;
