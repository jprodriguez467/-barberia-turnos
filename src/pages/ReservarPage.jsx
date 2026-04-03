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
import { FiChevronLeft, FiChevronRight, FiCheck, FiClock, FiUser, FiCalendar, FiCheckCircle } from 'react-icons/fi';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

// Servicios por defecto (fallback)
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

// Profesionales por defecto (fallback)
const DEFAULT_PROFESIONALES = [
  { id: 'carlos', nombre: 'Carlos M.', especialidad: 'Cortes clásicos', activo: true },
  { id: 'rodrigo', nombre: 'Rodrigo V.', especialidad: 'Estilos modernos', activo: true },
  { id: 'martin', nombre: 'Martín S.', especialidad: 'Barba y bigote', activo: true },
  { id: 'lucas', nombre: 'Lucas T.', especialidad: 'Cortes premium', activo: true },
];

const ReservarPage = () => {
  const navigate = useNavigate();
  const { user, userDoc, logout } = useAuth();
  console.log('ReservarPage render, user:', user);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedProfesional, setSelectedProfesional] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [occupiedSlots, setOccupiedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [servicios, setServicios] = useState(DEFAULT_SERVICIOS);
  const [profesionales, setProfesionales] = useState(DEFAULT_PROFESIONALES);

  // Cargar servicios y profesionales desde Firestore
  useEffect(() => {
    const loadData = async () => {
      try {
        // Cargar servicios
        const configRef = doc(db, 'configuracion', 'servicios');
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
          const data = configSnap.data();
          setServicios(data.servicios || DEFAULT_SERVICIOS);
        }

        // Cargar profesionales
        const profQuerySnapshot = await getDocs(collection(db, 'profesionales'));
        const profs = [];
        profQuerySnapshot.forEach((doc) => {
          const prof = doc.data();
          if (prof.activo) { // Solo mostrar profesionales activos
            profs.push({ id: doc.id, ...prof });
          }
        });
        if (profs.length > 0) {
          setProfesionales(profs);
        }
      } catch (error) {
        console.error('Error cargando datos:', error);
        // Mantener valores por defecto en caso de error
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Calcular precio con descuento basado en días desde último turno
  const calculatePrice = (service) => {
    if (!userDoc?.ultimoTurno) {
      return { price: service.precios.normal, discount: null, message: null };
    }

    const lastTurno = userDoc.ultimoTurno.toDate();
    const now = new Date();
    const diffTime = Math.abs(now - lastTurno);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 10) {
      return {
        price: service.precios.dias10,
        discount: service.precios.normal,
        message: `¡Volviste en ${diffDays} días, precio especial!`
      };
    } else if (diffDays < 15) {
      return {
        price: service.precios.dias15,
        discount: service.precios.normal,
        message: `¡Volviste en ${diffDays} días, precio especial!`
      };
    } else {
      return { price: service.precios.normal, discount: null, message: null };
    }
  };

  // Consultar horarios ocupados para la fecha y profesional seleccionados
  const fetchOccupiedSlots = async (date, profesionalId) => {
    if (!date || !profesionalId) return;

    try {
      const dateStr = date.toISOString().split('T')[0];
      const turnosRef = collection(db, 'turnos');
      const q = query(
        turnosRef,
        where('profesional', '==', profesionalId),
        where('fecha', '==', dateStr),
        where('estado', '==', 'confirmado')
      );

      const querySnapshot = await getDocs(q);
      const occupied = querySnapshot.docs.map(doc => doc.data().hora);
      setOccupiedSlots(occupied);
    } catch (error) {
      console.error('Error obteniendo horarios ocupados:', error);
      toast.error('Error al cargar horarios disponibles');
    }
  };

  // Efecto para cargar horarios ocupados cuando cambian fecha o profesional
  useEffect(() => {
    if (selectedDate && selectedProfesional) {
      fetchOccupiedSlots(selectedDate, selectedProfesional.id);
    }
  }, [selectedDate, selectedProfesional]);

  // Generar fechas del mes actual
  const generateCalendarDates = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const dates = [];

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }

    return dates;
  };

  // Formatear precio
  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(price);
  };

  // Confirmar turno
  const confirmTurno = async () => {
    if (!selectedService || !selectedProfesional || !selectedDate || !selectedTime) {
      toast.error('Completa todos los pasos antes de confirmar');
      return;
    }

    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const priceInfo = calculatePrice(selectedService);

      // Guardar turno en Firestore
      await addDoc(collection(db, 'turnos'), {
        usuarioId: user.uid,
        telefono: user.phoneNumber,
        servicio: selectedService.id,
        profesional: selectedProfesional.id,
        fecha: dateStr,
        hora: selectedTime,
        precioFinal: priceInfo.price,
        estado: 'confirmado',
        recordatorio24h: false,
        recordatorio1h: false,
        creadoEn: serverTimestamp()
      });

      // Actualizar último turno del usuario
      const userRef = doc(db, 'usuarios', user.uid);
      await updateDoc(userRef, {
        ultimoTurno: selectedDate
      });

      toast.success('¡Turno confirmado exitosamente!');
      navigate('/reservar'); // Recargar página para mostrar nuevo precio
    } catch (error) {
      console.error('Error confirmando turno:', error);
      toast.error('Error al confirmar el turno. Intenta de nuevo');
    } finally {
      setLoading(false);
    }
  };

  // Renderizar barra de progreso
  const renderProgressBar = () => {
    const steps = [
      { id: 1, label: 'Servicio', icon: FiCheck },
      { id: 2, label: 'Profesional', icon: FiUser },
      { id: 3, label: 'Fecha y Hora', icon: FiCalendar },
      { id: 4, label: 'Confirmar', icon: FiCheckCircle }
    ];

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className={`flex flex-col items-center ${currentStep >= step.id ? 'text-gold' : 'text-gray-600'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  currentStep >= step.id ? 'border-gold bg-gold text-black' : 'border-gray-600'
                }`}>
                  <step.icon className="w-5 h-5" />
                </div>
                <span className="text-xs mt-2 font-medium">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  currentStep > step.id ? 'bg-gold' : 'bg-gray-600'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // PASO 1: Elegir servicio
  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gold text-center mb-6">Elige tu servicio</h2>
      <div className="grid gap-4 md:grid-cols-1 max-w-md mx-auto">
        {servicios.map((servicio) => {
          const priceInfo = calculatePrice(servicio);
          return (
            <div
              key={servicio.id}
              onClick={() => setSelectedService(servicio)}
              className={`p-6 bg-gray-800 border-2 rounded-lg cursor-pointer transition-all hover:border-gold/50 ${
                selectedService?.id === servicio.id ? 'border-gold bg-gray-700' : 'border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{servicio.icono}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{servicio.nombre}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <FiClock className="w-4 h-4" />
                      {servicio.duracion}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {priceInfo.discount && (
                    <div className="text-sm text-gray-500 line-through">
                      {formatPrice(priceInfo.discount)}
                    </div>
                  )}
                  <div className={`text-lg font-bold ${priceInfo.discount ? 'text-green-400' : 'text-gold'}`}>
                    {formatPrice(priceInfo.price)}
                  </div>
                </div>
              </div>
              {priceInfo.message && (
                <div className="mt-3 text-sm text-green-400 bg-green-900/20 rounded p-2">
                  {priceInfo.message}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // PASO 2: Elegir profesional
  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gold text-center mb-6">Elige tu profesional</h2>
      <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
        {profesionales.map((profesional) => (
          <div
            key={profesional.id}
            onClick={() => setSelectedProfesional(profesional)}
            className={`p-6 bg-gray-800 border-2 rounded-lg cursor-pointer transition-all hover:border-gold/50 ${
              selectedProfesional?.id === profesional.id ? 'border-gold bg-gray-700' : 'border-gray-600'
            }`}
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                <FiUser className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">{profesional.nombre}</h3>
              <p className="text-sm text-gray-400">{profesional.especialidad}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // PASO 3: Elegir fecha y hora
  const renderStep3 = () => {
    const calendarDates = generateCalendarDates();
    const today = new Date();

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gold text-center mb-6">Elige fecha y hora</h2>

        {/* Calendario */}
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-white mb-4 text-center">
            {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="grid grid-cols-7 gap-2 mb-6">
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-400 py-2">
                {day}
              </div>
            ))}
            {calendarDates.map((date, index) => {
              const isToday = date.toDateString() === today.toDateString();
              const isPast = date < today;
              const isSelected = selectedDate?.toDateString() === date.toDateString();

              return (
                <button
                  key={index}
                  onClick={() => !isPast && setSelectedDate(date)}
                  disabled={isPast}
                  className={`py-3 text-sm rounded-lg transition-all ${
                    isPast
                      ? 'text-gray-600 cursor-not-allowed'
                      : isSelected
                      ? 'bg-gold text-black font-bold'
                      : isToday
                      ? 'bg-gray-700 text-gold border border-gold'
                      : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Horarios */}
        {selectedDate && (
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">
              Horarios disponibles - {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
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
                    className={`py-2 px-3 text-sm rounded transition-all ${
                      isOccupied
                        ? 'bg-red-900/30 text-red-400 cursor-not-allowed'
                        : isSelected
                        ? 'bg-gold text-black font-bold'
                        : 'bg-gray-800 text-white hover:bg-gray-700'
                    }`}
                  >
                    {hora}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 text-center">
              <div className="flex items-center justify-center gap-2 text-sm">
                <div className="w-3 h-3 bg-gray-800 rounded"></div>
                <span className="text-gray-400">Disponible</span>
                <div className="w-3 h-3 bg-red-900/30 rounded ml-4"></div>
                <span className="text-red-400">Ocupado</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // PASO 4: Confirmar
  const renderStep4 = () => {
    const priceInfo = calculatePrice(selectedService);
    const profesional = profesionales.find(p => p.id === selectedProfesional.id);

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gold text-center mb-6">Confirma tu turno</h2>

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
                {selectedDate.toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
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
                  {priceInfo.discount && (
                    <div className="text-sm text-gray-500 line-through">
                      {formatPrice(priceInfo.discount)}
                    </div>
                  )}
                  <div className={`text-xl font-bold ${priceInfo.discount ? 'text-green-400' : 'text-gold'}`}>
                    {formatPrice(priceInfo.price)}
                  </div>
                </div>
              </div>
              {priceInfo.message && (
                <div className="mt-2 text-sm text-green-400">
                  {priceInfo.message}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={confirmTurno}
            disabled={loading}
            className="px-8 py-3 bg-gold text-black font-bold rounded-lg hover:bg-gold/90 disabled:bg-gray-600 disabled:cursor-not-allowed transition flex items-center gap-2 mx-auto"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                Confirmando...
              </>
            ) : (
              <>
                <FiCheckCircle className="w-5 h-5" />
                Confirmar turno
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // Renderizar paso actual
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return renderStep1();
    }
  };

  // Navegación entre pasos
  const nextStep = () => {
    if (currentStep === 1 && !selectedService) {
      toast.error('Selecciona un servicio');
      return;
    }
    if (currentStep === 2 && !selectedProfesional) {
      toast.error('Selecciona un profesional');
      return;
    }
    if (currentStep === 3 && (!selectedDate || !selectedTime)) {
      toast.error('Selecciona fecha y hora');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      {loading ? (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <AiOutlineLoading3Quarters className="text-4xl text-gold animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Cargando reservas...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <nav className="bg-gray-900 border-b border-gold/30">
            <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gold">Salón de los Dioses</h1>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-400">
                  {user?.phoneNumber}
                </div>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-gold text-black font-semibold rounded hover:bg-gold/90 transition"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          </nav>

          {/* Contenido principal */}
          <div className="max-w-4xl mx-auto px-4 py-8">
            {renderProgressBar()}

            <div className="bg-gray-900 border border-gold/30 rounded-lg p-8">
              {renderCurrentStep()}
            </div>

            {/* Navegación */}
            {currentStep < 4 && (
              <div className="flex justify-between mt-8">
                <button
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                  <FiChevronLeft className="w-5 h-5" />
                  Anterior
                </button>

                <button
                  onClick={nextStep}
                  className="px-6 py-3 bg-gold text-black font-semibold rounded-lg hover:bg-gold/90 transition flex items-center gap-2"
                >
                  Siguiente
                  <FiChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ReservarPage;