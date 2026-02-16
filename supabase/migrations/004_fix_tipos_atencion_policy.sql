-- Eliminar políticas existentes para evitar conflictos
DROP POLICY IF EXISTS "Ver tipos de atención activos" ON tipos_atencion;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar tipos" ON tipos_atencion;

-- Política para usuarios anónimos (solo ver activos)
CREATE POLICY "Anonimos ven activos" ON tipos_atencion
  FOR SELECT
  TO anon
  USING (activo = true);

-- Política para usuarios autenticados (ver y gestionar todo)
CREATE POLICY "Autenticados gestionan todo" ON tipos_atencion
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
