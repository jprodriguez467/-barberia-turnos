import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import ReservarPage from './pages/ReservarPage';
import AdminPage from './pages/AdminPage';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

// Componente para rutas protegidas
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <AiOutlineLoading3Quarters className="text-4xl text-gold animate-spin" />
      </div>
    );
  }

  return user ? children : <Navigate to="/" replace />;
};

// Página de reserva (placeholder)
const ReservePage = () => {
  return <ReservarPage />;
};

// Página de administrador
const AdminPageComponent = () => {
  return <AdminPage />;
};

// Página de inicio - redirige si está logueado
const HomePage = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <AiOutlineLoading3Quarters className="text-4xl text-gold animate-spin" />
      </div>
    );
  }

  return user ? <Navigate to="/reservar" replace /> : <LoginPage />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/reservar"
          element={
            <ProtectedRoute>
              <ReservePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPageComponent />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
