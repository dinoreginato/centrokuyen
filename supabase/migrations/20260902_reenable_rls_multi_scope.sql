CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol
  FROM public.usuarios
  WHERE auth_user_id = auth.uid()
    AND activo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_app_centro_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(u.centro_id, s.centro_id)
  FROM public.usuarios u
  LEFT JOIN public.sucursales s ON s.id = u.sucursal_id
  WHERE u.auth_user_id = auth.uid()
    AND u.activo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_app_sucursal_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sucursal_id
  FROM public.usuarios
  WHERE auth_user_id = auth.uid()
    AND activo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_app_profesional_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profesional_id
  FROM public.usuarios
  WHERE auth_user_id = auth.uid()
    AND activo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolve_scope_centro(p_centro_id UUID, p_sucursal_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    p_centro_id,
    (SELECT centro_id FROM public.sucursales WHERE id = p_sucursal_id LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.scope_matches(p_centro_id UUID, p_sucursal_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_role TEXT := public.current_app_role();
  app_centro_id UUID := public.current_app_centro_id();
  app_sucursal_id UUID := public.current_app_sucursal_id();
  target_centro_id UUID := public.resolve_scope_centro(p_centro_id, p_sucursal_id);
BEGIN
  IF auth.uid() IS NULL OR app_role IS NULL THEN
    RETURN false;
  END IF;

  IF app_role = 'admin' AND app_centro_id IS NULL AND app_sucursal_id IS NULL THEN
    RETURN true;
  END IF;

  IF app_sucursal_id IS NOT NULL THEN
    IF p_sucursal_id IS NOT NULL THEN
      RETURN p_sucursal_id = app_sucursal_id;
    END IF;
    RETURN target_centro_id = app_centro_id;
  END IF;

  IF app_centro_id IS NOT NULL THEN
    RETURN target_centro_id = app_centro_id;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_scope_matches(p_centro_id UUID, p_sucursal_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_app_role() = 'admin'
     AND public.scope_matches(p_centro_id, p_sucursal_id);
$$;

CREATE OR REPLACE FUNCTION public.can_access_usuario_row(
  p_auth_user_id UUID,
  p_centro_id UUID,
  p_sucursal_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_auth_user_id = auth.uid()
     OR public.admin_scope_matches(p_centro_id, p_sucursal_id);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_user_scope(
  p_centro_id UUID,
  p_sucursal_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_app_role() <> 'admin' THEN
    RETURN false;
  END IF;

  IF p_centro_id IS NULL AND p_sucursal_id IS NULL THEN
    RETURN public.current_app_centro_id() IS NULL
      AND public.current_app_sucursal_id() IS NULL;
  END IF;

  RETURN public.scope_matches(p_centro_id, p_sucursal_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_atencion_row(
  p_centro_id UUID,
  p_sucursal_id UUID,
  p_profesional_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_role TEXT := public.current_app_role();
  app_profesional_id UUID := public.current_app_profesional_id();
BEGIN
  IF app_role IS NULL OR NOT public.scope_matches(p_centro_id, p_sucursal_id) THEN
    RETURN false;
  END IF;

  IF app_role = 'profesional' THEN
    RETURN app_profesional_id IS NOT NULL AND app_profesional_id = p_profesional_id;
  END IF;

  RETURN app_role IN ('admin', 'usuario');
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_profesional_comision_row(p_profesional_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_role TEXT := public.current_app_role();
  app_profesional_id UUID := public.current_app_profesional_id();
  record_scope RECORD;
BEGIN
  SELECT centro_id, sucursal_id
  INTO record_scope
  FROM public.profesionales
  WHERE id = p_profesional_id;

  IF record_scope IS NULL OR NOT public.scope_matches(record_scope.centro_id, record_scope.sucursal_id) THEN
    RETURN false;
  END IF;

  IF app_role = 'admin' THEN
    RETURN true;
  END IF;

  RETURN app_role = 'profesional' AND app_profesional_id = p_profesional_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_pago_row(
  p_atencion_id UUID,
  p_profesional_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_role TEXT := public.current_app_role();
  app_profesional_id UUID := public.current_app_profesional_id();
  atencion_scope RECORD;
BEGIN
  SELECT centro_id, sucursal_id, profesional_id
  INTO atencion_scope
  FROM public.atenciones
  WHERE id = p_atencion_id;

  IF atencion_scope IS NULL OR NOT public.scope_matches(atencion_scope.centro_id, atencion_scope.sucursal_id) THEN
    RETURN false;
  END IF;

  IF app_role = 'admin' THEN
    RETURN true;
  END IF;

  RETURN app_role = 'profesional'
    AND app_profesional_id IS NOT NULL
    AND app_profesional_id = COALESCE(p_profesional_id, atencion_scope.profesional_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_disponibilidad_row(
  p_profesional_id UUID,
  p_sucursal_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_role TEXT := public.current_app_role();
  app_profesional_id UUID := public.current_app_profesional_id();
BEGIN
  IF NOT public.scope_matches(NULL, p_sucursal_id) THEN
    RETURN false;
  END IF;

  IF app_role = 'admin' THEN
    RETURN true;
  END IF;

  RETURN app_role = 'profesional'
    AND app_profesional_id IS NOT NULL
    AND app_profesional_id = p_profesional_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_application_user(
  p_email TEXT,
  p_password TEXT,
  p_nombre TEXT,
  p_rol TEXT,
  p_centro_id UUID DEFAULT NULL,
  p_sucursal_id UUID DEFAULT NULL,
  p_profesional_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_auth_user_id UUID;
  new_usuario_id UUID;
  normalized_email TEXT := lower(trim(p_email));
BEGIN
  IF NOT public.can_manage_user_scope(p_centro_id, p_sucursal_id) THEN
    RAISE EXCEPTION 'No autorizado para crear usuarios en ese alcance';
  END IF;

  IF p_rol NOT IN ('admin', 'profesional', 'usuario') THEN
    RAISE EXCEPTION 'Rol de usuario inválido';
  END IF;

  new_auth_user_id := public.create_auth_user_record(
    normalized_email,
    p_password,
    p_nombre,
    p_rol
  );

  INSERT INTO public.usuarios (
    email,
    nombre,
    rol,
    activo,
    profesional_id,
    auth_user_id,
    centro_id,
    sucursal_id,
    password_hash
  )
  VALUES (
    normalized_email,
    p_nombre,
    p_rol,
    true,
    p_profesional_id,
    new_auth_user_id,
    p_centro_id,
    p_sucursal_id,
    NULL
  )
  RETURNING id INTO new_usuario_id;

  RETURN new_usuario_id;
EXCEPTION
  WHEN OTHERS THEN
    IF new_auth_user_id IS NOT NULL THEN
      DELETE FROM auth.identities WHERE user_id = new_auth_user_id;
      DELETE FROM auth.users WHERE id = new_auth_user_id;
    END IF;
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_application_user(
  p_usuario_id UUID,
  p_email TEXT DEFAULT NULL,
  p_password TEXT DEFAULT NULL,
  p_nombre TEXT DEFAULT NULL,
  p_rol TEXT DEFAULT NULL,
  p_centro_id UUID DEFAULT NULL,
  p_sucursal_id UUID DEFAULT NULL,
  p_profesional_id UUID DEFAULT NULL,
  p_activo BOOLEAN DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  current_user_record public.usuarios%ROWTYPE;
  target_auth_user_id UUID;
  next_email TEXT;
  next_nombre TEXT;
  next_rol TEXT;
  next_activo BOOLEAN;
BEGIN
  SELECT *
  INTO current_user_record
  FROM public.usuarios
  WHERE id = p_usuario_id
  FOR UPDATE;

  IF current_user_record.id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  IF NOT public.can_manage_user_scope(current_user_record.centro_id, current_user_record.sucursal_id) THEN
    RAISE EXCEPTION 'No autorizado para editar ese usuario';
  END IF;

  IF NOT public.can_manage_user_scope(p_centro_id, p_sucursal_id) THEN
    RAISE EXCEPTION 'No autorizado para mover el usuario a ese alcance';
  END IF;

  next_email := lower(trim(COALESCE(p_email, current_user_record.email)));
  next_nombre := COALESCE(p_nombre, current_user_record.nombre);
  next_rol := COALESCE(p_rol, current_user_record.rol);
  next_activo := COALESCE(p_activo, current_user_record.activo);
  target_auth_user_id := current_user_record.auth_user_id;

  IF next_rol NOT IN ('admin', 'profesional', 'usuario') THEN
    RAISE EXCEPTION 'Rol de usuario inválido';
  END IF;

  IF target_auth_user_id IS NULL THEN
    IF NULLIF(p_password, '') IS NULL THEN
      RAISE EXCEPTION 'Debes definir una contraseña para vincular este usuario con autenticación';
    END IF;

    target_auth_user_id := public.create_auth_user_record(
      next_email,
      p_password,
      next_nombre,
      next_rol
    );
  ELSE
    PERFORM public.update_auth_user_record(
      target_auth_user_id,
      next_email,
      NULLIF(p_password, ''),
      next_nombre,
      next_rol
    );
  END IF;

  UPDATE auth.users
  SET
    banned_until = CASE
      WHEN next_activo THEN NULL
      ELSE '2200-01-01 00:00:00+00'::timestamptz
    END,
    updated_at = now()
  WHERE id = target_auth_user_id;

  UPDATE public.usuarios
  SET
    email = next_email,
    nombre = next_nombre,
    rol = next_rol,
    activo = next_activo,
    profesional_id = p_profesional_id,
    auth_user_id = target_auth_user_id,
    centro_id = p_centro_id,
    sucursal_id = p_sucursal_id,
    password_hash = NULL,
    updated_at = now()
  WHERE id = p_usuario_id;

  RETURN p_usuario_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_application_user(p_usuario_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  current_user_record public.usuarios%ROWTYPE;
BEGIN
  SELECT *
  INTO current_user_record
  FROM public.usuarios
  WHERE id = p_usuario_id
  FOR UPDATE;

  IF current_user_record.id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  IF NOT public.can_manage_user_scope(current_user_record.centro_id, current_user_record.sucursal_id) THEN
    RAISE EXCEPTION 'No autorizado para eliminar ese usuario';
  END IF;

  IF current_user_record.auth_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminar tu propio usuario';
  END IF;

  DELETE FROM public.usuarios
  WHERE id = p_usuario_id;

  IF current_user_record.auth_user_id IS NOT NULL THEN
    DELETE FROM auth.sessions WHERE user_id = current_user_record.auth_user_id;
    DELETE FROM auth.refresh_tokens WHERE user_id = current_user_record.auth_user_id;
    DELETE FROM auth.identities WHERE user_id = current_user_record.auth_user_id;
    DELETE FROM auth.users WHERE id = current_user_record.auth_user_id;
  END IF;
END;
$$;

ALTER TABLE public.centros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profesionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atenciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_atencion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centro_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profesional_comisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profesional_disponibilidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_profesionales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS centros_read_public ON public.centros;
DROP POLICY IF EXISTS centros_read_scope ON public.centros;
DROP POLICY IF EXISTS centros_insert_admin ON public.centros;
DROP POLICY IF EXISTS centros_update_admin ON public.centros;
DROP POLICY IF EXISTS "Todos pueden ver profesionales activos" ON public.profesionales;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar profesionales" ON public.profesionales;
DROP POLICY IF EXISTS "Ver todos los pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "Ver todas las atenciones" ON public.atenciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar atenciones" ON public.atenciones;
DROP POLICY IF EXISTS "Ver todos los pagos" ON public.pagos_profesionales;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar pagos" ON public.pagos_profesionales;
DROP POLICY IF EXISTS "Ver todos los costos" ON public.costos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar costos" ON public.costos;
DROP POLICY IF EXISTS "Ver tipos de atención activos" ON public.tipos_atencion;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar tipos" ON public.tipos_atencion;
DROP POLICY IF EXISTS "Public_Read_Active" ON public.tipos_atencion;
DROP POLICY IF EXISTS "Auth_All_Access" ON public.tipos_atencion;
DROP POLICY IF EXISTS "Anonimos ven activos" ON public.tipos_atencion;
DROP POLICY IF EXISTS "Autenticados gestionan todo" ON public.tipos_atencion;
DROP POLICY IF EXISTS "Public_View_Active" ON public.tipos_atencion;
DROP POLICY IF EXISTS "Auth_Manage_All" ON public.tipos_atencion;
DROP POLICY IF EXISTS "Ver configuración del centro" ON public.centro_config;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar configuración" ON public.centro_config;
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Admin puede ver todos los usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Admin puede crear usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Admin puede actualizar usuarios" ON public.usuarios;

CREATE POLICY centros_read_public
ON public.centros
FOR SELECT
TO anon
USING (activo = true);

CREATE POLICY centros_read_scope
ON public.centros
FOR SELECT
TO authenticated
USING (activo = true AND public.scope_matches(id, NULL));

CREATE POLICY centros_insert_admin
ON public.centros
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_app_role() = 'admin'
  AND public.current_app_centro_id() IS NULL
  AND public.current_app_sucursal_id() IS NULL
);

CREATE POLICY centros_update_admin
ON public.centros
FOR UPDATE
TO authenticated
USING (public.admin_scope_matches(id, NULL))
WITH CHECK (public.admin_scope_matches(id, NULL));

DROP POLICY IF EXISTS sucursales_read_scope ON public.sucursales;
DROP POLICY IF EXISTS sucursales_manage_admin ON public.sucursales;

CREATE POLICY sucursales_read_scope
ON public.sucursales
FOR SELECT
TO authenticated
USING (activo = true AND public.scope_matches(centro_id, id));

CREATE POLICY sucursales_manage_admin
ON public.sucursales
FOR ALL
TO authenticated
USING (public.admin_scope_matches(centro_id, id))
WITH CHECK (public.admin_scope_matches(centro_id, id));

DROP POLICY IF EXISTS usuarios_read_scope ON public.usuarios;

CREATE POLICY usuarios_read_scope
ON public.usuarios
FOR SELECT
TO authenticated
USING (public.can_access_usuario_row(auth_user_id, centro_id, sucursal_id));

DROP POLICY IF EXISTS profesionales_read_scope ON public.profesionales;
DROP POLICY IF EXISTS profesionales_manage_admin ON public.profesionales;

CREATE POLICY profesionales_read_scope
ON public.profesionales
FOR SELECT
TO authenticated
USING (
  public.scope_matches(centro_id, sucursal_id)
  AND (
    activo = true
    OR public.current_app_role() = 'admin'
  )
);

CREATE POLICY profesionales_manage_admin
ON public.profesionales
FOR ALL
TO authenticated
USING (public.admin_scope_matches(centro_id, sucursal_id))
WITH CHECK (public.admin_scope_matches(centro_id, sucursal_id));

DROP POLICY IF EXISTS pacientes_read_scope ON public.pacientes;
DROP POLICY IF EXISTS pacientes_manage_scope ON public.pacientes;

CREATE POLICY pacientes_read_scope
ON public.pacientes
FOR SELECT
TO authenticated
USING (
  public.scope_matches(centro_id, sucursal_id)
  AND (
    COALESCE(activo, true) = true
    OR public.current_app_role() = 'admin'
  )
);

CREATE POLICY pacientes_manage_scope
ON public.pacientes
FOR ALL
TO authenticated
USING (public.scope_matches(centro_id, sucursal_id))
WITH CHECK (public.scope_matches(centro_id, sucursal_id));

DROP POLICY IF EXISTS atenciones_read_scope ON public.atenciones;
DROP POLICY IF EXISTS atenciones_manage_scope ON public.atenciones;

CREATE POLICY atenciones_read_scope
ON public.atenciones
FOR SELECT
TO authenticated
USING (public.can_access_atencion_row(centro_id, sucursal_id, profesional_id));

CREATE POLICY atenciones_manage_scope
ON public.atenciones
FOR ALL
TO authenticated
USING (public.can_access_atencion_row(centro_id, sucursal_id, profesional_id))
WITH CHECK (public.can_access_atencion_row(centro_id, sucursal_id, profesional_id));

DROP POLICY IF EXISTS costos_read_admin ON public.costos;
DROP POLICY IF EXISTS costos_manage_admin ON public.costos;

CREATE POLICY costos_read_admin
ON public.costos
FOR SELECT
TO authenticated
USING (public.admin_scope_matches(centro_id, sucursal_id));

CREATE POLICY costos_manage_admin
ON public.costos
FOR ALL
TO authenticated
USING (public.admin_scope_matches(centro_id, sucursal_id))
WITH CHECK (public.admin_scope_matches(centro_id, sucursal_id));

DROP POLICY IF EXISTS tipos_atencion_read_scope ON public.tipos_atencion;
DROP POLICY IF EXISTS tipos_atencion_manage_admin ON public.tipos_atencion;

CREATE POLICY tipos_atencion_read_scope
ON public.tipos_atencion
FOR SELECT
TO authenticated
USING (
  public.scope_matches(centro_id, sucursal_id)
  AND (
    activo = true
    OR public.current_app_role() = 'admin'
  )
);

CREATE POLICY tipos_atencion_manage_admin
ON public.tipos_atencion
FOR ALL
TO authenticated
USING (public.admin_scope_matches(centro_id, sucursal_id))
WITH CHECK (public.admin_scope_matches(centro_id, sucursal_id));

DROP POLICY IF EXISTS centro_config_read_public ON public.centro_config;
DROP POLICY IF EXISTS centro_config_manage_admin ON public.centro_config;

CREATE POLICY centro_config_read_public
ON public.centro_config
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY centro_config_manage_admin
ON public.centro_config
FOR ALL
TO authenticated
USING (public.current_app_role() = 'admin')
WITH CHECK (public.current_app_role() = 'admin');

DROP POLICY IF EXISTS profesional_comisiones_read_scope ON public.profesional_comisiones;
DROP POLICY IF EXISTS profesional_comisiones_manage_admin ON public.profesional_comisiones;

CREATE POLICY profesional_comisiones_read_scope
ON public.profesional_comisiones
FOR SELECT
TO authenticated
USING (public.can_access_profesional_comision_row(profesional_id));

CREATE POLICY profesional_comisiones_manage_admin
ON public.profesional_comisiones
FOR ALL
TO authenticated
USING (
  public.current_app_role() = 'admin'
  AND public.can_access_profesional_comision_row(profesional_id)
)
WITH CHECK (
  public.current_app_role() = 'admin'
  AND public.can_access_profesional_comision_row(profesional_id)
);

DROP POLICY IF EXISTS disponibilidad_read_scope ON public.profesional_disponibilidad;
DROP POLICY IF EXISTS disponibilidad_manage_scope ON public.profesional_disponibilidad;

CREATE POLICY disponibilidad_read_scope
ON public.profesional_disponibilidad
FOR SELECT
TO authenticated
USING (public.can_access_disponibilidad_row(profesional_id, sucursal_id));

CREATE POLICY disponibilidad_manage_scope
ON public.profesional_disponibilidad
FOR ALL
TO authenticated
USING (public.can_access_disponibilidad_row(profesional_id, sucursal_id))
WITH CHECK (public.can_access_disponibilidad_row(profesional_id, sucursal_id));

DROP POLICY IF EXISTS pagos_profesionales_read_scope ON public.pagos_profesionales;
DROP POLICY IF EXISTS pagos_profesionales_manage_admin ON public.pagos_profesionales;

CREATE POLICY pagos_profesionales_read_scope
ON public.pagos_profesionales
FOR SELECT
TO authenticated
USING (public.can_access_pago_row(atencion_id, profesional_id));

CREATE POLICY pagos_profesionales_manage_admin
ON public.pagos_profesionales
FOR ALL
TO authenticated
USING (
  public.current_app_role() = 'admin'
  AND public.can_access_pago_row(atencion_id, profesional_id)
)
WITH CHECK (
  public.current_app_role() = 'admin'
  AND public.can_access_pago_row(atencion_id, profesional_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
  ) THEN
    EXECUTE 'ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS audit_logs_read_admin ON public.audit_logs';
    EXECUTE 'DROP POLICY IF EXISTS audit_logs_insert_authenticated ON public.audit_logs';
    EXECUTE 'CREATE POLICY audit_logs_read_admin ON public.audit_logs
      FOR SELECT TO authenticated
      USING (public.current_app_role() = ''admin'')';
    EXECUTE 'CREATE POLICY audit_logs_insert_authenticated ON public.audit_logs
      FOR INSERT TO authenticated
      WITH CHECK (changed_by = auth.uid())';
  END IF;
END $$;

REVOKE ALL ON public.usuarios FROM anon;
REVOKE ALL ON public.profesionales FROM anon;
REVOKE ALL ON public.pacientes FROM anon;
REVOKE ALL ON public.atenciones FROM anon;
REVOKE ALL ON public.costos FROM anon;
REVOKE ALL ON public.tipos_atencion FROM anon;
REVOKE ALL ON public.sucursales FROM anon;
REVOKE ALL ON public.profesional_comisiones FROM anon;
REVOKE ALL ON public.profesional_disponibilidad FROM anon;
REVOKE ALL ON public.pagos_profesionales FROM anon;

GRANT SELECT ON public.centros TO anon;
GRANT SELECT ON public.centro_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sucursales TO authenticated;
GRANT SELECT ON public.usuarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profesionales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacientes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atenciones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.costos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_atencion TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centro_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profesional_comisiones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profesional_disponibilidad TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagos_profesionales TO authenticated;
