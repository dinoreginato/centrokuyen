CREATE INDEX IF NOT EXISTS idx_atenciones_overlap_guard
ON public.atenciones (profesional_id, fecha, hora)
WHERE activo = true;

CREATE OR REPLACE FUNCTION public.prevent_profesional_atencion_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  conflicting_record RECORD;
  new_start TIME;
  new_end TIME;
BEGIN
  IF NEW.activo IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.estado_cita, 'por_confirmar') IN ('cancelada', 'reagendada') THEN
    RETURN NEW;
  END IF;

  IF NEW.profesional_id IS NULL OR NEW.fecha IS NULL OR NEW.hora IS NULL THEN
    RETURN NEW;
  END IF;

  new_start := NEW.hora;
  new_end := NEW.hora + INTERVAL '60 minutes';

  SELECT
    a.id,
    a.hora,
    a.tipo_atencion,
    a.es_bloqueo,
    p.nombre AS paciente_nombre
  INTO conflicting_record
  FROM public.atenciones a
  LEFT JOIN public.pacientes p ON p.id = a.paciente_id
  WHERE a.activo = true
    AND a.profesional_id = NEW.profesional_id
    AND a.fecha = NEW.fecha
    AND a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND COALESCE(a.estado_cita, 'por_confirmar') NOT IN ('cancelada', 'reagendada')
    AND a.hora < new_end
    AND (a.hora + INTERVAL '60 minutes') > new_start
  ORDER BY a.hora
  LIMIT 1;

  IF conflicting_record IS NOT NULL THEN
    RAISE EXCEPTION
      'La profesional ya tiene ocupado ese horario a las % con %.',
      to_char(conflicting_record.hora, 'HH24:MI'),
      CASE
        WHEN conflicting_record.es_bloqueo THEN COALESCE(conflicting_record.tipo_atencion, 'bloque no clínico')
        WHEN conflicting_record.paciente_nombre IS NOT NULL THEN 'la atención de ' || conflicting_record.paciente_nombre
        ELSE 'otra atención'
      END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profesional_atencion_overlap_trigger ON public.atenciones;

CREATE TRIGGER prevent_profesional_atencion_overlap_trigger
BEFORE INSERT OR UPDATE OF profesional_id, fecha, hora, activo, estado_cita
ON public.atenciones
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profesional_atencion_overlap();
