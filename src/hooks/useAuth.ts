import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  createElement,
} from 'react'
import { type Session, type User } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { type Treinador } from '../types'

interface AuthContextType {
  session: Session | null
  user: User | null
  treinador: Treinador | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [treinador, setTreinador] = useState<Treinador | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchTreinador(userId: string) {
    const { data, error } = await supabase
      .from('treinadores')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error && data) {
      setTreinador(data as Treinador)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchTreinador(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchTreinador(session.user.id)
      } else {
        setTreinador(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    if (data.user) {
      await fetchTreinador(data.user.id)
    }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setTreinador(null)
  }

  const value: AuthContextType = {
    session,
    user,
    treinador,
    loading,
    signIn,
    signOut,
  }

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}

export function useRequireAuth() {
  const auth = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!auth.loading && !auth.session) {
      navigate('/login')
    }
  }, [auth.loading, auth.session, navigate])

  return auth
}
