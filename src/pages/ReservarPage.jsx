import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import toast from 'react-hot-toast';
import {
  FiChevronLeft,
  FiChevronRight,
  FiCheck,
  FiClock,
  FiUser,
  FiCalendar,
  FiCheckCircle,
} from 'react-icons/fi';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

const DEFAULT_SERVICIOS = [
  {
    id: 'corte',
    nombre: 'Corte de pelo',
    icono: '✂️',
    duracion: '30 min',
    precios: { normal: 18000, dias15: 15000, dias10: 12000 },
    foto: null,
    activo: true,
  },
  {
    id: 'corte_barba',
    nombre: 'Corte + Arreglo de barba',
    icono: '✂️🪒',
    duracion: '45 min',
    precios: { normal: 22000, dias15: 18000, dias10: 15000 },
    foto: null,
    activo: true,
  },
  {
    id: 'barba',
    nombre: 'Arreglo de barba',
    icono: '🪒',
    duracion: '20 min',
    precios: { normal: 8000, dias15: 6500, dias10: 5000 },
    foto: null,
    activo: true,
  },
];

const DEFAULT_PROFESIONALES = [
  { id: 'juan', nombre: 'Juan', especialidad: 'Barbero', foto: null, activo: true },
];

const HORARIOS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00',
];

