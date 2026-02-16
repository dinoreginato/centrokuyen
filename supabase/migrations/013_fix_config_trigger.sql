-- 1. Crear función para actualizar timestamp si no existe
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Asegurar trigger en centro_config
DROP TRIGGER IF EXISTS update_centro_config_updated_at ON centro_config;
CREATE TRIGGER update_centro_config_updated_at
    BEFORE UPDATE ON centro_config
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 3. Insertar configuración por defecto si la tabla está vacía
INSERT INTO centro_config (nombre, direccion, telefono, updated_at)
SELECT 'Centro Kuyen', 'Dirección no configurada', '', now()
WHERE NOT EXISTS (SELECT 1 FROM centro_config);
