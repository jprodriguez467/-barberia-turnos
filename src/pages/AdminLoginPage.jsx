import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { FaGoogle } from 'react-icons/fa';
import { GiScissors } from 'react-icons/gi';

const AdminLoginPage = () => {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loginWithGoogle();
      if (result.success) {
        navigate('/admin');
      } else {
        setError(result.error || 'No tenés acceso como administrador.');
      }
    } catch (e) {
      setError('Error al iniciar sesión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-yellow-400 mb-4">
            <GiScissors className="text-yellow-400 text-3xl" />
          </div>
          <h1 className="text-white text-2xl font-bold tracking-widest uppercase">Panel Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Acceso exclusivo para administradores</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <p className="text-gray-400 text-sm text-center mb-6">
            Iniciá sesión con tu cuenta de Google para acceder al panel de turnos
          </p>

          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg px-4 py-3 mb-4">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <AiOutlineLoading3Quarters className="text-xl animate-spin text-gray-700" />
            ) : (
              <FaGoogle className="text-xl text-red-500" />
            )}
            {loading ? 'Iniciando sesión...' : 'Entrar con Google'}
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          ¿Sos cliente?{' '}
          <a href="/" className="text-yellow-400 hover:underline">
            Reservá tu turno acá
          </a>
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
