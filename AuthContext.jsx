import React, { createContext, useState, useEffect } from 'react';
import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  onAuthStateChanged,
  signOut,
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

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                     = useState(null);
  const [loading, setLoading]               = useState(true);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [verificationId, setVerificationId] = useState(null);
  const [userDoc, setUserDoc]               = useState(null);

  // ── NUEVO: controla si hay que pedirle el nombre al cliente ──────────────
  const [needsProfile, setNeedsProfile]     = useState(false);

  // Escuchar cambios de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userRef  = doc(db, 'usuarios', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserDoc(data);
            // Si ya existe pero no tiene nombre → pedir que complete perfil
            if (!data.nombre || data.nombre.trim() === '') {
              setNeedsProfile(true);
            }
          }
        } catch (error) {
          console.error('Error obteniendo datos del usuario:', error);
        }
      } else {
        setUser(null);
        setUserDoc(null);
        setNeedsProfile(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Inicializar RecaptchaVerifier invisible
  const initRecaptcha = () => {
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

  // Login con teléfono
  const loginWithPhone = async (phoneNumber) => {
    try {
      const cleanedPhone   = phoneNumber.replace(/\D/g, '');
      const formattedPhone = cleanedPhone.startsWith('54')
        ? `+${cleanedPhone}`
        : `+54${cleanedPhone}`;

      const result = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
      setConfirmationResult(result);
      setVerificationId(result.verificationId);
      toast.success('Código enviado por SMS');
      return true;
    } catch (error) {
      console.error('Error al iniciar sesión con teléfono:', error);
      toast.error(`Error: ${error.code} - ${error.message}`);
      window.recaptchaVerifier = null;
      return false;
    }
  };

  // ── Buscar cliente en la colección 'clientes' por teléfono ───────────────
  const buscarClienteImportado = async (telefono) => {
    try {
      // Intentar distintos formatos del teléfono
      const formatos = [
        telefono,                                    // +5492235551234
        telefono.replace('+549', '+54'),             // +542235551234
        telefono.replace('+54', ''),                 // 92235551234
        telefono.replace('+549', '0'),               // 02235551234
      ];

      for (const formato of formatos) {
        const q    = query(collection(db, 'clientes'), where('telefono', '==', formato));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs[0].data();
        }
      }
      return null;
    } catch (error) {
      console.error('Error buscando cliente importado:', error);
      return null;
    }
  };

  // Verificar OTP
  const verifyOTP = async (otp) => {
    if (!confirmationResult) {
      toast.error('No se encontró la confirmación. Intenta de nuevo');
      return false;
    }

    try {
      const userCredential = await confirmationResult.confirm(otp);
      const currentUser    = userCredential.user;

      const userRef  = doc(db, 'usuarios', currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // ── Cliente nuevo: buscar si está en la base importada ───────────
        const clienteImportado = await buscarClienteImportado(currentUser.phoneNumber);

        if (clienteImportado) {
          // ✅ Lo encontramos → crear usuario con sus datos ya cargados
          await setDoc(userRef, {
            uid:          currentUser.uid,
            telefono:     currentUser.phoneNumber,
            nombre:       clienteImportado.nombre    || '',
            apellido:     clienteImportado.apellido  || '',
            nombreCompleto: clienteImportado.nombreCompleto || '',
            ultimoCorte:  null,
            creadoEn:     serverTimestamp(),
            importado:    true,
          });
          setNeedsProfile(false);
          toast.success(`¡Bienvenido de vuelta, ${clienteImportado.nombre}!`);
        } else {
          // ❌ No está en la base → crear usuario vacío y pedir nombre
          await setDoc(userRef, {
            uid:      currentUser.uid,
            telefono: currentUser.phoneNumber,
            nombre:   '',
            apellido: '',
            ultimoCorte: null,
            creadoEn: serverTimestamp(),
            importado: false,
          });
          setNeedsProfile(true);
        }
      } else {
        // Ya existe → chequear si le falta nombre
        const data = userSnap.data();
        if (!data.nombre || data.nombre.trim() === '') {
          setNeedsProfile(true);
        }
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

  // ── NUEVO: guardar nombre y apellido cuando el cliente los completa ───────
  const completarPerfil = async (nombre, apellido) => {
    if (!user) return false;
    try {
      const userRef = doc(db, 'usuarios', user.uid);
      await updateDoc(userRef, {
        nombre,
        apellido,
        nombreCompleto: `${nombre} ${apellido}`.trim(),
      });
      setUserDoc((prev) => ({
        ...prev,
        nombre,
        apellido,
        nombreCompleto: `${nombre} ${apellido}`.trim(),
      }));
      setNeedsProfile(false);
      toast.success(`¡Bienvenido, ${nombre}!`);
      return true;
    } catch (error) {
      console.error('Error completando perfil:', error);
      toast.error('Error al guardar tu nombre');
      return false;
    }
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      setConfirmationResult(null);
      setVerificationId(null);
      setNeedsProfile(false);
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
    userDoc,
    loading,
    needsProfile,
    confirmationResult,
    verificationId,
    loginWithPhone,
    verifyOTP,
    completarPerfil,
    logout,
    initRecaptcha,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};
