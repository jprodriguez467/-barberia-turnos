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
} from 'react-icons/fi';

// Estados de turnos
const TURNOS_ESTADOS = {
  confirmado: { label: 'Confirmado', color: 'bg-blue-500', next: 'en_curso' },
  en_curso: { label: 'En Curso', color: 'bg-yellow-500', next: 'completado' },
  completado: { label: 'Completado', color: 'bg-green-500', next: 'cancelado' },
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

const AdminPage = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('turnos');
  const [turnosHoy, setTurnosHoy] = useState([]);
  const [servicios, setServicios] = useState(DEFAULT_SERVICIOS);
  const [profesionales, setProfesionales] = useState([]);
  const [promociones, setPromociones] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Cargar datos iniciales
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

    // Ordenar por hora
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
        // Si no existe, crear con valores por defecto
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

  // Cambiar estado de turno
  const cambiarEstadoTurno = async (turnoId, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'turnos', turnoId), {
        estado: nuevoEstado,
        actualizadoEn: serverTimestamp(),
      });

      // Recargar turnos
      await loadTurnosHoy();
      toast.success(`Turno ${TURNOS_ESTADOS[nuevoEstado].label.toLowerCase()}`);
    } catch (error) {
      console.error('Error cambiando estado:', error);
      toast.error('Error al cambiar estado del turno');
    }
  };

  // Calcular estadísticas del día
  const calcularEstadisticas = () => {
    const turnosCompletados = turnosHoy.filter(t => t.estado === 'completado');
    const ingresos = turnosCompletados.reduce((sum, turno) => sum + turno.precioFinal, 0);

    return {
      totalTurnos: turnosHoy.length,
      ingresos,
    };
  };

  // Formatear precio
  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Subir imagen a Firebase Storage
  const uploadImage = async (file, path) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  // SECCIÓN 1: TURNOS DEL DÍA
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
                        <div className="text-sm text-gray-400">{turno.servicio} - {turno.profesional}</div>
                      </div>
                    </div>
                    <div className="text-lg font-bold text-green-400">{formatPrice(turno.precioFinal)}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${TURNOS_ESTADOS[turno.estado].color} text-white`}>
                      {TURNOS_ESTADOS[turno.estado].label}
                    </span>

                    {TURNOS_ESTADOS[turno.estado].next && (
                      <button
                        onClick={() => cambiarEstadoTurno(turno.id, TURNOS_ESTADOS[turno.estado].next)}
                        className="px-3 py-1 bg-gold text-black rounded hover:bg-gold/90 transition text-sm font-medium"
                      >
                        {TURNOS_ESTADOS[turno.estado].next === 'en_curso' && 'Iniciar'}
                        {TURNOS_ESTADOS[turno.estado].next === 'completado' && 'Completar'}
                        {TURNOS_ESTADOS[turno.estado].next === 'cancelado' && 'Cancelar'}
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

  // SECCIÓN 2: GESTIÓN DE SERVICIOS
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

        // Subir nueva foto si existe
        if (servicioForm.fotoFile) {
          const path = `servicios/${Date.now()}_${servicioForm.fotoFile.name}`;
          fotoUrl = await uploadImage(servicioForm.fotoFile, path);
        }

        const servicioData = {
          ...servicioForm,
          foto: fotoUrl,
          activo: true,
        };

        let updatedServicios;
        if (editingServicio) {
          // Actualizar servicio existente
          updatedServicios = servicios.map(s =>
            s.id === editingServicio.id ? { ...servicioData, id: s.id } : s
          );
        } else {
          // Agregar nuevo servicio
          const newId = `servicio_${Date.now()}`;
          updatedServicios = [...servicios, { ...servicioData, id: newId }];
        }

        // Guardar en Firestore
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
                <div>Normal: {formatPrice(servicio.precios.normal)}</div>
                <div>-15 días: {formatPrice(servicio.precios.dias15)}</div>
                <div>-10 días: {formatPrice(servicio.precios.dias10)}</div>
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

        {/* Modal Servicio */}
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
                    onChange={(e) => setServicioForm({...servicioForm, nombre: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Duración</label>
                  <input
                    type="text"
                    value={servicioForm.duracion}
                    onChange={(e) => setServicioForm({...servicioForm, duracion: e.target.value})}
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
                      onChange={(e) => setServicioForm({
                        ...servicioForm,
                        precios: {...servicioForm.precios, normal: parseInt(e.target.value) || 0}
                      })}
                      className="w-full px-2 py-1 bg-gray-800 border border-gold/30 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gold mb-1">-15 días</label>
                    <input
                      type="number"
                      value={servicioForm.precios.dias15}
                      onChange={(e) => setServicioForm({
                        ...servicioForm,
                        precios: {...servicioForm.precios, dias15: parseInt(e.target.value) || 0}
                      })}
                      className="w-full px-2 py-1 bg-gray-800 border border-gold/30 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gold mb-1">-10 días</label>
                    <input
                      type="number"
                      value={servicioForm.precios.dias10}
                      onChange={(e) => setServicioForm({
                        ...servicioForm,
                        precios: {...servicioForm.precios, dias10: parseInt(e.target.value) || 0}
                      })}
                      className="w-full px-2 py-1 bg-gray-800 border border-gold/30 rounded text-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Foto</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setServicioForm({...servicioForm, fotoFile: e.target.files[0]})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gold file:text-black hover:file:bg-gold/90"
                  />
                </div>

                {servicioForm.foto && (
                  <div className="mt-2">
                    <img src={servicioForm.foto} alt="Preview" className="w-full h-32 object-cover rounded" />
                  </div>
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

  // SECCIÓN 3: PROMOCIONES
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
        setPromocionForm({
          titulo: '',
          descripcion: '',
          precioEspecial: 0,
          fechaInicio: '',
          fechaFin: '',
          activo: true,
        });
      }
      setShowPromocionModal(true);
    };

    const savePromocion = async () => {
      try {
        const promocionData = {
          ...promocionForm,
          creadoEn: serverTimestamp(),
        };

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
        await updateDoc(doc(db, 'promociones', promocion.id), {
          activo: !promocion.activo,
        });
        await loadPromociones();
        toast.success(`Promoción ${!promocion.activo ? 'activada' : 'desactivada'}`);
      } catch (error) {
        console.error('Error cambiando estado:', error);
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
                      <span className={`px-2 py-1 rounded text-xs ${
                        promo.activo ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'
                      }`}>
                        {promo.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <p className="text-gray-400 mb-2">{promo.descripcion}</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-400 font-bold">{formatPrice(promo.precioEspecial)}</span>
                      <span className="text-gray-400">
                        {new Date(promo.fechaInicio).toLocaleDateString()} - {new Date(promo.fechaFin).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => togglePromocion(promo)}
                      className={`p-2 rounded ${
                        promo.activo ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'
                      } hover:opacity-80 transition`}
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

        {/* Modal Promoción */}
        {showPromocionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 border border-gold/30 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-gold mb-4">
                {editingPromocion ? 'Editar Promoción' : 'Nueva Promoción'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Título</label>
                  <input
                    type="text"
                    value={promocionForm.titulo}
                    onChange={(e) => setPromocionForm({...promocionForm, titulo: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Descripción</label>
                  <textarea
                    value={promocionForm.descripcion}
                    onChange={(e) => setPromocionForm({...promocionForm, descripcion: e.target.value})}
                    rows="3"
                    className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Precio Especial</label>
                  <input
                    type="number"
                    value={promocionForm.precioEspecial}
                    onChange={(e) => setPromocionForm({...promocionForm, precioEspecial: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gold mb-2">Fecha Inicio</label>
                    <input
                      type="date"
                      value={promocionForm.fechaInicio}
                      onChange={(e) => setPromocionForm({...promocionForm, fechaInicio: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gold mb-2">Fecha Fin</label>
                    <input
                      type="date"
                      value={promocionForm.fechaFin}
                      onChange={(e) => setPromocionForm({...promocionForm, fechaFin: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={promocionForm.activo}
                    onChange={(e) => setPromocionForm({...promocionForm, activo: e.target.checked})}
                    className="w-4 h-4 text-gold bg-gray-800 border-gold/30 rounded focus:ring-gold"
                  />
                  <label htmlFor="activo" className="text-sm text-gray-300">Activa</label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowPromocionModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={savePromocion}
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

  // SECCIÓN 4: GESTIÓN DE PROFESIONALES
  const renderProfesionales = () => {
    const openProfesionalModal = (profesional = null) => {
      if (profesional) {
        setEditingProfesional(profesional);
        setProfesionalForm({
          nombre: profesional.nombre,
          especialidad: profesional.especialidad,
          foto: profesional.foto,
          fotoFile: null,
          activo: profesional.activo,
        });
      } else {
        setEditingProfesional(null);
        setProfesionalForm({
          nombre: '',
          especialidad: '',
          foto: null,
          fotoFile: null,
          activo: true,
        });
      }
      setShowProfesionalModal(true);
    };

    const saveProfesional = async () => {
      try {
        let fotoUrl = profesionalForm.foto;

        // Subir nueva foto si existe
        if (profesionalForm.fotoFile) {
          const path = `profesionales/${Date.now()}_${profesionalForm.fotoFile.name}`;
          fotoUrl = await uploadImage(profesionalForm.fotoFile, path);
        }

        const profesionalData = {
          ...profesionalForm,
          foto: fotoUrl,
          actualizadoEn: serverTimestamp(),
        };

        if (editingProfesional) {
          await updateDoc(doc(db, 'profesionales', editingProfesional.id), profesionalData);
        } else {
          await addDoc(collection(db, 'profesionales'), profesionalData);
        }

        await loadProfesionales();
        setShowProfesionalModal(false);
        toast.success('Profesional guardado correctamente');
      } catch (error) {
        console.error('Error guardando profesional:', error);
        toast.error('Error al guardar el profesional');
      }
    };

    const toggleProfesional = async (profesional) => {
      try {
        await updateDoc(doc(db, 'profesionales', profesional.id), {
          activo: !profesional.activo,
        });
        await loadProfesionales();
        toast.success(`Profesional ${!profesional.activo ? 'activado' : 'desactivado'}`);
      } catch (error) {
        console.error('Error cambiando estado:', error);
        toast.error('Error al cambiar estado del profesional');
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gold">Profesionales</h2>
          <button
            onClick={() => openProfesionalModal()}
            className="px-4 py-2 bg-gold text-black font-semibold rounded hover:bg-gold/90 transition flex items-center gap-2"
          >
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
                {prof.foto && (
                  <img
                    src={prof.foto}
                    alt={prof.nombre}
                    className="w-full h-32 object-cover rounded mb-4"
                  />
                )}
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-white">{prof.nombre}</h3>
                  <span className={`px-2 py-1 rounded text-xs ${
                    prof.activo ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {prof.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-gray-400 mb-4">{prof.especialidad}</p>

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleProfesional(prof)}
                    className={`flex-1 py-2 rounded text-sm font-medium ${
                      prof.activo ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'
                    } hover:opacity-80 transition`}
                  >
                    {prof.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => openProfesionalModal(prof)}
                    className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition"
                  >
                    <FiEdit className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Profesional */}
        {showProfesionalModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 border border-gold/30 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-gold mb-4">
                {editingProfesional ? 'Editar Profesional' : 'Nuevo Profesional'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Nombre</label>
                  <input
                    type="text"
                    value={profesionalForm.nombre}
                    onChange={(e) => setProfesionalForm({...profesionalForm, nombre: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Especialidad</label>
                  <input
                    type="text"
                    value={profesionalForm.especialidad}
                    onChange={(e) => setProfesionalForm({...profesionalForm, especialidad: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gold mb-2">Foto</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProfesionalForm({...profesionalForm, fotoFile: e.target.files[0]})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gold/30 rounded text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gold file:text-black hover:file:bg-gold/90"
                  />
                </div>

                {profesionalForm.foto && (
                  <div className="mt-2">
                    <img src={profesionalForm.foto} alt="Preview" className="w-full h-32 object-cover rounded" />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activoProf"
                    checked={profesionalForm.activo}
                    onChange={(e) => setProfesionalForm({...profesionalForm, activo: e.target.checked})}
                    className="w-4 h-4 text-gold bg-gray-800 border-gold/30 rounded focus:ring-gold"
                  />
                  <label htmlFor="activoProf" className="text-sm text-gray-300">Activo</label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowProfesionalModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveProfesional}
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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      {/* Header */}
      <nav className="bg-gray-900 border-b border-gold/30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gold">Panel de Administración</h1>
          <button
            onClick={logout}
            className="px-4 py-2 bg-gold text-black font-semibold rounded hover:bg-gold/90 transition"
          >
            Cerrar sesión
          </button>
        </div>
      </nav>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg mb-6">
          {[
            { id: 'turnos', label: 'Turnos del Día', icon: FiCalendar },
            { id: 'servicios', label: 'Servicios', icon: FiCheck },
            { id: 'promociones', label: 'Promociones', icon: FiDollarSign },
            { id: 'profesionales', label: 'Profesionales', icon: FiUsers },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
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

        {/* Contenido */}
        <div className="bg-gray-900 border border-gold/30 rounded-lg p-6">
          {activeTab === 'turnos' && renderTurnosDelDia()}
          {activeTab === 'servicios' && renderGestionServicios()}
          {activeTab === 'promociones' && renderPromociones()}
          {activeTab === 'profesionales' && renderProfesionales()}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;