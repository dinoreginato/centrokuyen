-- Borrar políticas anteriores (variantes posibles)
DROP POLICY IF EXISTS "Ver tipos de atención activos" ON tipos_atencion;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar tipos" ON tipos_atencion;
DROP POLICY IF EXISTS "Anonimos ven activos" ON tipos_atencion;
DROP POLICY IF EXISTS "Autenticados gestionan todo" ON tipos_atencion;

-- Recrear políticas limpias
CREATE POLICY "Public_Read_Active" ON tipos_atencion
  FOR SELECT
  TO anon, authenticated
  USING (activo = true);

CREATE POLICY "Auth_All_Access" ON tipos_atencion
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
