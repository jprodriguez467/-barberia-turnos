import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { FiUser, FiPhone, FiChevronRight, FiArrowLeft } from 'react-icons/fi';

const LoginPage = () => {
  const navigate = useNavigate();
  const { buscarClientePorNombre, loginConNombre } = useAuth();

  const [step, setStep] = useState('name'); // 'name' | 'whatsapp'
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [whatsappReason, setWhatsappReason] = useState(''); // 'multiple' | 'notfound'
  const [clienteEncontrado, setClienteEncontrado] = useState(null);

  const capitalize = (str) =>
    str.trim().replace(/\b\w/g, (c) => c.toUpperCase());

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!nombre.trim() || !apellido.trim()) {
      setError('Ingresá tu nombre y apellido');
      return;
    }
    setLoading(true);
    const result = await buscarClientePorNombre(capitalize(nombre), capitalize(apellido));

    if (result.status === 'found') {
      const ok = await loginConNombre(result.cliente, null);
      if (ok) navigate('/reservar');
      else setError('Error al iniciar sesión. Intentá de nuevo.');
    } else if (result.status === 'multiple') {
      setWhatsappReason('multiple');
      setStep('whatsapp');
    } else {
      setWhatsappReason('notfound');
      setStep('whatsapp');
    }
    setLoading(false);
  };

  const handleWhatsappSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleaned = telefono.replace(/\D/g, '');
    if (cleaned.length < 8) {
      setError('Ingresá un número de WhatsApp válido');
      return;
    }
    setLoading(true);
    const clienteData = clienteEncontrado || {
      nombre: capitalize(nombre),
      apellido: capitalize(apellido),
      nombreCompleto: `${capitalize(nombre)} ${capitalize(apellido)}`,
    };
    const ok = await loginConNombre(clienteData, `+54${cleaned}`);
    if (ok) navigate('/reservar');
    else setError('Error al iniciar sesión. Intentá de nuevo.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gold mb-2">Salón de los Dioses</h1>
          <p className="text-gray-400 text-sm">Reservá tu turno online</p>
        </div>

        <div className="bg-gray-900 border border-gold/30 rounded-xl p-8 shadow-2xl">

          {/* STEP: nombre + apellido */}
          {step === 'name' && (
            <form onSubmit={handleNameSubmit} className="space-y-5">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FiUser className="text-gold text-xl" />
                </div>
                <h2 className="text-white font-semibold text-lg">¿Cómo te llamás?</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Buscamos tu perfil para mostrarte tu precio
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">
                  Nombre
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => { setNombre(e.target.value); setError(''); }}
                  placeholder="Juan"
                  autoFocus
                  className="w-full px-4 py-3 bg-gray-800 border border-gold/20 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">
                  Apellido
                </label>
                <input
                  type="text"
                  value={apellido}
                  onChange={(e) => { setApellido(e.target.value); setError(''); }}
                  placeholder="García"
                  className="w-full px-4 py-3 bg-gray-800 border border-gold/20 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !nombre.trim() || !apellido.trim()}
                className="w-full bg-gold text-black font-bold py-3 rounded-lg hover:bg-gold/90 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <AiOutlineLoading3Quarters className="animate-spin text-lg" />
                ) : (
                  <>Continuar <FiChevronRight /></>
                )}
              </button>
            </form>
          )}

          {/* STEP: whatsapp */}
          {step === 'whatsapp' && (
            <form onSubmit={handleWhatsappSubmit} className="space-y-5">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FiPhone className="text-green-400 text-xl" />
                </div>
                <h2 className="text-white font-semibold text-lg">
                  {whatsappReason === 'multiple'
                    ? 'Ya existe un cliente con ese nombre'
                    : '¡Bienvenido/a!'}
                </h2>
              </div>

              {/* Explicación */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-400 text-sm leading-relaxed">
                  {whatsappReason === 'multiple'
                    ? 'Para identificarte correctamente necesitamos tu número de WhatsApp.'
                    : 'Para que el salón pueda comunicarse con vos (recordatorios, cambios de turno o novedades), necesitamos tu número de WhatsApp.'}
                </p>
                <p className="text-green-300/70 text-xs mt-2">
                  Tu número solo lo usa el salón para contactarte a vos. No se comparte con nadie.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">
                  Número de WhatsApp
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 bg-gray-800 border border-r-0 border-gold/20 rounded-l-lg text-gray-400 text-sm font-medium">
                    +54
                  </span>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => { setTelefono(e.target.value.replace(/\D/g, '')); setError(''); }}
                    placeholder="9 11 1234 5678"
                    autoFocus
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gold/20 rounded-r-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Sin el 0 inicial. Ej: 9 342 456 7890</p>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || telefono.replace(/\D/g, '').length < 8}
                className="w-full bg-gold text-black font-bold py-3 rounded-lg hover:bg-gold/90 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <AiOutlineLoading3Quarters className="animate-spin text-lg" />
                ) : (
                  <>Reservar turno <FiChevronRight /></>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep('name'); setTelefono(''); setError(''); }}
                className="w-full text-gray-500 text-sm py-2 hover:text-gray-300 transition flex items-center justify-center gap-1"
              >
                <FiArrowLeft className="text-xs" /> Volver
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          Al continuar, aceptás nuestros términos y condiciones
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
