import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import { Usuario } from '@/types/database'
import { supabase, usuariosService } from '@/utils/supabase'

interface AuthContextType {
  user: Usuario | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
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
    let isMounted = true

    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!isMounted) return
        await syncSessionUser(data.session)
      } catch (error) {
        console.error('Error checking auth:', error)
        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) {
          localStorage.removeItem('user')
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSessionUser(session)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const syncSessionUser = async (session: Session | null) => {
    if (!session?.user) {
      setUser(null)
      localStorage.removeItem('user')
      return
    }

    const profile = await usuariosService.getByAuthUserId(session.user.id)

    if (!profile) {
      await supabase.auth.signOut()
      throw new Error('Tu cuenta no tiene un perfil activo en el sistema')
    }

    if (!profile.activo) {
      await supabase.auth.signOut()
      throw new Error('Usuario desactivado')
    }

    setUser(profile)
    localStorage.removeItem('user')
  }

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      throw new Error('Credenciales inválidas')
    }

    await syncSessionUser(data.session)
  }

  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
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
