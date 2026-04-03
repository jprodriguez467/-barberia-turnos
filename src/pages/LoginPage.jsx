import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiSmartphone, FiLock } from 'react-icons/fi';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

const LoginPage = () => {
  const navigate = useNavigate();
  const { loginWithPhone, verifyOTP, confirmationResult, initializeRecaptcha } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState('phone'); // 'phone' o 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePhoneChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    // Limitar a 10 dígitos (sin el +54)
    if (value.length > 10) {
      value = value.slice(0, 10);
    }
    setPhone(value);
    setError('');
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (phone.length !== 10) {
      setError('Ingresa un número válido de 10 dígitos');
      return;
    }

    setLoading(true);
    console.log('Inicializando reCAPTCHA en onClick');
    initializeRecaptcha();
    const formattedPhone = `+54${phone}`;
    const success = await loginWithPhone(formattedPhone);

    if (success) {
      setStep('otp');
    } else {
      setError('Error al enviar el código. Intenta de nuevo');
    }
    setLoading(false);
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto focus siguiente input
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`).focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`).focus();
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Ingresa los 6 dígitos del código');
      return;
    }

    setLoading(true);
    const success = await verifyOTP(otpCode);

    if (success) {
      navigate('/reservar');
    } else {
      setError('Código inválido. Intenta de nuevo');
      setOtp(['', '', '', '', '', '']);
      document.getElementById('otp-0')?.focus();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Título */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gold mb-2">
            Salón de los Dioses
          </h1>
          <p className="text-gray-400">Tu reserva de turnos online</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gold/30 rounded-lg p-8 shadow-2xl">
          {step === 'phone' ? (
            // Formulario de Teléfono
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gold mb-3">
                  <FiSmartphone className="inline mr-2" />
                  Número de Teléfono
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-4 bg-gray-800 border border-r-0 border-gold/30 rounded-l text-gray-400 font-medium">
                    +54
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="9 1234 5678"
                    maxLength="10"
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gold/30 rounded-r text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Ingresa 10 dígitos sin el 0 inicial
                </p>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/50 rounded p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                id="send-code-button"
                type="submit"
                disabled={loading || phone.length !== 10}
                className="w-full bg-gold text-black font-bold py-3 rounded-lg hover:bg-gold/90 disabled:bg-gray-600 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <AiOutlineLoading3Quarters className="animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Recibir código por WhatsApp'
                )}
              </button>
            </form>
          ) : (
            // Formulario de OTP
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gold mb-4 text-center">
                  <FiLock className="inline mr-2" />
                  Ingresa el código de 6 dígitos
                </label>

                <div className="flex gap-2 justify-center">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      maxLength="1"
                      className="w-12 h-12 text-center text-lg font-bold bg-gray-800 border border-gold/30 rounded text-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition"
                    />
                  ))}
                </div>

                <p className="text-xs text-gray-400 mt-3 text-center">
                  Recibiste un código por WhatsApp
                </p>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/50 rounded p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="w-full bg-gold text-black font-bold py-3 rounded-lg hover:bg-gold/90 disabled:bg-gray-600 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <AiOutlineLoading3Quarters className="animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Verificar código'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setPhone('');
                  setOtp(['', '', '', '', '', '']);
                  setError('');
                }}
                className="w-full text-gold font-medium py-2 hover:text-gold/80 transition"
              >
                ← Volver
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-8">
          Al continuar, aceptas nuestros términos y condiciones
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
