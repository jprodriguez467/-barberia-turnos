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
    console.log('Inicializando reCAPTCHA...');
    try {
      if (window.recaptchaVerifier) {
        console.log('Limpiando reCAPTCHA existente');
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
      console.log('Creando nuevo RecaptchaVerifier');
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
      console.log('RecaptchaVerifier creado exitosamente');
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

      console.log('Llamando a signInWithPhoneNumber con', formattedPhone);
      const result = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        window.recaptchaVerifier
      );
      console.log('signInWithPhoneNumber completado');

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
  const verifyOTP = async (otp, onSuccess) => {
    console.log('Iniciando verificación de OTP');
    if (!confirmationResult) {
      console.log('No hay confirmationResult');
      toast.error('No se encontró la confirmación. Intenta de nuevo');
      return false;
    }

    try {
      console.log('Confirmando OTP...');
      const userCredential = await confirmationResult.confirm(otp);
      const currentUser = userCredential.user;
      console.log('OTP confirmado, usuario:', currentUser.uid);

      // Crear o actualizar documento de usuario en Firestore
      console.log('Buscando documento de usuario en Firestore...');
      const userRef = doc(db, 'usuarios', currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.log('Creando nuevo documento de usuario');
        // Crear nuevo documento de usuario
        await setDoc(userRef, {
          uid: currentUser.uid,
          telefono: currentUser.phoneNumber,
          nombre: '',
          creadoEn: serverTimestamp(),
          ultimoTurno: null,
        });
      } else {
        console.log('Documento de usuario ya existe');
      }

      setConfirmationResult(null);
      toast.success('¡Sesión iniciada correctamente!');
      console.log('Llamando onSuccess callback');
      if (onSuccess) onSuccess();
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
    initializeRecaptcha,
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
