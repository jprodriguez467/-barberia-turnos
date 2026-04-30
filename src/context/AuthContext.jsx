import React, { createContext, useState, useEffect } from 'react';
import { signInWithPhoneNumber, RecaptchaVerifier, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                         = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [verificationId, setVerificationId]     = useState(null);
  const [userDoc, setUserDoc]                   = useState(null);
  const [needsProfile, setNeedsProfile]         = useState(false);
  const [isAdmin, setIsAdmin]                   = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
    // Admin hardcodeado
const ADMIN_PHONES = ['+5493425459653', '+543425459653'];
const tel = currentUser.phoneNumber;
const adminCheck =
  ADMIN_PHONES.includes(tel) ||
  ADMIN_PHONES.includes(tel?.replace('+549', '+54')) ||
  ADMIN_PHONES.includes(tel?.replace('+54', '+549'));
setIsAdmin(adminCheck);

          // Cargar datos del usuario
          const userRef  = doc(db, 'usuarios', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserDoc(data);
            if (!data.nombre || data.nombre.trim() === '') setNeedsProfile(true);
          }
        } catch (error) {
          console.error('Error obteniendo datos del usuario:', error);
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

  const initRecaptcha = () => {
    if (window.recaptchaVerifier) { window.recaptchaVerifier.clear(); window.recaptchaVerifier = null; }
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {},
      'expired-callback': () => { window.recaptchaVerifier = null; },
    });
  };

  const loginWithPhone = async (phoneNumber) => {
    try {
      const cleaned  = phoneNumber.replace(/\D/g, '');
      const formatted = cleaned.startsWith('54') ? `+${cleaned}` : `+54${cleaned}`;
      const result   = await signInWithPhoneNumber(auth, formatted, window.recaptchaVerifier);
      setConfirmationResult(result);
      setVerificationId(result.verificationId);
      toast.success('Código enviado por SMS');
      return true;
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      toast.error(`Error: ${error.code} - ${error.message}`);
      window.recaptchaVerifier = null;
      return false;
    }
  };

  const buscarClienteImportado = async (telefono) => {
    try {
      const formatos = [
        telefono,
        telefono.replace('+549', '+54'),
        telefono.replace('+54', ''),
        telefono.replace('+549', '0'),
      ];
      for (const formato of formatos) {
        const q    = query(collection(db, 'clientes'), where('telefono', '==', formato));
        const snap = await getDocs(q);
        if (!snap.empty) return snap.docs[0].data();
      }
      return null;
    } catch (error) {
      console.error('Error buscando cliente:', error);
      return null;
    }
  };

  const verifyOTP = async (otp) => {
    if (!confirmationResult) { toast.error('No se encontró la confirmación. Intenta de nuevo'); return false; }
    try {
      const userCredential = await confirmationResult.confirm(otp);
      const currentUser    = userCredential.user;
      const userRef        = doc(db, 'usuarios', currentUser.uid);
      const userSnap       = await getDoc(userRef);

      if (!userSnap.exists()) {
        const clienteImportado = await buscarClienteImportado(currentUser.phoneNumber);
        if (clienteImportado) {
          await setDoc(userRef, {
            uid: currentUser.uid, telefono: currentUser.phoneNumber,
            nombre: clienteImportado.nombre || '', apellido: clienteImportado.apellido || '',
            nombreCompleto: clienteImportado.nombreCompleto || '',
            ultimoCorte: null, creadoEn: serverTimestamp(), importado: true,
          });
          setNeedsProfile(false);
          toast.success(`¡Bienvenido de vuelta, ${clienteImportado.nombre}!`);
        } else {
          await setDoc(userRef, {
            uid: currentUser.uid, telefono: currentUser.phoneNumber,
            nombre: '', apellido: '', ultimoCorte: null,
            creadoEn: serverTimestamp(), importado: false,
          });
          setNeedsProfile(true);
        }
      } else {
        const data = userSnap.data();
        if (!data.nombre || data.nombre.trim() === '') setNeedsProfile(true);
      }

      setConfirmationResult(null);
      toast.success('¡Sesión iniciada correctamente!');
      return true;
    } catch (error) {
      console.error('Error al verificar OTP:', error);
      toast.error(`Código inválido: ${error.code} - ${error.message}`);
      return false;
    }
  };

  const completarPerfil = async (nombre, apellido) => {
    if (!user) return false;
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), {
        nombre, apellido, nombreCompleto: `${nombre} ${apellido}`.trim(),
      });
      setUserDoc((prev) => ({ ...prev, nombre, apellido, nombreCompleto: `${nombre} ${apellido}`.trim() }));
      setNeedsProfile(false);
      toast.success(`¡Bienvenido, ${nombre}!`);
      return true;
    } catch (error) {
      console.error('Error completando perfil:', error);
      toast.error('Error al guardar tu nombre');
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setConfirmationResult(null);
      setVerificationId(null);
      setNeedsProfile(false);
      setIsAdmin(false);
      toast.success('Sesión cerrada');
      return true;
    } catch (error) {
      toast.error('Error al cerrar sesión');
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, userDoc, loading, needsProfile, isAdmin, confirmationResult, verificationId, loginWithPhone, verifyOTP, completarPerfil, logout, initRecaptcha }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth debe ser usado dentro de AuthProvider');
  return context;
};
