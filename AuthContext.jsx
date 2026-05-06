import React, { createContext, useState, useEffect } from 'react';
import {
  signInAnonymously,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);
  const [clienteData, setClienteData] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [isAdmin, setIsAdmin]         = useState(false);

  // Restaurar sesión al recargar
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const saved = sessionStorage.getItem('clienteData');
        if (saved) {
          try {
            setClienteData(JSON.parse(saved));
          } catch {
            sessionStorage.removeItem('clienteData');
          }
        }
        // Verificar si es admin
        try {
          const adminSnap = await getDoc(doc(db, 'admins', 'config'));
          if (adminSnap.exists()) {
            const admins = adminSnap.data().telefonos || [];
            const phone = currentUser.phoneNumber || '';
            if (admins.includes(phone)) setIsAdmin(true);
          }
        } catch {
          // no es admin
        }
      } else {
        setClienteData(null);
        setIsAdmin(false);
        sessionStorage.removeItem('clienteData');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ── Buscar cliente por nombre y apellido en la colección 'clientes' ──────
  const buscarClientePorNombre = async (nombre, apellido) => {
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      const q = query(
        collection(db, 'clientes'),
        where('nombre', '==', nombre),
        where('apellido', '==', apellido)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        // Buscar por nombreCompleto como fallback
        const q2 = query(
          collection(db, 'clientes'),
          where('nombreCompleto', '==', `${nombre} ${apellido}`)
        );
        const snap2 = await getDocs(q2);
        if (snap2.empty) return { status: 'notfound' };
        if (snap2.docs.length > 1) return { status: 'multiple' };
        return {
          status: 'found',
          cliente: { id: snap2.docs[0].id, ...snap2.docs[0].data() },
        };
      }
      if (snap.docs.length > 1) return { status: 'multiple' };
      return {
        status: 'found',
        cliente: { id: snap.docs[0].id, ...snap.docs[0].data() },
      };
    } catch (error) {
      console.error('Error buscando cliente:', error);
      return { status: 'notfound' };
    }
  };

  // ── Login con nombre (cliente encontrado o nuevo) ────────────────────────
  const loginConNombre = async (cliente, whatsapp) => {
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      const clienteConDatos = {
        ...cliente,
        whatsapp: whatsapp || cliente.whatsapp || cliente.telefono || '',
      };

      // Guardar whatsapp en Firestore si se proporcionó
      if (whatsapp && cliente.id) {
        try {
          await updateDoc(doc(db, 'clientes', cliente.id), {
            whatsapp,
            ultimaVisita: serverTimestamp(),
          });
        } catch (e) {
          console.warn('No se pudo actualizar whatsapp:', e.message);
        }
      }

      setClienteData(clienteConDatos);
      sessionStorage.setItem('clienteData', JSON.stringify(clienteConDatos));
      return true;
    } catch (error) {
      console.error('Error en loginConNombre:', error);
      return false;
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      await signOut(auth);
      setClienteData(null);
      setIsAdmin(false);
      sessionStorage.removeItem('clienteData');
      toast.success('Sesión cerrada');
      return true;
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      toast.error('Error al cerrar sesión');
      return false;
    }
  };

  const value = {
    user,
    clienteData,
    loading,
    isAdmin,
    buscarClientePorNombre,
    loginConNombre,
    logout,
    // Aliases para compatibilidad con código viejo
    userDoc: clienteData,
    needsProfile: false,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth debe ser usado dentro de AuthProvider');
  return context;
};
