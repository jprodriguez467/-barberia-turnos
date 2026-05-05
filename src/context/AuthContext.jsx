import React, { createContext, useState, useEffect, useContext } from 'react';
import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  onAuthStateChanged,
  signOut,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import {
  doc,
  setDoc,
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

const AuthContext = createContext();

const ADMIN_EMAILS = ['jprodriguez467@gmail.com'];
const ADMIN_PHONES = ['+5493425459653', '+543425459653'];

export const AuthProvider = ({ children }) => {
  const [user, setUser]                             = useState(null);
  const [isAdmin, setIsAdmin]                       = useState(false);
  const [loading, setLoading]                       = useState(true);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [verificationId, setVerificationId]         = useState(null);
  const [needsProfile, setNeedsProfile]             = useState(false);
  const [clienteData, setClienteData]               = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const tel   = currentUser.phoneNumber;
        const email = currentUser.email;
        const adminCheck =
          ADMIN_EMAILS.includes(email) ||
          ADMIN_PHONES.includes(tel) ||
          ADMIN_PHONES.includes(tel?.replace('+549', '+54')) ||
          ADMIN_PHONES.includes(tel?.replace('+54', '+549'));
        setIsAdmin(adminCheck);
      } else {
        setUser(null);
        setIsAdmin(false);
        setClienteData(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result   = await signInWithPopup(auth, provider);
      const email    = result.user.email;
      if (!ADMIN_EMAILS.includes(email)) {
        await signOut(auth);
        return { success: false, error: 'Este correo no tiene acceso como administrador.' };
      }
      return { success: true };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: 'Error al iniciar sesión con Google.' };
    }
  };

  const buscarClientePorNombre = async (nombre, apellido) => {
    try {
      const nombreNorm   = nombre.trim().toLowerCase();
      const apellidoNorm = apellido.trim().toLowerCase();
      const q = query(
        collection(db, 'clientes'),
        where('nombreNorm', '==', nombreNorm),
        where('apellidoNorm', '==', apellidoNorm)
      );
      const snap = await getDocs(q);
      if (snap.empty)    return { status: 'notfound' };
      if (snap.size > 1) return { status: 'multiple' };
      return { status: 'found', cliente: { id: snap.docs[0].id, ...snap.docs[0].data() } };
    } catch (error) {
      console.error('buscarClientePorNombre error:', error);
      return { status: 'error' };
    }
  };

  const loginConNombre = async (cliente, telefono) => {
    try {
      await signInAnonymously(auth);
      if (cliente.id) {
        if (telefono) {
          await updateDoc(doc(db, 'clientes', cliente.id), { whatsapp: telefono });
        }
        const snap = await getDoc(doc(db, 'clientes', cliente.id));
        setClienteData({ id: snap.id, ...snap.data() });
      } else {
        const docRef = doc(collection(db, 'clientes'));
        await setDoc(docRef, {
          nombre:       cliente.nombre,
          apellido:     cliente.apellido,
          nombreNorm:   cliente.nombre.trim().toLowerCase(),
          apellidoNorm: cliente.apellido.trim().toLowerCase(),
          whatsapp:     telefono,
          visitas:      0,
          descuento:    0,
          creadoEn:     serverTimestamp(),
        });
        const newSnap = await getDoc(docRef);
        setClienteData({ id: docRef.id, ...newSnap.data() });
      }
      return true;
    } catch (error) {
      console.error('loginConNombre error:', error);
      return false;
    }
  };

  const loginByName = async (nombre, apellido, whatsapp = null) => {
    try {
      const nombreNorm   = nombre.trim().toLowerCase();
      const apellidoNorm = apellido.trim().toLowerCase();
      const clientesRef  = collection(db, 'clientes');
      const q = query(
        clientesRef,
        where('nombreNorm', '==', nombreNorm),
        where('apellidoNorm', '==', apellidoNorm)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        if (!whatsapp) return { found: false, needsWhatsapp: true };
        await signInAnonymously(auth);
        const docRef = doc(clientesRef);
        await setDoc(docRef, {
          nombre: nombre.trim(), apellido: apellido.trim(),
          nombreNorm, apellidoNorm, whatsapp,
          visitas: 0, descuento: 0, creadoEn: serverTimestamp(),
        });
        const newSnap = await getDoc(docRef);
        setClienteData({ id: docRef.id, ...newSnap.data() });
        return { found: true, isNew: true };
      }
      if (snap.size > 1 && !whatsapp) {
        return { found: false, multipleFound: true, needsWhatsapp: true };
      }
      let clienteDoc = snap.docs[0];
      if (snap.size > 1 && whatsapp) {
        const wNorm = whatsapp.replace(/\D/g, '');
        clienteDoc = snap.docs.find(d => {
          const w = (d.data().whatsapp || '').replace(/\D/g, '');
          return w.endsWith(wNorm) || wNorm.endsWith(w);
        }) || snap.docs[0];
      }
      await signInAnonymously(auth);
      setClienteData({ id: clienteDoc.id, ...clienteDoc.data() });
      return { found: true, isNew: false, data: clienteDoc.data() };
    } catch (error) {
      console.error('loginByName error:', error);
      return { found: false, error: error.message };
    }
  };

  const setupRecaptcha = (elementId) => {
    try {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
      window.recaptchaVerifier = new RecaptchaVerifier(auth, elementId, { size: 'invisible' });
      return window.recaptchaVerifier;
    } catch (error) {
      console.error('Recaptcha error:', error);
      throw error;
    }
  };

  const sendVerificationCode = async (phoneNumber) => {
    try {
      const verifier = setupRecaptcha('recaptcha-container');
      const result   = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmationResult(result);
      setVerificationId(result.verificationId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const verifyCode = async (code) => {
    try {
      if (!confirmationResult) throw new Error('No hay confirmación pendiente');
      await confirmationResult.confirm(code);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setConfirmationResult(null);
      setVerificationId(null);
      setNeedsProfile(false);
      setIsAdmin(false);
      setClienteData(null);
      toast.success('Sesión cerrada');
      return true;
    } catch (error) {
      toast.error('Error al cerrar sesión');
      return false;
    }
  };

  const updateClienteVisitas = async (clienteId) => {
    try {
      const ref  = doc(db, 'clientes', clienteId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data      = snap.data();
      const visitas   = (data.visitas || 0) + 1;
      const descuento = visitas >= 10 ? 30 : visitas >= 5 ? 20 : visitas >= 3 ? 10 : 0;
      await updateDoc(ref, { visitas, descuento, ultimaVisita: serverTimestamp() });
      setClienteData(prev => ({ ...prev, visitas, descuento }));
    } catch (error) {
      console.error('Error actualizando visitas:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading,
        clienteData,
        setClienteData,
        needsProfile,
        confirmationResult,
        verificationId,
        loginWithGoogle,
        loginByName,
        buscarClientePorNombre,
        loginConNombre,
        sendVerificationCode,
        verifyCode,
        logout,
        updateClienteVisitas,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;