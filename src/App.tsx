import { Suspense, lazy, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { SucursalProvider } from '@/contexts/SucursalContext'
import Navigation from '@/components/Navigation'
import Header from '@/components/Header'
import PageLoader from '@/components/ui/PageLoader'
import { AppPermission, hasPermission } from '@/utils/permissions'
import '@/utils/seedConsole' // Importar el script de datos de prueba
import './App.css'

const Login = lazy(() => import('@/components/Login'))
const Dashboard = lazy(() => import('@/components/Dashboard'))
const ProfesionalesList = lazy(() => import('@/components/ProfesionalesList'))
const ProfesionalForm = lazy(() => import('@/components/ProfesionalForm'))
const PacientesList = lazy(() => import('@/components/PacientesList'))
const PacienteForm = lazy(() => import('@/components/PacienteForm'))
const Agenda = lazy(() => import('@/components/Agenda'))
const AtencionForm = lazy(() => import('@/components/AtencionForm'))
const AtencionesPorPaciente = lazy(() => import('@/components/AtencionesPorPaciente'))
const Disponibilidad = lazy(() => import('@/components/Disponibilidad'))
const TiposAtencionList = lazy(() => import('@/components/TiposAtencionList'))
const TipoAtencionForm = lazy(() => import('@/components/TipoAtencionForm'))
const Reportes = lazy(() => import('@/components/Reportes'))
const PagosPendientes = lazy(() => import('@/components/PagosPendientes'))
const Costos = lazy(() => import('@/components/Costos'))
const Configuracion = lazy(() => import('@/components/Configuracion'))
const UsuariosList = lazy(() => import('@/components/UsuariosList'))

const PermissionRoute = ({
  children,
  permission
}: {
  children: React.ReactNode
  permission: AppPermission
}) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <PageLoader label="Validando acceso..." compact />
  }

  return hasPermission(user, permission) ? <>{children}</> : <Navigate to="/" replace />
}

// Main App Content
const AppContent = () => {
  const { isAuthenticated } = useAuth()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PageLoader label="Cargando acceso..." />}>
        <Login />
      </Suspense>
    )
  }
  
  return (
    <div className="min-h-screen bg-medical-light lg:flex">
      <Navigation
        mobileOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header onMenuToggle={() => setIsMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Suspense fallback={<PageLoader label="Cargando módulo..." />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              
              {/* Rutas exclusivas Admin */}
              <Route path="/profesionales" element={<PermissionRoute permission="manageProfesionales"><ProfesionalesList /></PermissionRoute>} />
              <Route path="/profesionales/nuevo" element={<PermissionRoute permission="manageProfesionales"><ProfesionalForm /></PermissionRoute>} />
              <Route path="/profesionales/:id" element={<PermissionRoute permission="manageProfesionales"><ProfesionalForm /></PermissionRoute>} />
              <Route path="/pacientes" element={<PermissionRoute permission="viewPacientes"><PacientesList /></PermissionRoute>} />
              <Route path="/pacientes/nuevo" element={<PermissionRoute permission="managePacientes"><PacienteForm /></PermissionRoute>} />
              <Route path="/pacientes/:id" element={<PermissionRoute permission="managePacientes"><PacienteForm /></PermissionRoute>} />
              <Route path="/tipos-atencion" element={<PermissionRoute permission="manageTiposAtencion"><TiposAtencionList /></PermissionRoute>} />
              <Route path="/tipos-atencion/nuevo" element={<PermissionRoute permission="manageTiposAtencion"><TipoAtencionFormWrapper /></PermissionRoute>} />
              <Route path="/tipos-atencion/:id" element={<PermissionRoute permission="manageTiposAtencion"><TipoAtencionFormWrapper /></PermissionRoute>} />
              <Route path="/pagos-pendientes" element={<PermissionRoute permission="managePagos"><PagosPendientes /></PermissionRoute>} />
              <Route path="/reportes" element={<PermissionRoute permission="viewReportes"><Reportes /></PermissionRoute>} />
              <Route path="/costos" element={<PermissionRoute permission="viewCostos"><Costos /></PermissionRoute>} />
              <Route path="/usuarios" element={<PermissionRoute permission="manageUsuarios"><UsuariosList /></PermissionRoute>} />
              <Route path="/configuracion" element={<PermissionRoute permission="manageConfiguracion"><Configuracion /></PermissionRoute>} />
              
              {/* Rutas compartidas */}
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/agenda/nueva" element={<PermissionRoute permission="createAgenda"><AtencionForm /></PermissionRoute>} />
              <Route path="/agenda/:id" element={<PermissionRoute permission="createAgenda"><AtencionForm /></PermissionRoute>} />
              <Route path="/atenciones-por-paciente" element={<PermissionRoute permission="viewPatientHistory"><AtencionesPorPaciente /></PermissionRoute>} />
              <Route path="/disponibilidad" element={<PermissionRoute permission="viewDisponibilidad"><Disponibilidad /></PermissionRoute>} />
            </Routes>
          </Suspense>
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
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            duration: 3200
          }}
        />
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