const ReservarPage = () => {
  const navigate = useNavigate();
  const { user, userDoc, logout } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedProfesional, setSelectedProfesional] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [occupiedSlots, setOccupiedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [servicios, setServicios] = useState(DEFAULT_SERVICIOS);
  const [profesionales, setProfesionales] = useState(DEFAULT_PROFESIONALES);
  const [turnoConfirmado, setTurnoConfirmado] = useState(null); // datos del turno confirmado

  useEffect(() => {
    const loadData = async () => {
      try {
        const configRef = doc(db, 'configuracion', 'servicios');
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
          const data = configSnap.data();
          setServicios(data.servicios || DEFAULT_SERVICIOS);
        }
        const profQuerySnapshot = await getDocs(collection(db, 'profesionales'));
        const profs = [];
        profQuerySnapshot.forEach((docSnap) => {
          const prof = docSnap.data();
          if (prof.activo) profs.push({ id: docSnap.id, ...prof });
        });
        if (profs.length > 0) setProfesionales(profs);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const calculatePrice = (service) => {
    const ultimoCorteRaw = userDoc?.ultimoCorte || userDoc?.ultimoTurno;
    if (!ultimoCorteRaw) return { price: service.precios.normal, discount: null, message: null };
    const lastCorte = ultimoCorteRaw.toDate ? ultimoCorteRaw.toDate() : new Date(ultimoCorteRaw);
    const diffDays = Math.floor((Date.now() - lastCorte.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 10) return { price: service.precios.dias10, discount: service.precios.normal, message: `¡Volviste en ${diffDays} días! Precio especial activo` };
    if (diffDays < 15) return { price: service.precios.dias15, discount: service.precios.normal, message: `¡Volviste en ${diffDays} días! Precio especial activo` };
    return { price: service.precios.normal, discount: null, message: null };
  };

  const fetchOccupiedSlots = async (date, profesionalId) => {
    if (!date || !profesionalId) return;
    try {
      const dateStr = date.toISOString().split('T')[0];
      const q = query(
        collection(db, 'turnos'),
        where('profesional', '==', profesionalId),
        where('fecha', '==', dateStr),
        where('estado', '==', 'confirmado')
      );
      const snap = await getDocs(q);
      setOccupiedSlots(snap.docs.map((d) => d.data().hora));
    } catch (error) {
      console.error('Error obteniendo horarios:', error);
    }
  };

  useEffect(() => {
    if (selectedDate && selectedProfesional) fetchOccupiedSlots(selectedDate, selectedProfesional.id);
  }, [selectedDate, selectedProfesional]);

  const generateCalendarDates = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const dates = [];
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) dates.push(new Date(d));
    return dates;
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(price);

  const confirmTurno = async () => {
    if (!selectedService || !selectedProfesional || !selectedDate || !selectedTime) {
      toast.error('Completá todos los pasos antes de confirmar');
      return;
    }
    setConfirming(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const priceInfo = calculatePrice(selectedService);

      await addDoc(collection(db, 'turnos'), {
        usuarioId: user.uid,
        telefono: user.phoneNumber || userDoc?.telefono || '',
        nombreCliente: userDoc?.nombreCompleto || userDoc?.nombre || '',
        servicio: selectedService.id,
        profesional: selectedProfesional.id,
        fecha: dateStr,
        hora: selectedTime,
        precioFinal: priceInfo.price,
        estado: 'confirmado',
        recordatorio24h: false,
        recordatorio1h: false,
        creadoEn: serverTimestamp(),
      });

      await updateDoc(doc(db, 'usuarios', user.uid), {
        ultimoCorte: serverTimestamp(),
      });

      // Guardar datos para la pantalla de éxito
      setTurnoConfirmado({
        servicio: selectedService.nombre,
        profesional: selectedProfesional.nombre,
        fecha: selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }),
        hora: selectedTime,
        precio: formatPrice(priceInfo.price),
        nombre: userDoc?.nombre || '',
      });
    } catch (error) {
      console.error('Error confirmando turno:', error);
      toast.error('Error al confirmar el turno. Intentá de nuevo');
    } finally {
      setConfirming(false);
    }
  };

  // ── Pantalla de ÉXITO ─────────────────────────────────────────────────────
  const renderSuccess = () => (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">

        {/* Ícono animado */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-24 h-24 bg-green-500/10 border-2 border-green-500/40 rounded-full flex items-center justify-center">
            <span className="text-5xl">👍</span>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-green-400 mb-2">¡Turno confirmado!</h1>
        <p className="text-gray-400 text-lg mb-8">
          Te esperamos{turnoConfirmado.nombre ? `, ${turnoConfirmado.nombre}` : ''}
        </p>

        {/* Tarjeta resumen */}
        <div className="bg-gray-900 border border-green-500/20 rounded-xl p-6 mb-8 text-left space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400">Servicio</span>
            <span className="text-white font-medium">{turnoConfirmado.servicio}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Con</span>
            <span className="text-white font-medium">{turnoConfirmado.profesional}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Fecha</span>
            <span className="text-white font-medium capitalize">{turnoConfirmado.fecha}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Hora</span>
            <span className="text-white font-medium">{turnoConfirmado.hora}</span>
          </div>
          <div className="border-t border-gray-700 pt-3 flex justify-between">
            <span className="text-gold font-semibold">Total</span>
            <span className="text-gold font-bold text-lg">{turnoConfirmado.precio}</span>
          </div>
        </div>

        <button
          onClick={() => {
            setTurnoConfirmado(null);
            setCurrentStep(1);
            setSelectedService(null);
            setSelectedProfesional(null);
            setSelectedDate(null);
            setSelectedTime(null);
          }}
          className="w-full py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition font-medium"
        >
          Reservar otro turno
        </button>
      </div>
    </div>
  );

  const renderProgressBar = () => {
    const steps = [
      { id: 1, label: 'Servicio', icon: FiCheck },
      { id: 2, label: 'Profesional', icon: FiUser },
      { id: 3, label: 'Fecha y Hora', icon: FiCalendar },
      { id: 4, label: 'Confirmar', icon: FiCheckCircle },
    ];
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className={`flex flex-col items-center ${currentStep >= step.id ? 'text-gold' : 'text-gray-600'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${currentStep >= step.id ? 'border-gold bg-gold text-black' : 'border-gray-600'}`}>
                  <step.icon className="w-5 h-5" />
                </div>
                <span className="text-xs mt-2 font-medium">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${currentStep > step.id ? 'bg-gold' : 'bg-gray-600'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gold text-center mb-6">Elige tu servicio</h2>
      {(userDoc?.ultimoCorte || userDoc?.ultimoTurno) && (() => {
        const raw = userDoc?.ultimoCorte || userDoc?.ultimoTurno;
        const fecha = raw.toDate ? raw.toDate() : new Date(raw);
        const dias = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
        const restantes = 15 - dias;
        if (restantes > 0) return (
          <div className="max-w-md mx-auto bg-green-900/20 border border-green-500/30 rounded-lg p-3 text-center">
            <p className="text-green-400 text-sm font-medium">¡Tenés descuento activo! Te quedan {restantes} días para precio especial</p>
          </div>
        );
        return null;
      })()}
      <div className="grid gap-4 max-w-md mx-auto">
        {servicios.map((servicio) => {
          const priceInfo = calculatePrice(servicio);
          return (
            <div
              key={servicio.id}
              onClick={() => setSelectedService(servicio)}
              className={`p-6 bg-gray-800 border-2 rounded-lg cursor-pointer transition-all hover:border-gold/50 ${selectedService?.id === servicio.id ? 'border-gold bg-gray-700' : 'border-gray-600'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{servicio.icono}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{servicio.nombre}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <FiClock className="w-4 h-4" />{servicio.duracion}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {priceInfo.discount && <div className="text-sm text-gray-500 line-through">{formatPrice(priceInfo.discount)}</div>}
                  <div className={`text-lg font-bold ${priceInfo.discount ? 'text-green-400' : 'text-gold'}`}>{formatPrice(priceInfo.price)}</div>
                </div>
              </div>
              {priceInfo.message && <div className="mt-3 text-sm text-green-400 bg-green-900/20 rounded p-2">{priceInfo.message}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gold text-center mb-6">Elige tu profesional</h2>
      <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
        {profesionales.map((profesional) => (
          <div
            key={profesional.id}
            onClick={() => setSelectedProfesional(profesional)}
            className={`p-6 bg-gray-800 border-2 rounded-lg cursor-pointer transition-all hover:border-gold/50 ${selectedProfesional?.id === profesional.id ? 'border-gold bg-gray-700' : 'border-gray-600'}`}
          >
            <div className="text-center">
              {profesional.foto
                ? <img src={profesional.foto} alt={profesional.nombre} className="w-16 h-16 rounded-full mx-auto mb-4 object-cover" />
                : <div className="w-16 h-16 bg-gray-600 rounded-full mx-auto mb-4 flex items-center justify-center"><FiUser className="w-8 h-8 text-gray-400" /></div>
              }
              <h3 className="text-lg font-semibold text-white">{profesional.nombre}</h3>
              <p className="text-sm text-gray-400">{profesional.especialidad}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep3 = () => {
    const calendarDates = generateCalendarDates();
    const today = new Date();
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gold text-center mb-6">Elige fecha y hora</h2>
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-white mb-4 text-center">
            {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="grid grid-cols-7 gap-2 mb-6">
            {['D','L','M','M','J','V','S'].map((day, i) => (
              <div key={i} className="text-center text-sm font-medium text-gray-400 py-2">{day}</div>
            ))}
            {calendarDates.map((date, index) => {
              const isToday = date.toDateString() === today.toDateString();
              const isPast = date < today && !isToday;
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              return (
                <button
                  key={index}
                  onClick={() => !isPast && setSelectedDate(date)}
                  disabled={isPast}
                  className={`py-3 text-sm rounded-lg transition-all ${isPast ? 'text-gray-600 cursor-not-allowed' : isSelected ? 'bg-gold text-black font-bold' : isToday ? 'bg-gray-700 text-gold border border-gold' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
        {selectedDate && (
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">
              Horarios — {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {HORARIOS.map((hora) => {
                const isOccupied = occupiedSlots.includes(hora);
                const isSelected = selectedTime === hora;
                return (
                  <button
                    key={hora}
                    onClick={() => !isOccupied && setSelectedTime(hora)}
                    disabled={isOccupied}
                    className={`py-2 px-3 text-sm rounded transition-all ${isOccupied ? 'bg-red-900/30 text-red-400 cursor-not-allowed' : isSelected ? 'bg-gold text-black font-bold' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                  >
                    {hora}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep4 = () => {
    const priceInfo = calculatePrice(selectedService);
    const profesional = profesionales.find((p) => p.id === selectedProfesional?.id);
    if (!profesional) return <div className="text-center"><p className="text-red-400">Error: Profesional no encontrado</p></div>;
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gold text-center mb-6">Confirmá tu turno</h2>
        <div className="max-w-md mx-auto bg-gray-800 border border-gold/30 rounded-lg p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Servicio:</span>
              <span className="text-white font-medium">{selectedService.nombre}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Profesional:</span>
              <span className="text-white font-medium">{profesional.nombre}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Fecha:</span>
              <span className="text-white font-medium">
                {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Hora:</span>
              <span className="text-white font-medium">{selectedTime}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Duración:</span>
              <span className="text-white font-medium">{selectedService.duracion}</span>
            </div>
            <div className="border-t border-gray-600 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gold">Total:</span>
                <div className="text-right">
                  {priceInfo.discount && <div className="text-sm text-gray-500 line-through">{formatPrice(priceInfo.discount)}</div>}
                  <div className={`text-xl font-bold ${priceInfo.discount ? 'text-green-400' : 'text-gold'}`}>{formatPrice(priceInfo.price)}</div>
                </div>
              </div>
              {priceInfo.message && (
                <div className="mt-2 text-sm text-green-400 bg-green-900/20 rounded p-2 text-center">{priceInfo.message}</div>
              )}
            </div>
          </div>
        </div>
        <div className="text-center">
          <button
            onClick={confirmTurno}
            disabled={confirming}
            className="px-8 py-3 bg-gold text-black font-bold rounded-lg hover:bg-gold/90 disabled:bg-gray-600 disabled:cursor-not-allowed transition flex items-center gap-2 mx-auto"
          >
            {confirming ? (
              <><AiOutlineLoading3Quarters className="animate-spin w-5 h-5" />Confirmando...</>
            ) : (
              <><FiCheckCircle className="w-5 h-5" />Confirmar turno</>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return renderStep1();
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && !selectedService) { toast.error('Seleccioná un servicio'); return; }
    if (currentStep === 2 && !selectedProfesional) { toast.error('Seleccioná un profesional'); return; }
    if (currentStep === 3 && (!selectedDate || !selectedTime)) { toast.error('Seleccioná fecha y hora'); return; }
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  // Mostrar pantalla de éxito
  if (turnoConfirmado) return renderSuccess();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <AiOutlineLoading3Quarters className="text-4xl text-gold animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <nav className="bg-gray-900 border-b border-gold/30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gold">Salón de los Dioses</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">
              {userDoc?.nombreCompleto || userDoc?.nombre || user?.phoneNumber}
            </div>
            <button onClick={logout} className="px-4 py-2 bg-gold text-black font-semibold rounded hover:bg-gold/90 transition">
              Cerrar sesión
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {renderProgressBar()}
        <div className="bg-gray-900 border border-gold/30 rounded-lg p-8">
          {renderCurrentStep()}
        </div>
        {currentStep < 4 && (
          <div className="flex justify-between mt-8">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              <FiChevronLeft className="w-5 h-5" />Anterior
            </button>
            <button
              onClick={nextStep}
              className="px-6 py-3 bg-gold text-black font-semibold rounded-lg hover:bg-gold/90 transition flex items-center gap-2"
            >
              Siguiente<FiChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReservarPage;
