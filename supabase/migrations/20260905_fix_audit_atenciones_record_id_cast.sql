CREATE OR REPLACE FUNCTION public.audit_atenciones_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor_user_id UUID := auth.uid();
  actor_record public.usuarios%ROWTYPE;
  action_name TEXT;
BEGIN
  IF actor_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT *
  INTO actor_record
  FROM public.usuarios
  WHERE auth_user_id = actor_user_id
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    action_name := 'INSERT';
  ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.activo, true) = true AND COALESCE(NEW.activo, true) = false THEN
    action_name := 'SOFT_DELETE';
  ELSE
    action_name := 'UPDATE';
  END IF;

  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    metadata,
    changed_by,
    changed_by_usuario_id,
    actor_name,
    actor_email,
    actor_role,
    centro_id,
    sucursal_id
  )
  VALUES (
    'atenciones',
    COALESCE(NEW.id, OLD.id),
    action_name,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN action_name = 'SOFT_DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    jsonb_strip_nulls(jsonb_build_object(
      'source', 'sql_trigger',
      'estado_cita', COALESCE(NEW.estado_cita, OLD.estado_cita, 'por_confirmar'),
      'es_bloqueo', COALESCE(NEW.es_bloqueo, OLD.es_bloqueo, false)
    )),
    actor_user_id,
    actor_record.id,
    actor_record.nombre,
    actor_record.email,
    actor_record.rol,
    COALESCE(NEW.centro_id, OLD.centro_id),
    COALESCE(NEW.sucursal_id, OLD.sucursal_id)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
