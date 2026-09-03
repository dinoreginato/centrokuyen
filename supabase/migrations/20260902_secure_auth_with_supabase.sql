CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS auth_user_id UUID;

ALTER TABLE public.usuarios
ALTER COLUMN password_hash DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_auth_user_id_fkey'
  ) THEN
    ALTER TABLE public.usuarios
    ADD CONSTRAINT usuarios_auth_user_id_fkey
    FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_auth_user_id
ON public.usuarios(auth_user_id)
WHERE auth_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE auth_user_id = auth.uid()
      AND rol = 'admin'
      AND activo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.ensure_auth_identity(p_user_id UUID, p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  normalized_email TEXT := lower(trim(p_email));
BEGIN
  DELETE FROM auth.identities
  WHERE user_id = p_user_id
    AND provider = 'email'
    AND provider_id <> normalized_email;

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    p_user_id,
    normalized_email,
    jsonb_build_object(
      'sub', p_user_id::text,
      'email', normalized_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider, provider_id)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    identity_data = EXCLUDED.identity_data,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.create_auth_user_record(
  p_email TEXT,
  p_password TEXT,
  p_nombre TEXT,
  p_rol TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_auth_user_id UUID := gen_random_uuid();
  normalized_email TEXT := lower(trim(p_email));
BEGIN
  IF normalized_email = '' THEN
    RAISE EXCEPTION 'El email es obligatorio';
  END IF;

  IF COALESCE(length(p_password), 0) < 8 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 8 caracteres';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = normalized_email
  ) THEN
    RAISE EXCEPTION 'Ya existe un usuario con ese email';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_auth_user_id,
    'authenticated',
    'authenticated',
    normalized_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('nombre', p_nombre, 'rol', p_rol),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  PERFORM public.ensure_auth_identity(new_auth_user_id, normalized_email);

  RETURN new_auth_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_auth_user_record(
  p_auth_user_id UUID,
  p_email TEXT DEFAULT NULL,
  p_password TEXT DEFAULT NULL,
  p_nombre TEXT DEFAULT NULL,
  p_rol TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  current_email TEXT;
  target_email TEXT;
BEGIN
  SELECT email
  INTO current_email
  FROM auth.users
  WHERE id = p_auth_user_id
  FOR UPDATE;

  IF current_email IS NULL THEN
    RAISE EXCEPTION 'No existe el usuario de autenticación asociado';
  END IF;

  target_email := lower(trim(COALESCE(p_email, current_email)));

  IF p_email IS NOT NULL AND EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = target_email
      AND id <> p_auth_user_id
  ) THEN
    RAISE EXCEPTION 'Ya existe un usuario con ese email';
  END IF;

  IF NULLIF(p_password, '') IS NOT NULL AND length(p_password) < 8 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 8 caracteres';
  END IF;

  UPDATE auth.users
  SET
    email = target_email,
    encrypted_password = CASE
      WHEN NULLIF(p_password, '') IS NOT NULL THEN crypt(p_password, gen_salt('bf'))
      ELSE encrypted_password
    END,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_strip_nulls(
      jsonb_build_object(
        'nombre', p_nombre,
        'rol', p_rol
      )
    ),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE id = p_auth_user_id;

  PERFORM public.ensure_auth_identity(p_auth_user_id, target_email);
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
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'No autorizado para crear usuarios';
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
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'No autorizado para actualizar usuarios';
  END IF;

  SELECT *
  INTO current_user_record
  FROM public.usuarios
  WHERE id = p_usuario_id
  FOR UPDATE;

  IF current_user_record.id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
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
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'No autorizado para eliminar usuarios';
  END IF;

  SELECT *
  INTO current_user_record
  FROM public.usuarios
  WHERE id = p_usuario_id
  FOR UPDATE;

  IF current_user_record.id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
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

DO $$
DECLARE
  current_user_record RECORD;
  linked_auth_user_id UUID;
  normalized_email TEXT;
  legacy_password TEXT;
BEGIN
  FOR current_user_record IN
    SELECT *
    FROM public.usuarios
  LOOP
    normalized_email := lower(trim(current_user_record.email));

    SELECT id
    INTO linked_auth_user_id
    FROM auth.users
    WHERE lower(email) = normalized_email
    LIMIT 1;

    IF linked_auth_user_id IS NULL THEN
      linked_auth_user_id := gen_random_uuid();
      legacy_password := COALESCE(current_user_record.password_hash, '');

      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token,
        banned_until
      )
      VALUES (
        '00000000-0000-0000-0000-000000000000',
        linked_auth_user_id,
        'authenticated',
        'authenticated',
        normalized_email,
        CASE
          WHEN legacy_password = '' THEN crypt(substr(gen_random_uuid()::text, 1, 12), gen_salt('bf'))
          WHEN legacy_password LIKE '$2%' THEN legacy_password
          ELSE crypt(legacy_password, gen_salt('bf'))
        END,
        now(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        jsonb_build_object('nombre', current_user_record.nombre, 'rol', current_user_record.rol),
        COALESCE(current_user_record.created_at, now()),
        now(),
        '',
        '',
        '',
        '',
        CASE
          WHEN COALESCE(current_user_record.activo, true) THEN NULL
          ELSE '2200-01-01 00:00:00+00'::timestamptz
        END
      );
    ELSE
      UPDATE auth.users
      SET
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
          'nombre', current_user_record.nombre,
          'rol', current_user_record.rol
        ),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        banned_until = CASE
          WHEN COALESCE(current_user_record.activo, true) THEN NULL
          ELSE '2200-01-01 00:00:00+00'::timestamptz
        END,
        updated_at = now()
      WHERE id = linked_auth_user_id;
    END IF;

    PERFORM public.ensure_auth_identity(linked_auth_user_id, normalized_email);

    UPDATE public.usuarios
    SET
      auth_user_id = linked_auth_user_id,
      email = normalized_email,
      password_hash = NULL,
      updated_at = now()
    WHERE id = current_user_record.id;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_auth_identity(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_auth_user_record(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_auth_user_record(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_application_user(TEXT, TEXT, TEXT, TEXT, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_application_user(UUID, TEXT, TEXT, TEXT, TEXT, UUID, UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_application_user(UUID) TO authenticated;
