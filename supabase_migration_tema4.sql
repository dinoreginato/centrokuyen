-- MIGRACIÓN PARA TEMA 4: BORRADO LÓGICO Y AUDITORÍA
-- Por favor, ejecuta este script en el editor SQL de Supabase.

-- 1. AGREGAR COLUMNA 'ACTIVO' PARA BORRADO LÓGICO
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;
ALTER TABLE atenciones ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;
ALTER TABLE costos ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;

-- 2. CREAR TABLA DE AUDITORÍA
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(255) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'SOFT_DELETE'
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id), -- Usuario que hizo el cambio
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS en la tabla de auditoría (solo lectura para admins)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'
        )
    );

-- 3. ACTUALIZAR LAS VISTAS O FUNCIONES SI APLICAN
-- No necesario por ahora, las consultas desde el frontend deberán filtrar usando .eq('activo', true)
