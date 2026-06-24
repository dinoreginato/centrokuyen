ALTER TABLE public.atenciones
ADD COLUMN IF NOT EXISTS estado_cita text DEFAULT 'por_confirmar'
CHECK (estado_cita IN ('por_confirmar', 'confirmada', 'cancelada', 'reagendada'));

UPDATE public.atenciones
SET estado_cita = 'por_confirmar'
WHERE estado_cita IS NULL;
