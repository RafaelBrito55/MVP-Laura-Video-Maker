// js/app.js
const views = {
  dashboard: document.getElementById("view-dashboard"),
  clientes: document.getElementById("view-clientes"),
  projetos: document.getElementById("view-projetos"),
  financeiro: document.getElementById("view-financeiro"),
  notificacoes: document.getElementById("view-notificacoes"),
};

function setActiveView(name){
  // sidebar active
  document.querySelectorAll(".nav-item").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.view === name);
  });

  Object.entries(views).forEach(([k, el])=>{
    el.classList.toggle("hidden", k !== name);
  });
}

document.querySelectorAll(".nav-item").forEach(btn=>{
  btn.addEventListener("click", async ()=>{
    const name = btn.dataset.view;
    setActiveView(name);

    if(name === "dashboard") await dashboardRefresh();
    if(name === "clientes") await clientesRefresh();
    if(name === "projetos") await projetosRefresh();
    if(name === "financeiro") await financeiroRefresh();
    if(name === "notificacoes") await notificacoesRefresh();
  });
});

async function appInitAfterLogin(){
  // Defaults
  document.getElementById("dash-mes").value = defaultMonthKey();
  document.getElementById("projetos-mes").value = defaultMonthKey();
  document.getElementById("fin-mes").value = defaultMonthKey();

  // Bind refresh buttons
  document.getElementById("btn-dash-refresh").addEventListener("click", dashboardRefresh);

  // Inicial
  setActiveView("dashboard");
  await refreshSelectorsClientsAndProjects();
  await dashboardRefresh();
}

async function refreshSelectorsClientsAndProjects(){
  // Preenche selects usados em Projetos e Financeiro
  await fillClientesSelect(document.getElementById("projeto-cliente"));
  await fillClientesSelect(document.getElementById("lan-cliente"), true);
  await fillProjetosSelect(document.getElementById("lan-projeto"), true);
}

async function getClientMap(){
  const col = fb.db.collection("empresas").doc(state.empresaId).collection("clientes");
  const snap = await col.orderBy("nome").get();
  const map = {};
  snap.forEach(doc=>{ map[doc.id] = doc.data().nome || ""; });
  return map;
}

async function fillClientesSelect(selectEl, allowEmpty){
  const col = fb.db.collection("empresas").doc(state.empresaId).collection("clientes");
  const snap = await col.orderBy("nome").get();
  selectEl.innerHTML = "";

  if(allowEmpty){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "—";
    selectEl.appendChild(opt);
  }

  snap.forEach(doc=>{
    const d = doc.data();
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = d.nome || "(sem nome)";
    selectEl.appendChild(opt);
  });

  if(!allowEmpty && snap.empty){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Cadastre um cliente primeiro";
    selectEl.appendChild(opt);
  }
}

async function fillProjetosSelect(selectEl, allowEmpty){
  const col = fb.db.collection("empresas").doc(state.empresaId).collection("projetos");
  const snap = await col.orderBy("dataEventoISO", "desc").limit(50).get();
  selectEl.innerHTML = "";

  if(allowEmpty){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "—";
    selectEl.appendChild(opt);
  }

  snap.forEach(doc=>{
    const d = doc.data();
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = `${utils.isoToBR(d.dataEventoISO)} • ${d.titulo || ""}`.trim();
    selectEl.appendChild(opt);
  });
}

window.appInitAfterLogin = appInitAfterLogin;
window.refreshSelectorsClientsAndProjects = refreshSelectorsClientsAndProjects;
window.getClientMap = getClientMap;
window.fillClientesSelect = fillClientesSelect;
window.fillProjetosSelect = fillProjetosSelect;
