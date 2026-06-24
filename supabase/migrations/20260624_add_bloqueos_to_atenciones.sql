ALTER TABLE public.atenciones
ADD COLUMN IF NOT EXISTS es_bloqueo boolean DEFAULT false;

ALTER TABLE public.atenciones
ADD COLUMN IF NOT EXISTS tipo_bloqueo text
CHECK (tipo_bloqueo IN ('almuerzo', 'reunion', 'vacaciones', 'licencia', 'capacitacion', 'otro'));

UPDATE public.atenciones
SET es_bloqueo = false
WHERE es_bloqueo IS NULL;
