import React, { createContext, useState, useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

// Admin hardcodeado
const ADMIN_PHONES = ['+5493425459653', '+543425459653'];

const capitalize = (str) =>
  str ? str.trim().replace(/\b\w/g, (c) => c.toUpperCase()) : '';

export const AuthProvider = ({ children }) => {
  const [user, setUser]                             = useState(null);
  const [loading, setLoading]                       = useState(true);
  const [userDoc, setUserDoc]                       = useState(null);
  const [needsProfile, setNeedsProfile]             = useState(false);
  const [isAdmin, setIsAdmin]                       = useState(false);

  // ── Observador de sesión ──────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          // Chequeo admin por teléfono (login por SMS)
          if (currentUser.phoneNumber) {
            const tel = currentUser.phoneNumber;
            const adminCheck =
              ADMIN_PHONES.includes(tel) ||
              ADMIN_PHONES.includes(tel?.replace('+549', '+54')) ||
              ADMIN_PHONES.includes(tel?.replace('+54', '+549'));
            setIsAdmin(adminCheck);
          }

          // Cargar documento del usuario
          const userRef  = doc(db, 'usuarios', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserDoc(data);
            if (!data.nombre || data.nombre.trim() === '') setNeedsProfile(true);
          }
        } catch (error) {
          console.error('Error cargando usuario:', error);
        }
      } else {
        setUser(null);
        setUserDoc(null);
        setNeedsProfile(false);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ── Buscar cliente por nombre en Firestore ────────────────────────────────
  const buscarClientePorNombre = async (nombre, apellido) => {
    try {
      const nombreNorm    = capitalize(nombre);
      const apellidoNorm  = capitalize(apellido);
      const nombreCompleto = `${nombreNorm} ${apellidoNorm}`;

      const encontrados = [];

      // Buscar en colección "clientes" (importados de AgendaPro)
      const colecciones = ['clientes', 'usuarios'];
      for (const col of colecciones) {
        // Por nombreCompleto
        const q1 = query(collection(db, col), where('nombreCompleto', '==', nombreCompleto));
        const s1 = await getDocs(q1);
        s1.docs.forEach(d => {
          if (!encontrados.find(r => r.id === d.id)) {
            encontrados.push({ id: d.id, _col: col, ...d.data() });
          }
        });

        // Por nombre + apellido separados
        if (encontrados.length === 0) {
          const q2 = query(
            collection(db, col),
            where('nombre', '==', nombreNorm),
            where('apellido', '==', apellidoNorm)
          );
          const s2 = await getDocs(q2);
          s2.docs.forEach(d => {
            if (!encontrados.find(r => r.id === d.id)) {
              encontrados.push({ id: d.id, _col: col, ...d.data() });
            }
          });
        }
      }

      if (encontrados.length === 0) return { status: 'notfound' };
      if (encontrados.length === 1) return { status: 'found', cliente: encontrados[0] };
      return { status: 'multiple', clientes: encontrados };
    } catch (error) {
      console.error('Error buscando cliente:', error);
      return { status: 'notfound' };
    }
  };

  // ── Login anónimo con datos del cliente ───────────────────────────────────
  const loginConNombre = async (clienteData, telefono = null) => {
    try {
      const cred = await signInAnonymously(auth);
      const uid  = cred.user.uid;

      const tel = telefono || clienteData.telefono || '';
      const userRef = doc(db, 'usuarios', uid);

      await setDoc(userRef, {
        uid,
        nombre:         clienteData.nombre        || '',
        apellido:       clienteData.apellido       || '',
        nombreCompleto: clienteData.nombreCompleto || `${clienteData.nombre} ${clienteData.apellido}`.trim(),
        telefono:       tel,
        ultimoCorte:    clienteData.ultimoCorte    || null,
        clienteRefId:   clienteData.id             || null,
        creadoEn:       serverTimestamp(),
        loginType:      'name',
      }, { merge: true });

      // Si tiene teléfono nuevo, actualizar también en "clientes"
      if (telefono && clienteData.id) {
        try {
          const col = clienteData._col || 'clientes';
          await updateDoc(doc(db, col, clienteData.id), { telefono });
        } catch (_) {}
      }

      setUser(cred.user);
      setUserDoc({
        uid,
        nombre:         clienteData.nombre        || '',
        apellido:       clienteData.apellido       || '',
        nombreCompleto: clienteData.nombreCompleto || '',
        telefono:       tel,
        ultimoCorte:    clienteData.ultimoCorte    || null,
      });
      setNeedsProfile(false);
      setIsAdmin(false);
      toast.success(`¡Bienvenido, ${clienteData.nombre}!`);
      return true;
    } catch (error) {
      console.error('Error en loginConNombre:', error);
      toast.error('Error al iniciar sesión. Intentá de nuevo.');
      return false;
    }
  };

  // ── Completar perfil (cliente sin nombre) ─────────────────────────────────
  const completarPerfil = async (nombre, apellido) => {
    if (!user) return false;
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), {
        nombre, apellido,
        nombreCompleto: `${nombre} ${apellido}`.trim(),
      });
      setUserDoc((prev) => ({
        ...prev, nombre, apellido,
        nombreCompleto: `${nombre} ${apellido}`.trim(),
      }));
      setNeedsProfile(false);
      toast.success(`¡Bienvenido, ${nombre}!`);
      return true;
    } catch (error) {
      toast.error('Error al guardar tu nombre');
      return false;
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserDoc(null);
      setNeedsProfile(false);
      setIsAdmin(false);
      toast.success('Sesión cerrada');
      return true;
    } catch (error) {
      toast.error('Error al cerrar sesión');
      return false;
    }
  };

  // ── Admin: login por SMS (se mantiene para acceso admin) ──────────────────
  const initRecaptcha = () => {
    const { RecaptchaVerifier } = require('firebase/auth');
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {},
      'expired-callback': () => { window.recaptchaVerifier = null; },
    });
  };

  return (
    <AuthContext.Provider value={{
      user, userDoc, loading, needsProfile, isAdmin,
      buscarClientePorNombre,
      loginConNombre,
      completarPerfil,
      logout,
      initRecaptcha,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth debe ser usado dentro de AuthProvider');
  return context;
};
