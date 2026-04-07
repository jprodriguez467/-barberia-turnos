import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import ReservarPage from './pages/ReservarPage';
import AdminPage from './pages/AdminPage';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

// Error Boundary para capturar errores de renderizado
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturó un error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center text-white">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Error en la aplicación</h2>
            <p className="text-gray-400 mb-4">Ha ocurrido un error inesperado en la aplicación.</p>
            <p className="text-sm text-gray-500 mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gold text-black rounded hover:bg-gold/90"
            >
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default App;
