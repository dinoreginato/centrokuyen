import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { SucursalProvider, useSucursal } from '@/contexts/SucursalContext'
import Navigation from '@/components/Navigation'
import Header from '@/components/Header'
import Login from '@/components/Login'
import Dashboard from '@/components/Dashboard'
import ProfesionalesList from '@/components/ProfesionalesList'
import ProfesionalForm from '@/components/ProfesionalForm'
import PacientesList from '@/components/PacientesList'
import PacienteForm from '@/components/PacienteForm'
import Agenda from '@/components/Agenda'
import AtencionForm from '@/components/AtencionForm'
import AtencionesPorPaciente from '@/components/AtencionesPorPaciente'
import Disponibilidad from '@/components/Disponibilidad'
import CajaDiaria from '@/components/CajaDiaria'
import TiposAtencionList from '@/components/TiposAtencionList'
import TipoAtencionForm from '@/components/TipoAtencionForm'
import Reportes from '@/components/Reportes'
import PagosPendientes from '@/components/PagosPendientes'
import Costos from '@/components/Costos'
import Configuracion from '@/components/Configuracion'
import UsuariosList from '@/components/UsuariosList'
import '@/utils/seedConsole' // Importar el script de datos de prueba
import './App.css'

// Admin Route Component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
      </div>
    )
  }
  
  return user?.rol === 'admin' ? <>{children}</> : <Navigate to="/" replace />
}

const StaffRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
      </div>
    )
  }
  
  const isAuthorized = user?.rol === 'admin' || user?.rol === 'profesional'
  
  return isAuthorized ? <>{children}</> : <Navigate to="/" replace />
}

// Paciente Route Component (Admins OR Dalcahue Professionals)
const PacienteRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()
  const { currentSucursal } = useSucursal()
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
      </div>
    )
  }
  
  const isDalcahue = currentSucursal?.nombre?.toLowerCase().includes('dalcahue')
  const isAuthorized = user?.rol === 'admin' || (user?.rol === 'profesional' && isDalcahue)
  
  return isAuthorized ? <>{children}</> : <Navigate to="/" replace />
}

// Main App Content
const AppContent = () => {
  const { isAuthenticated } = useAuth()
  
  if (!isAuthenticated) {
    return <Login />
  }
  
  return (
    <div className="flex min-h-screen bg-medical-light">
      <Navigation />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            
            {/* Rutas exclusivas Admin */}
            <Route path="/profesionales" element={<AdminRoute><ProfesionalesList /></AdminRoute>} />
            <Route path="/profesionales/nuevo" element={<AdminRoute><ProfesionalForm /></AdminRoute>} />
            <Route path="/profesionales/:id" element={<AdminRoute><ProfesionalForm /></AdminRoute>} />
            <Route path="/pacientes" element={<PacienteRoute><PacientesList /></PacienteRoute>} />
            <Route path="/pacientes/nuevo" element={<PacienteRoute><PacienteForm /></PacienteRoute>} />
            <Route path="/pacientes/:id" element={<PacienteRoute><PacienteForm /></PacienteRoute>} />
            <Route path="/tipos-atencion" element={<AdminRoute><TiposAtencionList /></AdminRoute>} />
            <Route path="/tipos-atencion/nuevo" element={<AdminRoute><TipoAtencionFormWrapper /></AdminRoute>} />
            <Route path="/tipos-atencion/:id" element={<AdminRoute><TipoAtencionFormWrapper /></AdminRoute>} />
            <Route path="/pagos-pendientes" element={<AdminRoute><PagosPendientes /></AdminRoute>} />
            <Route path="/reportes" element={<AdminRoute><Reportes /></AdminRoute>} />
            <Route path="/costos" element={<AdminRoute><Costos /></AdminRoute>} />
            <Route path="/usuarios" element={<AdminRoute><UsuariosList /></AdminRoute>} />
            <Route path="/configuracion" element={<AdminRoute><Configuracion /></AdminRoute>} />
            
            {/* Rutas compartidas */}
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/agenda/nueva" element={<AtencionForm />} />
            <Route path="/agenda/:id" element={<AtencionForm />} />
            <Route path="/atenciones-por-paciente" element={<StaffRoute><AtencionesPorPaciente /></StaffRoute>} />
            <Route path="/disponibilidad" element={<StaffRoute><Disponibilidad /></StaffRoute>} />
            <Route path="/caja-diaria" element={<StaffRoute><CajaDiaria /></StaffRoute>} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <SucursalProvider>
        <Router>
          <AppContent />
        </Router>
        <Toaster position="top-right" />
      </SucursalProvider>
    </AuthProvider>
  )
}

// Componentes placeholder para las demás secciones (removido - no longer needed)
// const CostosPlaceholder = () => (
//   <div className="space-y-6">
//     <h1 className="text-2xl font-bold text-gray-800">Gestión de Costos</h1>
//     <div className="bg-white rounded-lg shadow-md p-6">
//       <p className="text-gray-600">Módulo de costos en desarrollo...</p>
//     </div>
//   </div>
// )

// Wrapper components for forms that need props
const TipoAtencionFormWrapper = () => {
  const navigate = useNavigate()
  
  const handleSuccess = () => {
    navigate('/tipos-atencion')
  }
  
  const handleCancel = () => {
    navigate('/tipos-atencion')
  }
  
  return <TipoAtencionForm tipo={undefined} onSuccess={handleSuccess} onCancel={handleCancel} />
}

export default App
