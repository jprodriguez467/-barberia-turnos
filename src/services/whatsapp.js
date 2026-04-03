import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

export const cancelarTurnoWhatsApp = async (turnoId) => {
  const cancelarTurno = httpsCallable(functions, 'cancelarTurno');
  const result = await cancelarTurno({ turnoId });
  return result.data;
};

export const enviarRecordatorioManual = async () => {
  const recordatorios = httpsCallable(functions, 'recordatorios');
  const result = await recordatorios();
  return result.data;
};
