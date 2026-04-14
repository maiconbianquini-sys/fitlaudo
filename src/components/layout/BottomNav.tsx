import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Plus, User } from 'lucide-react'
import { cn } from '../../lib/utils'

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center justify-around px-4 py-2">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            cn('flex flex-col items-center gap-1 p-2 rounded-lg transition-colors', isActive ? 'text-primary-600' : 'text-gray-500')
          }
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-xs">Início</span>
        </NavLink>

        <NavLink
          to="/alunos"
          className={({ isActive }) =>
            cn('flex flex-col items-center gap-1 p-2 rounded-lg transition-colors', isActive ? 'text-primary-600' : 'text-gray-500')
          }
        >
          <Users className="h-5 w-5" />
          <span className="text-xs">Alunos</span>
        </NavLink>

        {/* Central highlighted button */}
        <NavLink
          to="/alunos/novo"
          className="flex flex-col items-center gap-1 -mt-6"
        >
          <div className="w-14 h-14 bg-primary-500 rounded-full flex items-center justify-center shadow-lg hover:bg-primary-600 transition-colors">
            <Plus className="h-7 w-7 text-white" />
          </div>
          <span className="text-xs text-primary-600 font-medium">Avaliar</span>
        </NavLink>

        <NavLink
          to="/perfil"
          className={({ isActive }) =>
            cn('flex flex-col items-center gap-1 p-2 rounded-lg transition-colors', isActive ? 'text-primary-600' : 'text-gray-500')
          }
        >
          <User className="h-5 w-5" />
          <span className="text-xs">Perfil</span>
        </NavLink>
      </div>
    </nav>
  )
}
