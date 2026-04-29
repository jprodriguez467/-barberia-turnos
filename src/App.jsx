import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import ReservarPage from './pages/ReservarPage';
import AdminPage from './pages/AdminPage';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('ErrorBoundary:', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center text-white">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Error en la aplicación</h2>
            <p className="text-gray-400 mb-4">Ha ocurrido un error inesperado.</p>
            <p className="text-sm text-gray-500 mb-4">{this.state.error?.message}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-gold text-black rounded hover:bg-gold/90">
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const LoadingScreen = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <AiOutlineLoading3Quarters className="text-4xl text-gold animate-spin" />
  </div>
);

// Ruta protegida para cualquier usuario logueado
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/" replace />;
};

// Ruta protegida SOLO para admin
const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/reservar" replace />;
  return children;
};

// Página de inicio
const HomePage = () => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to={isAdmin ? '/admin' : '/reservar'} replace />;
  return <LoginPage />;
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/reservar" element={<ProtectedRoute><ReservarPage /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
