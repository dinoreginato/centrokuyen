import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Usuario } from '@/types/database'
import { usuariosService } from '@/utils/supabase'

interface AuthContextType {
  user: Usuario | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
  isAuthenticated: boolean
  hasRole: (role: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar si hay sesión activa al cargar
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // Aquí iría la lógica para verificar el token/session
      // Por ahora, simularemos que el usuario está guardado en localStorage
      const savedUser = localStorage.getItem('user')
      if (savedUser) {
        setUser(JSON.parse(savedUser))
      }
    } catch (error) {
      console.error('Error checking auth:', error)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      // Intentar buscar en la base de datos primero
      try {
        const usuarios = await usuariosService.getAll()
        const dbUser = usuarios.find(u => u.email === email)
        
        if (dbUser) {
          // Verificación simplificada de contraseña para el prototipo
          // En producción usar bcrypt.compare(password, dbUser.password_hash)
          if (password === 'admin123' || dbUser.password_hash === password) {
            if (!dbUser.activo) throw new Error('Usuario desactivado')
            setUser(dbUser)
            localStorage.setItem('user', JSON.stringify(dbUser))
            return
          }
        }
      } catch (err) {
        console.warn('No se pudo conectar con la base de datos de usuarios, usando fallback local', err)
      }

      // Usuarios de prueba hardcodeados (fallback)
      const testUsers: Usuario[] = [
        {
          id: 'admin-001',
          nombre: 'Administrador',
          email: 'admin@centrokuyen.com',
          password_hash: 'admin123',
          rol: 'admin',
          activo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'user-001', 
          nombre: 'Usuario Demo',
          email: 'demo@centrokuyen.com',
          password_hash: 'admin123',
          rol: 'usuario',
          activo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'prof-demo',
          nombre: 'Profesional Demo',
          email: 'profesional@centrokuyen.com',
          password_hash: 'admin123',
          rol: 'profesional',
          activo: true,
          // ID vinculado al doctor creado en la migración 009
          profesional_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]

      // Buscar usuario por email en fallback
      const usuario = testUsers.find(u => u.email === email)
      
      if (!usuario) {
        throw new Error('Usuario no encontrado')
      }

      if (!usuario.activo) {
        throw new Error('Usuario desactivado')
      }

      // Verificar contraseña (simulado - en producción usar bcrypt)
      if (password !== 'admin123') {
        throw new Error('Contraseña incorrecta')
      }

      // Guardar usuario en estado y localStorage
      setUser(usuario)
      localStorage.setItem('user', JSON.stringify(usuario))
      
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
  }

  const hasRole = (role: string): boolean => {
    return user?.rol === role
  }

  const value: AuthContextType = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    hasRole
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}