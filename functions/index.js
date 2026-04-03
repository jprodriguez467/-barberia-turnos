const functions = require('firebase-functions');
const admin = require('firebase-admin');
const twilio = require('twilio');

admin.initializeApp();
const db = admin.firestore();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
const client = twilio(accountSid, authToken);

const sendWhatsApp = async (to, body) => {
  if (!accountSid || !authToken) {
    console.warn('TWILIO no configurado correctamente, no se envía mensaje.');
    return;
  }

  const toPhone = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  try {
    await client.messages.create({
      from: whatsappFrom,
      to: toPhone,
      body,
    });
  } catch (error) {
    console.error('Error enviando WhatsApp', error);
    throw error;
  }
};

exports.onTurnoCreado = functions.firestore
  .document('turnos/{turnoId}')
  .onCreate(async (snap, context) => {
    const turno = snap.data();
    if (!turno || turno.estado !== 'confirmado') return null;

    const { telefono, fecha, hora, servicio, profesional, precioFinal } = turno;

    const body = `✂️ *Salón de los Dioses*\n¡Tu turno está confirmado!\n\n📅 Fecha: ${fecha}\n⏰ Hora: ${hora}\n💇 Servicio: ${servicio}\n👨 Profesional: ${profesional}\n💰 Precio: $${precioFinal}\n\nPara cancelar respondé *CANCELAR*`;

    try {
      await sendWhatsApp(telefono, body);
      return null;
    } catch (error) {
      console.error('Error en onTurnoCreado:', error);
      return null;
    }
  });

exports.recordatorios = functions.pubsub.schedule('every 30 minutes').onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  const nowMs = now.toMillis();

  // 24h
  const min24 = admin.firestore.Timestamp.fromMillis(nowMs + 23 * 60 * 60 * 1000);
  const max24 = admin.firestore.Timestamp.fromMillis(nowMs + 25 * 60 * 60 * 1000);

  // 1h
  const min1 = admin.firestore.Timestamp.fromMillis(nowMs + 50 * 60 * 1000);
  const max1 = admin.firestore.Timestamp.fromMillis(nowMs + 70 * 60 * 1000);

  const turnosRef = db.collection('turnos');
  const querySnapshot = await turnosRef
    .where('estado', '==', 'confirmado')
    .where('recordatorio24h', '==', false)
    .where('fechaHoraTS', '>=', min24)
    .where('fechaHoraTS', '<=', max24)
    .get();

  const promises = [];

  querySnapshot.forEach((docSnap) => {
    const turno = docSnap.data();
    const msg = `⏰ *Recordatorio - Salón de los Dioses*\nMañana tenés turno a las ${turno.hora} con ${turno.profesional} para ${turno.servicio}. ¡Te esperamos!`;

    promises.push(
      sendWhatsApp(turno.telefono, msg)
        .then(() => docSnap.ref.update({ recordatorio24h: true }))
        .catch((error) => console.error('Error recordatorio24h:', error))
    );
  });

  const querySnapshot1h = await turnosRef
    .where('estado', '==', 'confirmado')
    .where('recordatorio1h', '==', false)
    .where('fechaHoraTS', '>=', min1)
    .where('fechaHoraTS', '<=', max1)
    .get();

  querySnapshot1h.forEach((docSnap) => {
    const turno = docSnap.data();
    const msg = `🔔 *¡En 1 hora!* - Salón de los Dioses\nTu turno es a las ${turno.hora} con ${turno.profesional}. ¡Nos vemos pronto!`;

    promises.push(
      sendWhatsApp(turno.telefono, msg)
        .then(() => docSnap.ref.update({ recordatorio1h: true }))
        .catch((error) => console.error('Error recordatorio1h:', error))
    );
  });

  await Promise.all(promises);
  return null;
});

exports.cancelarTurno = functions.https.onCall(async (data, context) => {
  const { turnoId } = data;

  if (!turnoId) {
    throw new functions.https.HttpsError('invalid-argument', 'turnoId es requerido');
  }

  const turnoRef = db.collection('turnos').doc(turnoId);
  const turnoSnap = await turnoRef.get();

  if (!turnoSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Turno no existe');
  }

  const turno = turnoSnap.data();

  await turnoRef.update({ estado: 'cancelado' });

  const message = `❌ *Salón de los Dioses*\nTu turno del ${turno.fecha} a las ${turno.hora} fue cancelado correctamente.`;
  await sendWhatsApp(turno.telefono, message);

  return { success: true };
});
