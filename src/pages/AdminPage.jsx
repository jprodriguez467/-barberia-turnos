import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  setDoc,
  getDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db } from '../services/firebase';
import { storage } from '../services/firebase';
import toast from 'react-hot-toast';
import {
  FiCalendar,
  FiUsers,
  FiDollarSign,
  FiEdit,
  FiPlus,
  FiTrash2,
  FiCheck,
  FiX,
  FiClock,
  FiPlay,
  FiPause,
  FiUpload,
  FiEye,
  FiEyeOff,
  FiScissors,
} from 'react-icons/fi';

// Estados de turnos
const TURNOS_ESTADOS = {
  confirmado: { label: 'Confirmado', color: 'bg-blue-500', next: 'en_curso' },
  en_curso: { label: 'En Curso', color: 'bg-yellow-500', next: 'completado' },
  completado: { label: 'Completado', color: 'bg-green-500', next: null },
  cancelado: { label: 'Cancelado', color: 'bg-red-500', next: null },
};

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

// ─── helpers de descuento ────────────────────────────────────────────────────
const diasDesdeUltimoCorte = (ultimoCorte) => {
  if (!ultimoCorte) return null;
  const fecha = ultimoCorte.toDate ? ultimoCorte.toDate() : new Date(ultimoCorte);
  const diff = Date.now() - fecha.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const estadoDescuento = (dias) => {
  if (dias === null) return { label: 'Sin historial', cls: 'bg-gray-700 text-gray-300', diasRestantes: null };
  if (dias > 15)     return { label: 'Sin descuento', cls: 'bg-red-900/40 text-red-400', diasRestantes: 0 };
  const restantes = 15 - dias;
  if (restantes <= 3) return { label: `Vence en ${restantes}d`, cls: 'bg-yellow-900/40 text-yellow-400', diasRestantes: restantes };
  return { label: `${restantes} días restantes`, cls: 'bg-green-900/40 text-green-400', diasRestantes: restantes };
};
// ─────────────────────────────────────────────────────────────────────────────

const AdminPage = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('turnos');
  const [turnosHoy, setTurnosHoy] = useState([]);
  const [servicios, setServicios] = useState(DEFAULT_SERVICIOS);
  const [profesionales, setProfesionales] = useState([]);
  const [promociones, setPromociones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busquedaCliente, setBusquedaCliente] = useState('');

  // Estados para modales
  const [showServicioModal, setShowServicioModal] = useState(false);
  const [editingServicio, setEditingServicio] = useState(null);
  const [showProfesionalModal, setShowProfesionalModal] = useState(false);
  const [editingProfesional, setEditingProfesional] = useState(null);
  const [showPromocionModal, setShowPromocionModal] = useState(false);
  const [editingPromocion, setEditingPromocion] = useState(null);

  // Form states
  const [servicioForm, setServicioForm] = useState({
    nombre: '',
    duracion: '',
    precios: { normal: 0, dias15: 0, dias10: 0 },
    foto: null,
    fotoFile: null,
  });

  const [profesionalForm, setProfesionalForm] = useState({
    nombre: '',
    especialidad: '',
    foto: null,
    fotoFile: null,
    activo: true,
  });

  const [promocionForm, setPromocionForm] = useState({
    titulo: '',
    descripcion: '',
    precioEspecial: 0,
    fechaInicio: '',
    fechaFin: '',
    activo: true,
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTurnosHoy(),
        loadServicios(),
        loadProfesionales(),
        loadPromociones(),
        loadClientes(),
      ]);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // Cargar turnos de hoy
  const loadTurnosHoy = async () => {
    const today = new Date().toISOString().split('T')[0];
    const turnosRef = collection(db, 'turnos');
    const q = query(turnosRef, where('fecha', '==', today));
    const querySnapshot = await getDocs(q);

    const turnos = [];
    querySnapshot.forEach((doc) => {
      turnos.push({ id: doc.id, ...doc.data() });
    });
    turnos.sort((a, b) => a.hora.localeCompare(b.hora));
    setTurnosHoy(turnos);
  };

  // Cargar servicios desde Firestore
  const loadServicios = async () => {
    try {
      const configRef = doc(db, 'configuracion', 'servicios');
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const data = configSnap.data();
        setServicios(data.servicios || DEFAULT_SERVICIOS);
      } else {
        await setDoc(configRef, { servicios: DEFAULT_SERVICIOS });
        setServicios(DEFAULT_SERVICIOS);
      }
    } catch (error) {
      console.error('Error cargando servicios:', error);
      setServicios(DEFAULT_SERVICIOS);
    }
  };

  // Cargar profesionales
  const loadProfesionales = async () => {
    const querySnapshot = await getDocs(collection(db, 'profesionales'));
    const profs = [];
    querySnapshot.forEach((doc) => {
      profs.push({ id: doc.id, ...doc.data() });
    });
    setProfesionales(profs);
  };

  // Cargar promociones
  const loadPromociones = async () => {
    const querySnapshot = await getDocs(collection(db, 'promociones'));
    const promos = [];
    querySnapshot.forEach((doc) => {
      promos.push({ id: doc.id, ...doc.data() });
    });
    setPromociones(promos);
  };

  // ── NUEVO: Cargar clientes con su historial de cortes ─────────────────────
  const loadClientes = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'usuarios'));
      const lista = [];
      querySnapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() });
      });
      // Ordenar: primero los que tienen descuento activo a punto de vencer
      lista.sort((a, b) => {
        const dA = diasDesdeUltimoCorte(a.ultimoCorte) ?? 999;
        const dB = diasDesdeUltimoCorte(b.ultimoCorte) ?? 999;
        return dA - dB;
      });
      setClientes(lista);
    } catch (error) {
      console.error('Error cargando clientes:', error);
    }
  };

  // ── NUEVO: Registrar corte manualmente desde el panel de admin ────────────
  const registrarCorteManual = async (clienteId) => {
    try {
      await updateDoc(doc(db, 'usuarios', clienteId), {
        ultimoCorte: serverTimestamp(),
      });
      toast.success('Corte registrado');
      await loadClientes();
    } catch (error) {
      console.error('Error registrando corte:', error);
      toast.error('Error al registrar el corte');
    }
  };

  // Cambiar estado de turno
  // ── MODIFICADO: cuando se completa, guarda ultimoCorte en el usuario ───────
  const cambiarEstadoTurno = async (turnoId, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'turnos', turnoId), {
        estado: nuevoEstado,
        actualizadoEn: serverTimestamp(),
      });

      // Si el turno se completa → actualizar ultimoCorte del cliente
      if (nuevoEstado === 'completado') {
        const turno = turnosHoy.find((t) => t.id === turnoId);
        if (turno?.usuarioId) {
          await updateDoc(doc(db, 'usuarios', turno.usuarioId), {
            ultimoCorte: serverTimestamp(),
          });
        }
      }

      await loadTurnosHoy();
      await loadClientes();
      toast.success(`Turno ${TURNOS_ESTADOS[nuevoEstado].label.toLowerCase()}`);
    } catch (error) {
      console.error('Error cambiando estado:', error);
      toast.error('Error al cambiar estado del turno');
    }
  };

  // Calcular estadísticas del día
  const calcularEstadisticas = () => {
    const turnosCompletados = turnosHoy.filter((t) => t.estado === 'completado');
    const ingresos = turnosCompletados.reduce((sum, turno) => sum + turno.precioFinal, 0);
    return { totalTurnos: turnosHoy.length, ingresos };
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);

  const uploadImage = async (file, path) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  // ── SECCIÓN 1: TURNOS DEL DÍA ─────────────────────────────────────────────
  const renderTurnosDelDia = () => {
    const stats = calcularEstadisticas();

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gold">Turnos del Día</h2>
          <div className="flex gap-4">
            <div className="bg-gray-800 px-4 py-2 rounded-lg">
              <div className="text-sm text-gray-400">Turnos Hoy</div>
              <div className="text-xl font-bold text-gold">{stats.totalTurnos}</div>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-lg">
              <div className="text-sm text-gray-400">Ingresos</div>
              <div className="text-xl font-bold text-green-400">{formatPrice(stats.ingresos)}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {turnosHoy.length === 0 ? (
            <div className="bg-gray-800 border border-gold/30 rounded-lg p-8 text-center">
              <FiCalendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No hay turnos programados para hoy</p>
            </div>
          ) : (
            turnosHoy.map((turno) => (
              <div key={turno.id} className="bg-gray-800 border border-gold/30 rounded-lg p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="text-2xl font-bold text-gold">{turno.hora}</div>
                      <div>
                        <div className="font-semibold text-white">{turno.telefono}</div>
                        <div className="text-sm text-gray-400">
                          {turno.servicio} - {turno.profesional}
                        </div>
                      </div>
                    </div>
                    <div className="text-lg font-bold text-green-400">
                      {formatPrice(turno.precioFinal)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${TURNOS_ESTADOS[turno.estado].color} text-white`}
                    >
                      {TURNOS_ESTADOS[turno.estado].label}
                    </span>
                    {TURNOS_ESTADOS[turno.estado].next && (
                      <button
                        onClick={() =>
                          cambiarEstadoTurno(turno.id, TURNOS_ESTADOS[turno.estado].next)
                        }
                        className="px-3 py-1 bg-gold text-black rounded hover:bg-gold/90 transition text-sm font-medium"
                      >
                        {TURNOS_ESTADOS[turno.estado].next === 'en_curso' && 'Iniciar'}
                        {TURNOS_ESTADOS[turno.estado].next === 'completado' && 'Completar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // ── SECCIÓN NUEVA: CLIENTES Y DESCUENTOS ──────────────────────────────────
  const renderClientes = () => {
    const filtrados = clientes.filter((c) => {
      const tel = c.telefono || c.phoneNumber || '';
      const nombre = c.nombre || tel;
      return nombre.toLowerCase().includes(busquedaCliente.toLowerCase());
    });

    const conDescuento = clientes.filter((c) => {
      const d = diasDesdeUltimoCorte(c.ultimoCorte);
      return d !== null && d <= 15;
    }).length;

    const vencenProximo = clientes.filter((c) => {
      const d = diasDesdeUltimoCorte(c.ultimoCorte);
      return d !== null && d >= 12 && d <= 15;
    }).length;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gold">Clientes</h2>
          <div className="flex gap-3">
            <div className="bg-gray-800 px-4 py-2 rounded-lg text-center">
              <div className="text-xs text-gray-400">Total</div>
              <div className="text-xl font-bold text-gold">{clientes.length}</div>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-lg text-center">
              <div className="text-xs text-gray-400">Con descuento</div>
              <div className="text-xl font-bold text-green-400">{conDescuento}</div>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-lg text-center">
              <div className="text-xs text-gray-400">Vencen pronto</div>
              <div className="text-xl font-bold text-yellow-400">{vencenProximo}</div>
            </div>
          </div>
        </div>

        {/* Buscador */}
        <input
          type="text"
          placeholder="Buscar por teléfono o nombre..."
          value={busquedaCliente}
          onChange={(e) => setBusquedaCliente(e.target.value)}
          className="w-full px-4 py-2 bg-gray-800 border border-gold/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold"
        />

        {/* Lista de clientes */}
        <div className="space-y-3">
          {filtrados.length === 0 ? (
            <div className="bg-gray-800 border border-gold/30 rounded-lg p-8 text-center">
              <FiUsers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No hay clientes registrados</p>
            </div>
          ) : (
            filtrados.map((cliente) => {
              const dias = diasDesdeUltimoCorte(cliente.ultimoCorte);
              const estado = estadoDescuento(dias);
              const telefono = cliente.telefono || cliente.phoneNumber || cliente.id;
              const nombre = cliente.nombre || telefono;

              // Precio que aplicaría en su próximo turno
              const precioBase = DEFAULT_SERVICIOS[0].precios.normal;
              const precioDesc =
                dias !== null && dias <= 10
                  ? DEFAULT_SERVICIOS[0].precios.dias10
                  : dias !== null && dias <= 15
                  ? DEFAULT_SERVICIOS[0].precios.dias15
                  : precioBase;
              const tieneDesc = dias !== null && dias <= 15;

              const ultimoFmt = cliente.ultimoCorte
                ? (cliente.ultimoCorte.toDate
                    ? cliente.ultimoCorte.toDate()
                    : new Date(cliente.ultimoCorte)
                  ).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                : '—';

              return (
                <div
                  key={cliente.id}
                  className="bg-gray-800 border border-gold/30 rounded-lg p-4 flex items-center gap-4"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gold flex-shrink-0">
                    {nombre.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">{nombre}</div>
                    <div className="text-xs text-gray-400">
                      Último corte: {ultimoFmt}
                      {dias !== null && ` · hace ${dias} días`}
                    </div>
                  </div>

                  {/* Estado descuento */}
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${estado.cls} flex-shrink-0`}>
                    {estado.label}
                  </span>

                  {/* Precio próximo turno */}
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    {tieneDesc && (
                      <div className="text-xs text-gray-500 line-through">
                        {formatPrice(precioBase)}
                      </div>
                    )}
                    <div className={`text-sm font-bold ${tieneDesc ? 'text-green-400' : 'text-gold'}`}>
                      {formatPrice(precioDesc)}
                    </div>
                  </div>

                  {/* Botón registrar corte */}
                  <button
                    onClick={() => registrarCorteManual(cliente.id)}
                    className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gold hover:text-black text-white text-xs font-medium rounded transition-all"
                  >
                    <FiScissors className="w-3 h-3" />
                    Registrar
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // ── SECCIÓN 2: GESTIÓN DE SERVICIOS ───────────────────────────────────────
  const renderGestionServicios = () => {
    const openServicioModal = (servicio = null) => {
      if (servicio) {
        setEditingServicio(servicio);
        setServicioForm({
          nombre: servicio.nombre,
          duracion: servicio.duracion,
          precios: { ...servicio.precios },
          foto: servicio.foto,
          fotoFile: null,
        });
      } else {
        setEditingServicio(null);
        setServicioForm({
          nombre: '',
          duracion: '',
          precios: { normal: 0, dias15: 0, dias10: 0 },
          foto: null,
          fotoFile: null,
        });
      }
      setShowServicioModal(true);
    };

    const saveServicio = async () => {
      try {
        let fotoUrl = servicioForm.foto;
        if (servicioForm.fotoFile) {
          const path = `servicios/${Date.now()}_${servicioForm.fotoFile.name}`;
          fotoUrl = await uploadImage(servicioForm.fotoFile, path);
        }

        const servicioData = { ...servicioForm, foto: fotoUrl, activo: true };
        let updatedServicios;
        if (editingServicio) {
          updatedServicios = servicios.map((s) =>
            s.id === editingServicio.id ? { ...servicioData, id: s.id } : s
          );
        } else {
          const newId = `servicio_${Date.now()}`;
          updatedServicios = [...servicios, { ...servicioData, id: newId }];
        }

        await setDoc(doc(db, 'configuracion', 'servicios'), {
          servicios: updatedServicios,
          actualizadoEn: serverTimestamp(),
        });

        setServicios(updatedServicios);
        setShowServicioModal(false);
        toast.success('Servicio guardado correctamente');
      } catch (error) {
        console.error('Error guardando servicio:', error);
        toast.error('Error al guardar el servicio');
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gold">Gestión de Servicios</h2>
          <button
            onClick={() => openServicioModal()}
            className="px-4 py-2 bg-gold text-black font-semibold rounded hover:bg-gold/90 transition flex items-center gap-2"
          >
            <FiPlus className="w-4 h-4" />
            Nuevo Servicio
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {servicios.map((servicio) => (
            <div key={servicio.id} className="bg-gray-800 border border-gold/30 rounded-lg p-6">
              {servicio.foto && (
                <img
                  src={servicio.foto}
                  alt={servicio.nombre}
                  className="w-full h-32 object-cover rounded mb-4"
                />
              )}
              <h3 className="text-lg font-semibold text-white mb-2">{servicio.nombre}</h3>
              <div className="text-sm text-gray-400 mb-2">{servicio.duracion}</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Normal:</span>
                  <span className="text-white">{formatPrice(servicio.precios.normal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Hasta 15 días:</span>
                  <span className="text-green-400">{formatPrice(servicio.precios.dias15)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Hasta 10 días:</span>
                  <span className="text-green-400">{formatPrice(servicio.precios.dias10)}</span>
                </div>
              </div>
              <button
                onClick={() => openServicioModal(servicio)}
                className="mt-4 w-full px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition flex items-center justify-center gap-2"
              >
                <FiEdit className="w-4 h-4" />
                Editar
              </button>
            </div>
          ))}
        </div>

        {showServicioModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 border border-gold/30 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-gold mb-4">
                {editingServicio ? 'Editar Servicio' : 'Nuevo Servicio'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Nombre</label>
                  <input
                    type="text"
                    value={servicioForm.nombre}
                    onChange={(e) => setServicioForm({ ...servicioForm, nombre: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Duración</label>
                  <input
                    type="text"
                    value={servicioForm.duracion}
                    onChange={(e) => setServicioForm({ ...servicioForm, duracion: e.target.value })}
                    placeholder="ej: 30 min"
                    className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gold mb-1">Precio Normal</label>
                    <input
                      type="number"
                      value={servicioForm.precios.normal}
                      onChange={(e) =>
                        setServicioForm({
                          ...servicioForm,
                          precios: { ...servicioForm.precios, normal: parseInt(e.target.value) || 0 },
                        })
                      }
                      className="w-full px-2 py-1 bg-gray-800 border border-gold/30 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gold mb-1">-15 días</label>
                    <input
                      type="number"
                      value={servicioForm.precios.dias15}
                      onChange={(e) =>
                        setServicioForm({
                          ...servicioForm,
                          precios: { ...servicioForm.precios, dias15: parseInt(e.target.value) || 0 },
                        })
                      }
                      className="w-full px-2 py-1 bg-gray-800 border border-gold/30 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gold mb-1">-10 días</label>
                    <input
                      type="number"
                      value={servicioForm.precios.dias10}
                      onChange={(e) =>
                        setServicioForm({
                          ...servicioForm,
                          precios: { ...servicioForm.precios, dias10: parseInt(e.target.value) || 0 },
                        })
                      }
                      className="w-full px-2 py-1 bg-gray-800 border border-gold/30 rounded text-white text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Foto</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setServicioForm({ ...servicioForm, fotoFile: e.target.files[0] })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gold file:text-black hover:file:bg-gold/90"
                  />
                </div>
                {servicioForm.foto && (
                  <img src={servicioForm.foto} alt="Preview" className="w-full h-32 object-cover rounded" />
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowServicioModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveServicio}
                  className="flex-1 px-4 py-2 bg-gold text-black font-semibold rounded hover:bg-gold/90 transition"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── SECCIÓN 3: PROMOCIONES ────────────────────────────────────────────────
  const renderPromociones = () => {
    const openPromocionModal = (promocion = null) => {
      if (promocion) {
        setEditingPromocion(promocion);
        setPromocionForm({
          titulo: promocion.titulo,
          descripcion: promocion.descripcion,
          precioEspecial: promocion.precioEspecial,
          fechaInicio: promocion.fechaInicio,
          fechaFin: promocion.fechaFin,
          activo: promocion.activo,
        });
      } else {
        setEditingPromocion(null);
        setPromocionForm({ titulo: '', descripcion: '', precioEspecial: 0, fechaInicio: '', fechaFin: '', activo: true });
      }
      setShowPromocionModal(true);
    };

    const savePromocion = async () => {
      try {
        const promocionData = { ...promocionForm, creadoEn: serverTimestamp() };
        if (editingPromocion) {
          await updateDoc(doc(db, 'promociones', editingPromocion.id), promocionData);
        } else {
          await addDoc(collection(db, 'promociones'), promocionData);
        }
        await loadPromociones();
        setShowPromocionModal(false);
        toast.success('Promoción guardada correctamente');
      } catch (error) {
        console.error('Error guardando promoción:', error);
        toast.error('Error al guardar la promoción');
      }
    };

    const togglePromocion = async (promocion) => {
      try {
        await updateDoc(doc(db, 'promociones', promocion.id), { activo: !promocion.activo });
        await loadPromociones();
        toast.success(`Promoción ${!promocion.activo ? 'activada' : 'desactivada'}`);
      } catch (error) {
        toast.error('Error al cambiar estado de la promoción');
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gold">Promociones</h2>
          <button
            onClick={() => openPromocionModal()}
            className="px-4 py-2 bg-gold text-black font-semibold rounded hover:bg-gold/90 transition flex items-center gap-2"
          >
            <FiPlus className="w-4 h-4" />
            Nueva Promoción
          </button>
        </div>

        <div className="grid gap-4">
          {promociones.length === 0 ? (
            <div className="bg-gray-800 border border-gold/30 rounded-lg p-8 text-center">
              <FiDollarSign className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No hay promociones creadas</p>
            </div>
          ) : (
            promociones.map((promo) => (
              <div key={promo.id} className="bg-gray-800 border border-gold/30 rounded-lg p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{promo.titulo}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${promo.activo ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'}`}>
                        {promo.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <p className="text-gray-400 mb-2">{promo.descripcion}</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-400 font-bold">{formatPrice(promo.precioEspecial)}</span>
                      <span className="text-gray-400">
                        {new Date(promo.fechaInicio).toLocaleDateString()} -{' '}
                        {new Date(promo.fechaFin).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => togglePromocion(promo)}
                      className={`p-2 rounded ${promo.activo ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'} hover:opacity-80 transition`}
                    >
                      {promo.activo ? <FiPause className="w-4 h-4" /> : <FiPlay className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openPromocionModal(promo)}
                      className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition"
                    >
                      <FiEdit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {showPromocionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 border border-gold/30 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-gold mb-4">
                {editingPromocion ? 'Editar Promoción' : 'Nueva Promoción'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Título</label>
                  <input type="text" value={promocionForm.titulo} onChange={(e) => setPromocionForm({ ...promocionForm, titulo: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Descripción</label>
                  <textarea value={promocionForm.descripcion} onChange={(e) => setPromocionForm({ ...promocionForm, descripcion: e.target.value })} rows="3" className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Precio Especial</label>
                  <input type="number" value={promocionForm.precioEspecial} onChange={(e) => setPromocionForm({ ...promocionForm, precioEspecial: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gold mb-2">Fecha Inicio</label>
                    <input type="date" value={promocionForm.fechaInicio} onChange={(e) => setPromocionForm({ ...promocionForm, fechaInicio: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gold mb-2">Fecha Fin</label>
                    <input type="date" value={promocionForm.fechaFin} onChange={(e) => setPromocionForm({ ...promocionForm, fechaFin: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="activo" checked={promocionForm.activo} onChange={(e) => setPromocionForm({ ...promocionForm, activo: e.target.checked })} className="w-4 h-4 text-gold bg-gray-800 border-gold/30 rounded" />
                  <label htmlFor="activo" className="text-sm text-gray-300">Activa</label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowPromocionModal(false)} className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition">Cancelar</button>
                <button onClick={savePromocion} className="flex-1 px-4 py-2 bg-gold text-black font-semibold rounded hover:bg-gold/90 transition">Guardar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── SECCIÓN 4: PROFESIONALES ──────────────────────────────────────────────
  const renderProfesionales = () => {
    const openProfesionalModal = (profesional = null) => {
      if (profesional) {
        setEditingProfesional(profesional);
        setProfesionalForm({ nombre: profesional.nombre, especialidad: profesional.especialidad, foto: profesional.foto, fotoFile: null, activo: profesional.activo });
      } else {
        setEditingProfesional(null);
        setProfesionalForm({ nombre: '', especialidad: '', foto: null, fotoFile: null, activo: true });
      }
      setShowProfesionalModal(true);
    };

    const saveProfesional = async () => {
      try {
        let fotoUrl = profesionalForm.foto;
        if (profesionalForm.fotoFile) {
          const path = `profesionales/${Date.now()}_${profesionalForm.fotoFile.name}`;
          fotoUrl = await uploadImage(profesionalForm.fotoFile, path);
        }
        const profesionalData = { ...profesionalForm, foto: fotoUrl, actualizadoEn: serverTimestamp() };
        if (editingProfesional) {
          await updateDoc(doc(db, 'profesionales', editingProfesional.id), profesionalData);
        } else {
          await addDoc(collection(db, 'profesionales'), profesionalData);
        }
        await loadProfesionales();
        setShowProfesionalModal(false);
        toast.success('Profesional guardado correctamente');
      } catch (error) {
        toast.error('Error al guardar el profesional');
      }
    };

    const toggleProfesional = async (profesional) => {
      try {
        await updateDoc(doc(db, 'profesionales', profesional.id), { activo: !profesional.activo });
        await loadProfesionales();
        toast.success(`Profesional ${!profesional.activo ? 'activado' : 'desactivado'}`);
      } catch (error) {
        toast.error('Error al cambiar estado del profesional');
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gold">Profesionales</h2>
          <button onClick={() => openProfesionalModal()} className="px-4 py-2 bg-gold text-black font-semibold rounded hover:bg-gold/90 transition flex items-center gap-2">
            <FiPlus className="w-4 h-4" />
            Nuevo Profesional
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profesionales.length === 0 ? (
            <div className="bg-gray-800 border border-gold/30 rounded-lg p-8 text-center col-span-full">
              <FiUsers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No hay profesionales registrados</p>
            </div>
          ) : (
            profesionales.map((prof) => (
              <div key={prof.id} className="bg-gray-800 border border-gold/30 rounded-lg p-6">
                {prof.foto && <img src={prof.foto} alt={prof.nombre} className="w-full h-32 object-cover rounded mb-4" />}
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-white">{prof.nombre}</h3>
                  <span className={`px-2 py-1 rounded text-xs ${prof.activo ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'}`}>
                    {prof.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-gray-400 mb-4">{prof.especialidad}</p>
                <div className="flex gap-2">
                  <button onClick={() => toggleProfesional(prof)} className={`flex-1 py-2 rounded text-sm font-medium ${prof.activo ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'} hover:opacity-80 transition`}>
                    {prof.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => openProfesionalModal(prof)} className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition">
                    <FiEdit className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {showProfesionalModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 border border-gold/30 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-gold mb-4">{editingProfesional ? 'Editar Profesional' : 'Nuevo Profesional'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Nombre</label>
                  <input type="text" value={profesionalForm.nombre} onChange={(e) => setProfesionalForm({ ...profesionalForm, nombre: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Especialidad</label>
                  <input type="text" value={profesionalForm.especialidad} onChange={(e) => setProfesionalForm({ ...profesionalForm, especialidad: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Foto</label>
                  <input type="file" accept="image/*" onChange={(e) => setProfesionalForm({ ...profesionalForm, fotoFile: e.target.files[0] })} className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gold file:text-black hover:file:bg-gold/90" />
                </div>
                {profesionalForm.foto && <img src={profesionalForm.foto} alt="Preview" className="w-full h-32 object-cover rounded" />}
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="activoProf" checked={profesionalForm.activo} onChange={(e) => setProfesionalForm({ ...profesionalForm, activo: e.target.checked })} className="w-4 h-4" />
                  <label htmlFor="activoProf" className="text-sm text-gray-300">Activo</label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowProfesionalModal(false)} className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition">Cancelar</button>
                <button onClick={saveProfesional} className="flex-1 px-4 py-2 bg-gold text-black font-semibold rounded hover:bg-gold/90 transition">Guardar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <nav className="bg-gray-900 border-b border-gold/30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gold">Panel de Administración</h1>
          <button onClick={logout} className="px-4 py-2 bg-gold text-black font-semibold rounded hover:bg-gold/90 transition">
            Cerrar sesión
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg mb-6 overflow-x-auto">
          {[
            { id: 'turnos',       label: 'Turnos del Día', icon: FiCalendar },
            { id: 'clientes',     label: 'Clientes',       icon: FiUsers },
            { id: 'servicios',    label: 'Servicios',      icon: FiCheck },
            { id: 'promociones',  label: 'Promociones',    icon: FiDollarSign },
            { id: 'profesionales',label: 'Profesionales',  icon: FiUsers },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gold text-black'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-gray-900 border border-gold/30 rounded-lg p-6">
          {activeTab === 'turnos'        && renderTurnosDelDia()}
          {activeTab === 'clientes'      && renderClientes()}
          {activeTab === 'servicios'     && renderGestionServicios()}
          {activeTab === 'promociones'   && renderPromociones()}
          {activeTab === 'profesionales' && renderProfesionales()}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
