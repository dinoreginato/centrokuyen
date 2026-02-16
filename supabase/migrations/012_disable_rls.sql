-- Deshabilitar RLS en todas las tablas para permitir el funcionamiento con Auth personalizado
-- Ya que no usamos supabase.auth.signIn() sino nuestra propia tabla de usuarios,
-- todas las peticiones llegan como 'anon' a la base de datos.

ALTER TABLE centro_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE sucursales DISABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE atenciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE costos DISABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE profesionales DISABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_profesionales DISABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_atencion DISABLE ROW LEVEL SECURITY;
