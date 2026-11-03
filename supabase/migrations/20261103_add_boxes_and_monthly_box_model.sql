CREATE TABLE IF NOT EXISTS public.boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE CASCADE,
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boxes_centro_id ON public.boxes(centro_id);
CREATE INDEX IF NOT EXISTS idx_boxes_sucursal_id ON public.boxes(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_boxes_activo ON public.boxes(activo);

ALTER TABLE public.profesionales
ADD COLUMN IF NOT EXISTS tipo_pago_base TEXT;

ALTER TABLE public.profesionales
ADD COLUMN IF NOT EXISTS monto_mensual_box NUMERIC(10,2) DEFAULT 0;

ALTER TABLE public.profesionales
ADD COLUMN IF NOT EXISTS box_id UUID REFERENCES public.boxes(id) ON DELETE SET NULL;

ALTER TABLE public.atenciones
ADD COLUMN IF NOT EXISTS box_id UUID REFERENCES public.boxes(id) ON DELETE SET NULL;

UPDATE public.profesionales
SET tipo_pago_base = CASE
  WHEN COALESCE(monto_fijo_pago, 0) > 0 THEN 'monto_fijo'
  ELSE 'porcentaje'
END
WHERE tipo_pago_base IS NULL;

ALTER TABLE public.profesionales
ALTER COLUMN tipo_pago_base SET DEFAULT 'porcentaje';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profesionales_tipo_pago_base_check'
  ) THEN
    ALTER TABLE public.profesionales
    ADD CONSTRAINT profesionales_tipo_pago_base_check
    CHECK (tipo_pago_base IN ('porcentaje', 'monto_fijo', 'mensual_box'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profesionales_box_id ON public.profesionales(box_id);
CREATE INDEX IF NOT EXISTS idx_atenciones_box_id ON public.atenciones(box_id);
