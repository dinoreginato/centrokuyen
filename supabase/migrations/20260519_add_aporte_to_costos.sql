ALTER TABLE costos DROP CONSTRAINT IF EXISTS costos_tipo_check;

DO $$
BEGIN
  ALTER TABLE costos
    ADD CONSTRAINT costos_tipo_check CHECK (tipo IN ('fijo', 'variable', 'aporte'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

