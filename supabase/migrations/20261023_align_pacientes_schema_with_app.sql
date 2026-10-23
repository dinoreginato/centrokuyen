ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;

ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;

UPDATE public.pacientes
SET activo = true
WHERE activo IS NULL;

ALTER TABLE public.pacientes
ALTER COLUMN activo SET DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_pacientes_activo
ON public.pacientes(activo);
