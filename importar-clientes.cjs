// ─────────────────────────────────────────────────────────────────────────────
// SCRIPT DE IMPORTACIÓN — Clientes AgendaPro → Firebase Firestore
// Ejecutar UNA SOLA VEZ desde la carpeta del proyecto:
//   node importar-clientes.js
// ─────────────────────────────────────────────────────────────────────────────

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, where } = require('firebase/firestore');
const clientes = require('./clientes_firebase.json');

// ── Pegá acá tu config de Firebase (la misma que en src/services/firebase.js) ─
const firebaseConfig = {
  apiKey:            "AIzaSyDoQqA-hSkX-JtrKnuXGIG0SLAwxMYDaVc",
  authDomain:        "barberia-turnos-925a7.firebaseapp.com",
  projectId:         "barberia-turnos-925a7",
  storageBucket:     "barberia-turnos-925a7.firebasestorage.app",
  messagingSenderId: "754355962489",
  appId:             "1:754355962489:web:ed5b59eb42d5273f740aa8",
};
// ─────────────────────────────────────────────────────────────────────────────

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);

async function importar() {
  console.log(`\n🚀 Importando ${clientes.length} clientes a Firestore...\n`);

  let importados = 0;
  let duplicados = 0;
  let errores    = 0;

  for (const cliente of clientes) {
    try {
      // Evitar duplicados por teléfono (si ya existe, lo saltea)
      if (cliente.telefono) {
        const q = query(
          collection(db, 'clientes'),
          where('telefono', '==', cliente.telefono)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          duplicados++;
          continue;
        }
      }

      await addDoc(collection(db, 'clientes'), {
        ...cliente,
        ultimoCorte: null,
        importado: true,
        creadoEn: new Date(),
      });

      importados++;
      if (importados % 50 === 0) {
        console.log(`  ✅ ${importados} importados...`);
      }
    } catch (err) {
      errores++;
      console.error(`  ❌ Error con ${cliente.nombreCompleto}:`, err.message);
    }
  }

  console.log('\n──────────────────────────────────');
  console.log(`✅ Importados:  ${importados}`);
  console.log(`⏭️  Duplicados:  ${duplicados}`);
  console.log(`❌ Errores:     ${errores}`);
  console.log('──────────────────────────────────\n');
  console.log('¡Listo! Los clientes ya están en Firestore → colección "clientes"');
  process.exit(0);
}

importar().catch(console.error);
