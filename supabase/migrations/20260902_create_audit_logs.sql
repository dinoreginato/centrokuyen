CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_by_usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_email TEXT,
  actor_role TEXT,
  centro_id UUID REFERENCES public.centros(id) ON DELETE SET NULL,
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by ON public.audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_centro_id ON public.audit_logs(centro_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_sucursal_id ON public.audit_logs(sucursal_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_read_admin ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert_authenticated ON public.audit_logs;

CREATE POLICY audit_logs_read_admin
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.current_app_role() = 'admin');

CREATE POLICY audit_logs_insert_authenticated
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (changed_by = auth.uid());
