CREATE TABLE IF NOT EXISTS public.profesional_comisiones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profesional_id uuid REFERENCES public.profesionales(id) ON DELETE CASCADE NOT NULL,
    tipo_atencion_id uuid REFERENCES public.tipos_atencion(id) ON DELETE CASCADE NOT NULL,
    porcentaje integer CHECK (porcentaje >= 0 AND porcentaje <= 100),
    monto_fijo numeric(10, 2),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(profesional_id, tipo_atencion_id)
);

ALTER TABLE public.profesional_comisiones DISABLE ROW LEVEL SECURITY;
