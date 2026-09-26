UPDATE public.atenciones
SET tipo_atencion = NULL
WHERE COALESCE(es_bloqueo, false) = true;

ALTER TABLE public.atenciones
ALTER COLUMN tipo_atencion DROP NOT NULL;

ALTER TABLE public.atenciones
DROP CONSTRAINT IF EXISTS atenciones_tipo_atencion_requerido_chk;

ALTER TABLE public.atenciones
ADD CONSTRAINT atenciones_tipo_atencion_requerido_chk
CHECK (
  COALESCE(es_bloqueo, false) = true
  OR tipo_atencion IS NOT NULL
);
