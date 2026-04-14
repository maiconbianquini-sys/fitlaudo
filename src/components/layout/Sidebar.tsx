import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Plus, User, LogOut, Dumbbell } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/alunos', icon: Users, label: 'Alunos' },
  { to: '/alunos/novo', icon: Plus, label: 'Nova Avaliação', highlight: true },
  { to: '/perfil', icon: User, label: 'Meu Perfil' },
]

export function Sidebar() {
  const { treinador, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 min-h-screen">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center">
          <Dumbbell className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-gray-900 leading-none">FitLaudo</p>
          <p className="text-xs text-gray-500">Avaliação com IA</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label, highlight }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : highlight
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )
            }
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Trainer info + logout */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-primary-700 text-xs font-bold">
              {treinador?.nome?.[0]?.toUpperCase() ?? 'T'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{treinador?.nome}</p>
            {treinador?.cref && (
              <p className="text-xs text-gray-500 truncate">CREF: {treinador.cref}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
