ALTER TABLE public.atenciones
  ADD COLUMN IF NOT EXISTS plan_tratamiento_id UUID,
  ADD COLUMN IF NOT EXISTS numero_sesion INTEGER,
  ADD COLUMN IF NOT EXISTS total_sesiones INTEGER;

CREATE INDEX IF NOT EXISTS idx_atenciones_plan_tratamiento_id
  ON public.atenciones(plan_tratamiento_id);

CREATE INDEX IF NOT EXISTS idx_atenciones_plan_tratamiento_orden
  ON public.atenciones(plan_tratamiento_id, fecha, hora);
