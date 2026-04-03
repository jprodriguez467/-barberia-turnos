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
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [verificationId, setVerificationId] = useState(null);
  const [userDoc, setUserDoc] = useState(null);

  // Escuchar cambios de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Obtener datos del usuario desde Firestore
        try {
          const userRef = doc(db, 'usuarios', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserDoc(userSnap.data());
          }
        } catch (error) {
          console.error('Error obteniendo datos del usuario:', error);
        }
      } else {
        setUser(null);
        setUserDoc(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Inicializar RecaptchaVerifier invisible
  const initializeRecaptcha = () => {
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          'send-code-button',
          {
            size: 'invisible',
            callback: (response) => {
              console.log('reCAPTCHA resuelto', response);
            },
            'expired-callback': () => {
              console.log('reCAPTCHA expiró');
              window.recaptchaVerifier = null;
            },
          }
        );
      }
    } catch (error) {
      console.error('Error inicializando reCAPTCHA:', error);
    }
  };

  // Login con teléfono
  const loginWithPhone = async (phoneNumber) => {
    try {
      // Asegurar que el número tenga el formato correcto
      const formattedPhone = phoneNumber.startsWith('+')
        ? phoneNumber
        : `+${phoneNumber}`;

      initializeRecaptcha();

      const result = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        window.recaptchaVerifier
      );

      setConfirmationResult(result);
      setVerificationId(result.verificationId);
      toast.success('Código enviado por WhatsApp');
      return true;
    } catch (error) {
      console.error('Error al iniciar sesión con teléfono:', error);
      toast.error(`Error al enviar el código: ${error.code} - ${error.message}`);
      window.recaptchaVerifier = null;
      return false;
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
      const currentUser = userCredential.user;

      // Crear o actualizar documento de usuario en Firestore
      const userRef = doc(db, 'usuarios', currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Crear nuevo documento de usuario
        await setDoc(userRef, {
          uid: currentUser.uid,
          telefono: currentUser.phoneNumber,
          nombre: '',
          creadoEn: serverTimestamp(),
          ultimoTurno: null,
        });
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

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      setConfirmationResult(null);
      setVerificationId(null);
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
    confirmationResult,
    verificationId,
    loginWithPhone,
    verifyOTP,
    logout,
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
