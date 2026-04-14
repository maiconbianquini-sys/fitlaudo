import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { AppLayout } from './components/layout/AppLayout'
import Login from './pages/Login'
import Registro from './pages/Registro'
import Dashboard from './pages/Dashboard'
import ListaAlunos from './pages/alunos/Lista'
import NovoAluno from './pages/alunos/Novo'
import PerfilAluno from './pages/alunos/Perfil'
import NovaAvaliacao from './pages/avaliacoes/NovaAvaliacao'
import ResultadoAvaliacao from './pages/avaliacoes/Resultado'
import VerTreino from './pages/treinos/VerTreino'
import PerfilPage from './pages/Perfil'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />

        <Route
          path="/dashboard"
          element={<AppLayout><Dashboard /></AppLayout>}
        />
        <Route
          path="/alunos"
          element={<AppLayout><ListaAlunos /></AppLayout>}
        />
        <Route
          path="/alunos/novo"
          element={<AppLayout><NovoAluno /></AppLayout>}
        />
        <Route
          path="/alunos/:id"
          element={<AppLayout><PerfilAluno /></AppLayout>}
        />
        <Route
          path="/alunos/:id/nova-avaliacao"
          element={<AppLayout><NovaAvaliacao /></AppLayout>}
        />
        <Route
          path="/avaliacoes/:id"
          element={<AppLayout><ResultadoAvaliacao /></AppLayout>}
        />
        <Route
          path="/treinos/:id"
          element={<AppLayout><VerTreino /></AppLayout>}
        />
        <Route
          path="/perfil"
          element={<AppLayout><PerfilPage /></AppLayout>}
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}
