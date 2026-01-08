// js/firebase.js
// Firebase (Compat CDN) - Config do projeto laura-gestao-mvp

const firebaseConfig = {
  apiKey: "AIzaSyDLgsmb7GixG_1sE0kwmdXslunLjfeS_b4",
  authDomain: "laura-gestao-mvp.firebaseapp.com",
  projectId: "laura-gestao-mvp",
  storageBucket: "laura-gestao-mvp.firebasestorage.app",
  messagingSenderId: "173575755964",
  appId: "1:173575755964:web:e334440768ad0c17f5d8b9",
};

// Init (evita erro se recarregar e já estiver inicializado)
if (!firebase.apps || !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Helpers Firebase
const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;

window.fb = { auth, db, serverTimestamp };
