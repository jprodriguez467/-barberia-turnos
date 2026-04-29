import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import toast from 'react-hot-toast';
import { FiChevronLeft, FiChevronRight, FiCheck, FiClock, FiUser, FiCalendar, FiCheckCircle } from 'react-icons/fi';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

const DEFAULT_SERVICIOS = [
  { id: 'corte', nombre: 'Corte de pelo', icono: '✂️', duracion: '30 min', precios: { normal: 18000, dias15: 15000, dias10: 12000 }, foto: null, activo: true },
  { id: 'corte_barba', nombre: 'Corte + Arreglo de barba', icono: '✂️🪒', duracion: '45 min', precios: { normal: 22000, dias15: 18000, dias10: 15000 }, foto: null, activo: true },
  { id: 'barba', nombre: 'Arreglo de barba', icono: '🪒', duracion: '20 min', precios: { normal: 8000, dias15: 6500, dias10: 5000 }, foto: null, activo: true },
];

const DEFAULT_PROFESIONALES = [
  { id: 'juan', nombre: 'Juan', especialidad: 'Barbero', foto: null, activo: true },
];

const HORARIOS = [
  '09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30',
  '15:00','15:30','16:00','16:30','17:00','17:30','18:00',
];

// ── Pantalla completar perfil ─────────────────────────────────────────────────
const CompletarPerfil = ({ onGuardar }) => {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    if (!nombre.trim()) { toast.error('Ingresá tu nombre'); return; }
    setGuardando(true);
    await onGuardar(nombre.trim(), apellido.trim());
    setGuardando(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">💈</div>
          <h1 className="text-2xl font-bold text-gold mb-2">¡Bienvenido!</h1>
          <p className="text-gray-400 text-sm">Es tu primera vez. Ingresá tu nombre para continuar.</p>
        </div>
        <div className="bg-gray-900 border border-gold/30 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gold mb-2">Nombre *</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Mateo"
              className="w-full px-4 py-3 bg-gray-800 border border-gold/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold text-base" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gold mb-2">Apellido</label>
            <input type="text" value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder="Ej: García"
              className="w-full px-4 py-3 bg-gray-800 border border-gold/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold text-base" />
          </div>
          <button onClick={handleGuardar} disabled={guardando}
            className="w-full py-3 bg-gold text-black font-bold rounded-lg hover:bg-gold/90 disabled:bg-gray-600 transition flex items-center justify-center gap-2 mt-2">
            {guardando ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>Guardando...</> : 'Continuar →'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Pantalla de éxito ─────────────────────────────────────────────────────────
const TurnoExitoso = ({ turno, nombre, onNuevoTurno }) => (
  <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 flex items-center justify-center px-4">
    <div className="w-full max-w-sm text-center">
      <div className="text-7xl mb-6">✂️</div>
      <h1 className="text-3xl font-bold text-gold mb-2">¡Turno confirmado!</h1>
      <p className="text-gray-400 mb-8">
        {nombre ? `Te esperamos, ${nombre}` : 'Te esperamos'}
      </p>

      <div className="bg-gray-900 border border-gold/30 rounded-lg p-6 text-left space-y-3 mb-8">
        <div className="flex justify-between">
          <span className="text-gray-400">Servicio:</span>
          <span className="text-white font-medium">{turno.servicio}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Fecha:</span>
          <span className="text-white font-medium capitalize">{turno.fecha}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Hora:</span>
          <span className="text-white font-medium">{turno.hora}</span>
        </div>
        <div className="border-t border-gray-700 pt-3 flex justify-between">
          <span className="text-gold font-semibold">Total:</span>
          <span className="text-gold font-bold text-lg">
            {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(turno.precio)}
          </span>
        </div>
      </div>

      <button onClick={onNuevoTurno}
        className="w-full py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-sm">
        Reservar otro turno
      </button>
    </div>
  </div>
);

// ── Componente principal ──────────────────────────────────────────────────────
const ReservarPage = () => {
  const { user, userDoc, needsProfile, completarPerfil, logout } = useAuth();

  const [currentStep, setCurrentStep]         = useState(1);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedProfesional, setSelectedProfesional] = useState(null);
  const [selectedDate, setSelectedDate]       = useState(null);
  const [selectedTime, setSelectedTime]       = useState(null);
  const [occupiedSlots, setOccupiedSlots]     = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [servicios, setServicios]             = useState(DEFAULT_SERVICIOS);
  const [profesionales, setProfesionales]     = useState(DEFAULT_PROFESIONALES);
  const [turnoConfirmado, setTurnoConfirmado] = useState(null);

  if (needsProfile) return <CompletarPerfil onGuardar={completarPerfil} />;

  if (turnoConfirmado) return (
    <TurnoExitoso
      turno={turnoConfirmado}
      nombre={userDoc?.nombre}
      onNuevoTurno={() => {
        setTurnoConfirmado(null);
        setCurrentStep(1);
        setSelectedService(null);
        setSelectedProfesional(null);
        setSelectedDate(null);
        setSelectedTime(null);
      }}
    />
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const configRef = doc(db, 'configuracion', 'servicios');
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) setServicios(configSnap.data().servicios || DEFAULT_SERVICIOS);

        const profSnap = await getDocs(collection(db, 'profesionales'));
        const profs = [];
        profSnap.forEach((d) => { if (d.data().activo) profs.push({ id: d.id, ...d.data() }); });
        if (profs.length > 0) setProfesionales(profs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDate && selectedProfesional) {
      const fetch = async () => {
        try {
          const dateStr = selectedDate.toISOString().split('T')[0];
          const q = query(collection(db, 'turnos'), where('profesional','==',selectedProfesional.id), where('fecha','==',dateStr), where('estado','==','confirmado'));
          const snap = await getDocs(q);
          setOccupiedSlots(snap.docs.map((d) => d.data().hora));
        } catch(e) { toast.error('Error al cargar horarios'); }
      };
      fetch();
    }
  }, [selectedDate, selectedProfesional]);

  const calculatePrice = (service) => {
    const raw = userDoc?.ultimoCorte || userDoc?.ultimoTurno;
    if (!raw) return { price: service.precios.normal, discount: null, message: null };
    const fecha = raw.toDate ? raw.toDate() : new Date(raw);
    const dias  = Math.floor((Date.now() - fecha.getTime()) / (1000*60*60*24));
    if (dias < 10) return { price: service.precios.dias10, discount: service.precios.normal, message: `¡Volviste en ${dias} días! Precio especial activo` };
    if (dias < 15) return { price: service.precios.dias15, discount: service.precios.normal, message: `¡Volviste en ${dias} días! Precio especial activo` };
    return { price: service.precios.normal, discount: null, message: null };
  };

  const formatPrice = (p) => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0}).format(p);

  const confirmTurno = async () => {
    if (!selectedService || !selectedProfesional || !selectedDate || !selectedTime) { toast.error('Completa todos los pasos'); return; }
    setLoading(true);
    try {
      const dateStr   = selectedDate.toISOString().split('T')[0];
      const priceInfo = calculatePrice(selectedService);

      await addDoc(collection(db, 'turnos'), {
        usuarioId: user.uid, telefono: user.phoneNumber,
        nombre: userDoc?.nombre || '', apellido: userDoc?.apellido || '',
        servicio: selectedService.id, profesional: selectedProfesional.id,
        fecha: dateStr, hora: selectedTime, precioFinal: priceInfo.price,
        estado: 'confirmado', recordatorio24h: false, recordatorio1h: false,
        creadoEn: serverTimestamp(),
      });

      await updateDoc(doc(db, 'usuarios', user.uid), { ultimoCorte: serverTimestamp() });

      setTurnoConfirmado({
        servicio: selectedService.nombre,
        fecha: selectedDate.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' }),
        hora: selectedTime,
        precio: priceInfo.price,
      });
    } catch (e) {
      console.error(e);
      toast.error('Error al confirmar el turno. Intenta de nuevo');
    } finally {
      setLoading(false);
    }
  };

  const generateCalendarDates = () => {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last  = new Date(today.getFullYear(), today.getMonth()+1, 0);
    const dates = [];
    for (let d = new Date(first); d <= last; d.setDate(d.getDate()+1)) dates.push(new Date(d));
    return dates;
  };

  const renderProgressBar = () => {
    const steps = [
      {id:1,label:'Servicio',icon:FiCheck},{id:2,label:'Profesional',icon:FiUser},
      {id:3,label:'Fecha y Hora',icon:FiCalendar},{id:4,label:'Confirmar',icon:FiCheckCircle},
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
              {index < steps.length-1 && <div className={`flex-1 h-0.5 mx-4 ${currentStep > step.id ? 'bg-gold' : 'bg-gray-600'}`} />}
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
        const restantes = 15 - Math.floor((Date.now()-fecha.getTime())/(1000*60*60*24));
        if (restantes > 0) return (
          <div className="max-w-md mx-auto bg-green-900/20 border border-green-500/30 rounded-lg p-3 text-center">
            <p className="text-green-400 text-sm font-medium">¡Tenés descuento activo! Te quedan {restantes} días para precio especial</p>
          </div>
        );
        return null;
      })()}
      <div className="grid gap-4 max-w-md mx-auto">
        {servicios.map((s) => {
          const p = calculatePrice(s);
          return (
            <div key={s.id} onClick={() => setSelectedService(s)}
              className={`p-6 bg-gray-800 border-2 rounded-lg cursor-pointer transition-all hover:border-gold/50 ${selectedService?.id===s.id?'border-gold bg-gray-700':'border-gray-600'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{s.icono}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{s.nombre}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400"><FiClock className="w-4 h-4" />{s.duracion}</div>
                  </div>
                </div>
                <div className="text-right">
                  {p.discount && <div className="text-sm text-gray-500 line-through">{formatPrice(p.discount)}</div>}
                  <div className={`text-lg font-bold ${p.discount?'text-green-400':'text-gold'}`}>{formatPrice(p.price)}</div>
                </div>
              </div>
              {p.message && <div className="mt-3 text-sm text-green-400 bg-green-900/20 rounded p-2">{p.message}</div>}
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
        {profesionales.map((p) => (
          <div key={p.id} onClick={() => setSelectedProfesional(p)}
            className={`p-6 bg-gray-800 border-2 rounded-lg cursor-pointer transition-all hover:border-gold/50 ${selectedProfesional?.id===p.id?'border-gold bg-gray-700':'border-gray-600'}`}>
            <div className="text-center">
              {p.foto ? <img src={p.foto} alt={p.nombre} className="w-16 h-16 rounded-full mx-auto mb-4 object-cover" />
                : <div className="w-16 h-16 bg-gray-600 rounded-full mx-auto mb-4 flex items-center justify-center"><FiUser className="w-8 h-8 text-gray-400" /></div>}
              <h3 className="text-lg font-semibold text-white">{p.nombre}</h3>
              <p className="text-sm text-gray-400">{p.especialidad}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep3 = () => {
    const dates = generateCalendarDates();
    const today = new Date();
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gold text-center mb-6">Elige fecha y hora</h2>
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-white mb-4 text-center">{new Date().toLocaleDateString('es-ES',{month:'long',year:'numeric'})}</h3>
          <div className="grid grid-cols-7 gap-2 mb-6">
            {['D','L','M','M','J','V','S'].map((d,i)=><div key={i} className="text-center text-sm font-medium text-gray-400 py-2">{d}</div>)}
            {dates.map((date,i)=>{
              const isToday=date.toDateString()===today.toDateString();
              const isPast=date<today&&!isToday;
              const isSel=selectedDate?.toDateString()===date.toDateString();
              return (
                <button key={i} onClick={()=>!isPast&&setSelectedDate(date)} disabled={isPast}
                  className={`py-3 text-sm rounded-lg transition-all ${isPast?'text-gray-600 cursor-not-allowed':isSel?'bg-gold text-black font-bold':isToday?'bg-gray-700 text-gold border border-gold':'bg-gray-800 text-white hover:bg-gray-700'}`}>
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
        {selectedDate && (
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">
              Horarios — {selectedDate.toLocaleDateString('es-ES',{weekday:'long',day:'numeric'})}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {HORARIOS.map((hora)=>{
                const isOcc=occupiedSlots.includes(hora);
                const isSel=selectedTime===hora;
                return <button key={hora} onClick={()=>!isOcc&&setSelectedTime(hora)} disabled={isOcc}
                  className={`py-2 px-3 text-sm rounded transition-all ${isOcc?'bg-red-900/30 text-red-400 cursor-not-allowed':isSel?'bg-gold text-black font-bold':'bg-gray-800 text-white hover:bg-gray-700'}`}>{hora}</button>;
              })}
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-gray-800 rounded"></div><span className="text-gray-400">Disponible</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-900/30 rounded"></div><span className="text-red-400">Ocupado</span></div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep4 = () => {
    const p = calculatePrice(selectedService);
    const prof = profesionales.find((x)=>x.id===selectedProfesional?.id);
    if (!prof) return <div className="text-center"><p className="text-red-400">Error: Profesional no encontrado</p></div>;
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gold text-center mb-6">Confirmá tu turno</h2>
        <div className="max-w-md mx-auto bg-gray-800 border border-gold/30 rounded-lg p-6 space-y-4">
          <div className="flex justify-between"><span className="text-gray-400">Servicio:</span><span className="text-white font-medium">{selectedService.nombre}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Profesional:</span><span className="text-white font-medium">{prof.nombre}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Fecha:</span><span className="text-white font-medium capitalize">{selectedDate.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Hora:</span><span className="text-white font-medium">{selectedTime}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Duración:</span><span className="text-white font-medium">{selectedService.duracion}</span></div>
          <div className="border-t border-gray-600 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gold">Total:</span>
              <div className="text-right">
                {p.discount && <div className="text-sm text-gray-500 line-through">{formatPrice(p.discount)}</div>}
                <div className={`text-xl font-bold ${p.discount?'text-green-400':'text-gold'}`}>{formatPrice(p.price)}</div>
              </div>
            </div>
            {p.message && <div className="mt-2 text-sm text-green-400 bg-green-900/20 rounded p-2 text-center">{p.message}</div>}
          </div>
        </div>
        <div className="text-center">
          <button onClick={confirmTurno} disabled={loading}
            className="px-8 py-3 bg-gold text-black font-bold rounded-lg hover:bg-gold/90 disabled:bg-gray-600 disabled:cursor-not-allowed transition flex items-center gap-2 mx-auto">
            {loading?<><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>Confirmando...</>:<><FiCheckCircle className="w-5 h-5"/>Confirmar turno</>}
          </button>
        </div>
      </div>
    );
  };

  const nextStep = () => {
    if (currentStep===1&&!selectedService){toast.error('Seleccioná un servicio');return;}
    if (currentStep===2&&!selectedProfesional){toast.error('Seleccioná un profesional');return;}
    if (currentStep===3&&(!selectedDate||!selectedTime)){toast.error('Seleccioná fecha y hora');return;}
    setCurrentStep((p)=>Math.min(p+1,4));
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center"><AiOutlineLoading3Quarters className="text-4xl text-gold animate-spin mx-auto mb-4"/><p className="text-gray-400">Cargando...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <nav className="bg-gray-900 border-b border-gold/30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gold">Salón de los Dioses</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">{userDoc?.nombre ? `Hola, ${userDoc.nombre}` : user?.phoneNumber}</div>
            <button onClick={logout} className="px-4 py-2 bg-gold text-black font-semibold rounded hover:bg-gold/90 transition">Cerrar sesión</button>
          </div>
        </div>
      </nav>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {renderProgressBar()}
        <div className="bg-gray-900 border border-gold/30 rounded-lg p-8">
          {currentStep===1&&renderStep1()}
          {currentStep===2&&renderStep2()}
          {currentStep===3&&renderStep3()}
          {currentStep===4&&renderStep4()}
        </div>
        {currentStep<4&&(
          <div className="flex justify-between mt-8">
            <button onClick={()=>setCurrentStep((p)=>Math.max(p-1,1))} disabled={currentStep===1}
              className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition flex items-center gap-2">
              <FiChevronLeft className="w-5 h-5"/>Anterior
            </button>
            <button onClick={nextStep} className="px-6 py-3 bg-gold text-black font-semibold rounded-lg hover:bg-gold/90 transition flex items-center gap-2">
              Siguiente<FiChevronRight className="w-5 h-5"/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReservarPage;
