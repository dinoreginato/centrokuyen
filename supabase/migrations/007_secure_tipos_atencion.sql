-- Reactivar RLS con política permisiva para autenticados pero segura para públicos
ALTER TABLE tipos_atencion ENABLE ROW LEVEL SECURITY;

-- Asegurar que no queden políticas basura
DROP POLICY IF EXISTS "Ver tipos de atención activos" ON tipos_atencion;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar tipos" ON tipos_atencion;
DROP POLICY IF EXISTS "Anonimos ven activos" ON tipos_atencion;
DROP POLICY IF EXISTS "Autenticados gestionan todo" ON tipos_atencion;
DROP POLICY IF EXISTS "Public_Read_Active" ON tipos_atencion;
DROP POLICY IF EXISTS "Auth_All_Access" ON tipos_atencion;

-- Política 1: Lectura Pública (Solo activos)
-- Permite a cualquier usuario (anon o auth) ver los tipos activos para usarlos en formularios
CREATE POLICY "Public_View_Active" ON tipos_atencion
  FOR SELECT
  USING (activo = true);

-- Política 2: Gestión Total para Autenticados (Admin/Profesional)
-- Permite a usuarios logueados VER TODO (incluso inactivos) y EDITAR/CREAR/BORRAR
CREATE POLICY "Auth_Manage_All" ON tipos_atencion
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
