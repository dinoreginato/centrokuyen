CREATE OR REPLACE FUNCTION public.set_atencion_pagado(
  p_atencion_id UUID,
  p_pagado BOOLEAN DEFAULT true
)
RETURNS public.atenciones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_record public.atenciones%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para registrar pagos';
  END IF;

  SELECT *
  INTO target_record
  FROM public.atenciones
  WHERE id = p_atencion_id
  LIMIT 1;

  IF target_record IS NULL THEN
    RAISE EXCEPTION 'La atención que intentas actualizar no existe';
  END IF;

  IF NOT public.can_access_atencion_row(
    target_record.centro_id,
    target_record.sucursal_id,
    target_record.profesional_id
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para actualizar el pago de esta atención';
  END IF;

  IF COALESCE(target_record.estado_cita, 'por_confirmar') IN ('cancelada', 'reagendada') THEN
    RAISE EXCEPTION 'No puedes marcar pago en una cita %', COALESCE(target_record.estado_cita, 'por_confirmar');
  END IF;

  UPDATE public.atenciones
  SET
    pagado = p_pagado,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_atencion_id
  RETURNING *
  INTO target_record;

  RETURN target_record;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_atencion_pagado(UUID, BOOLEAN) TO authenticated;
