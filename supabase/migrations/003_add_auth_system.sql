-- Tabla de usuarios para el sistema de autenticación
CREATE TABLE usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  rol VARCHAR(50) NOT NULL DEFAULT 'usuario' CHECK (rol IN ('admin', 'profesional', 'usuario')),
  activo BOOLEAN DEFAULT true,
  profesional_id UUID REFERENCES profesionales(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);

-- RLS (Row Level Security) para usuarios
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Usuarios pueden ver su propio perfil" ON usuarios
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admin puede ver todos los usuarios" ON usuarios
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'admin' 
      AND activo = true
    )
  );

CREATE POLICY "Admin puede crear usuarios" ON usuarios
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'admin' 
      AND activo = true
    )
  );

CREATE POLICY "Admin puede actualizar usuarios" ON usuarios
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'admin' 
      AND activo = true
    )
  );

-- Insertar usuario administrador por defecto (contraseña: admin123)
INSERT INTO usuarios (email, password_hash, nombre, rol, activo) VALUES 
('admin@centromedico.com', '$2b$10$rQZ9qV7LORzGFOyQqP7rKuLPMhK8fH9qZ9qV7LORzGFOyQqP7rKu', 'Administrador', 'admin', true);

-- Otorgar permisos
GRANT ALL ON usuarios TO anon;
GRANT ALL ON usuarios TO authenticated;