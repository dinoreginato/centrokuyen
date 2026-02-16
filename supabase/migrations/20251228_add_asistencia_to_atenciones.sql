ALTER TABLE public.atenciones 
ADD COLUMN IF NOT EXISTS estado_asistencia text DEFAULT 'pendiente' CHECK (estado_asistencia IN ('pendiente', 'asistio', 'no_asistio'));
