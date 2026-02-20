import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/Home'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminServices from './pages/admin/ServicesManagement'
import AdminPromotions from './pages/admin/PromotionsManagement'
import ClientDashboard from './pages/client/Dashboard'
import ClientAppointments from './pages/client/MyAppointments'
import ClientProfile from './pages/client/Profile'
import ProtectedRoute from './components/ProtectedRoute'
import ChatWidget from './components/ChatWidget'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute role="admin">
                  <Routes>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="services" element={<AdminServices />} />
                    <Route path="promotions" element={<AdminPromotions />} />
                    <Route path="*" element={<Navigate to="dashboard" replace />} />
                  </Routes>
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/*"
              element={
                <ProtectedRoute role="client">
                  <Routes>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<ClientDashboard />} />
                    <Route path="appointments" element={<ClientAppointments />} />
                    <Route path="profile" element={<ClientProfile />} />
                    <Route path="*" element={<Navigate to="dashboard" replace />} />
                  </Routes>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ChatWidget />
          <Toaster position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
