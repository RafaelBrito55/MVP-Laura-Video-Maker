// js/auth.js
const elAuth = {
  viewAuth: document.getElementById("view-auth"),
  viewApp: document.getElementById("view-app"),
  email: document.getElementById("auth-email"),
  pass: document.getElementById("auth-pass"),
  msg: document.getElementById("auth-msg"),
  btnLogin: document.getElementById("btn-login"),
  btnRegister: document.getElementById("btn-register"),
  btnLogout: document.getElementById("btn-logout"),
};

function setAuthMsg(text){
  elAuth.msg.textContent = text || "";
}

async function loginEmail(){
  setAuthMsg("");
  const email = elAuth.email.value.trim();
  const pass = elAuth.pass.value;
  if(!email || !pass) return setAuthMsg("Preencha e-mail e senha.");
  try{
    await fb.auth.signInWithEmailAndPassword(email, pass);
  }catch(err){
    setAuthMsg(err?.message || "Erro ao entrar.");
  }
}

async function registerEmail(){
  setAuthMsg("");
  const email = elAuth.email.value.trim();
  const pass = elAuth.pass.value;
  if(!email || !pass) return setAuthMsg("Preencha e-mail e senha.");
  if(pass.length < 6) return setAuthMsg("A senha precisa ter pelo menos 6 caracteres.");
  try{
    await fb.auth.createUserWithEmailAndPassword(email, pass);
  }catch(err){
    setAuthMsg(err?.message || "Erro ao criar conta.");
  }
}

async function logout(){
  await fb.auth.signOut();
}

function showAuth(){
  elAuth.viewAuth.classList.remove("hidden");
  elAuth.viewApp.classList.add("hidden");
  document.getElementById("empresa-nome").textContent = "—";
}

function showApp(){
  elAuth.viewAuth.classList.add("hidden");
  elAuth.viewApp.classList.remove("hidden");
}

elAuth.btnLogin.addEventListener("click", loginEmail);
elAuth.btnRegister.addEventListener("click", registerEmail);
elAuth.btnLogout.addEventListener("click", logout);

fb.auth.onAuthStateChanged(async (user)=>{
  window.state.user = user || null;

  if(!user){
    showAuth();
    return;
  }

  // Com usuário logado: resolve empresa (multi-tenant)
  const ok = await tenantResolveOrPrompt();
  if(!ok){
    // Se não tiver empresa e não criar, volta pro auth (ou mantém no modal)
    showAuth();
    return;
  }

  showApp();

  // Inicializa o app
  await appInitAfterLogin();
});
