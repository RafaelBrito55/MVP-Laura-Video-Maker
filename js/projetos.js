// js/projetos.js
const elProj = {
  tbody: document.getElementById("projetos-tbody"),
  mes: document.getElementById("projetos-mes"),
  btnRefresh: document.getElementById("btn-projetos-refresh"),
  btnOpen: document.getElementById("btn-open-projeto"),

  modal: document.getElementById("modal-projeto"),
  title: document.getElementById("projeto-modal-title"),
  msg: document.getElementById("projeto-msg"),
  btnClose: document.getElementById("btn-close-projeto"),
  btnSave: document.getElementById("btn-save-projeto"),
  btnDel: document.getElementById("btn-del-projeto"),

  cliente: document.getElementById("projeto-cliente"),
  status: document.getElementById("projeto-status"),
  titulo: document.getElementById("projeto-titulo"),
  tipo: document.getElementById("projeto-tipo"),
  data: document.getElementById("projeto-data"),
  local: document.getElementById("projeto-local"),
  valor: document.getElementById("projeto-valor"),
  obs: document.getElementById("projeto-obs"),
};

let editingProjetoId = null;

async function projetosOpenModal(projeto){
  elProj.modal.classList.remove("hidden");
  elProj.msg.textContent = "";

  await fillClientesSelect(elProj.cliente);

  if(projeto){
    editingProjetoId = projeto.id;
    elProj.title.textContent = "Editar projeto";
    elProj.btnDel.classList.remove("hidden");

    const d = projeto.data;
    elProj.cliente.value = d.clienteId || "";
    elProj.status.value = d.status || "agendado";
    elProj.titulo.value = d.titulo || "";
    elProj.tipo.value = d.tipo || "outro";
    elProj.data.value = utils.isoToBR(d.dataEventoISO || "");
    elProj.local.value = d.local || "";
    elProj.valor.value = (d.valorFechado || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    elProj.obs.value = d.observacoes || "";
  }else{
    editingProjetoId = null;
    elProj.title.textContent = "Novo projeto";
    elProj.btnDel.classList.add("hidden");

    elProj.status.value = "agendado";
    elProj.titulo.value = "";
    elProj.tipo.value = "aniversario";
    elProj.data.value = "";
    elProj.local.value = "";
    elProj.valor.value = "";
    elProj.obs.value = "";
  }
}

function projetosCloseModal(){ elProj.modal.classList.add("hidden"); }
function setProjMsg(t){ elProj.msg.textContent = t || ""; }

async function projetosSave(){
  setProjMsg("");
  const titulo = elProj.titulo.value.trim();
  const clienteId = elProj.cliente.value;
  if(!clienteId) return setProjMsg("Selecione um cliente.");
  if(!titulo) return setProjMsg("Informe um título.");

  const dataISO = utils.brToISO(elProj.data.value.trim());
  if(elProj.data.value.trim() && !dataISO){
    return setProjMsg("Data do evento inválida. Use dd/mm/aaaa.");
  }
  if(!dataISO) return setProjMsg("Informe a data do evento.");

  const valor = utils.parseBRL(elProj.valor.value);

  const data = {
    clienteId,
    titulo,
    tipo: elProj.tipo.value,
    status: elProj.status.value,
    dataEventoISO: dataISO,
    local: elProj.local.value.trim(),
    valorFechado: valor,
    observacoes: elProj.obs.value.trim(),
    updatedAt: fb.serverTimestamp(),
  };

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("projetos");
  try{
    if(editingProjetoId){
      await col.doc(editingProjetoId).update(data);
    }else{
      await col.add({ ...data, createdAt: fb.serverTimestamp() });
    }

    projetosCloseModal();
    await projetosRefresh();
    await refreshSelectorsClientsAndProjects();
  }catch(err){
    setProjMsg(err?.message || "Erro ao salvar.");
  }
}

async function projetosDelete(){
  if(!editingProjetoId) return;
  if(!confirm("Excluir este projeto?")) return;
  const col = fb.db.collection("empresas").doc(state.empresaId).collection("projetos");
  await col.doc(editingProjetoId).delete();
  projetosCloseModal();
  await projetosRefresh();
  await refreshSelectorsClientsAndProjects();
}

async function projetosRefresh(){
  const monthKey = elProj.mes.value.trim() || defaultMonthKey();
  elProj.mes.value = monthKey;
  const range = utils.monthKeyToRange(monthKey);
  if(!range) return;

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("projetos");
  const snap = await col
    .where("dataEventoISO", ">=", range.startISO)
    .where("dataEventoISO", "<", range.endISOExclusive)
    .orderBy("dataEventoISO")
    .get();

  const clientMap = await getClientMap();

  elProj.tbody.innerHTML = "";
  snap.forEach(doc=>{
    const d = doc.data();
    const clienteNome = clientMap[d.clienteId] || "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${utils.isoToBR(d.dataEventoISO)}</td>
      <td>${utils.escapeHtml(d.titulo)}</td>
      <td>${utils.escapeHtml(d.tipo)}</td>
      <td>${utils.escapeHtml(d.status)}</td>
      <td>${utils.escapeHtml(clienteNome)}</td>
      <td>${utils.formatBRL(d.valorFechado || 0)}</td>
      <td><span class="link" data-action="edit" data-id="${doc.id}">Editar</span></td>
    `;
    elProj.tbody.appendChild(tr);
  });

  if(snap.empty){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" class="muted">Nenhum projeto neste mês.</td>`;
    elProj.tbody.appendChild(tr);
  }

  elProj.tbody.querySelectorAll("[data-action='edit']").forEach(el=>{
    el.addEventListener("click", async ()=>{
      const id = el.dataset.id;
      const doc = await col.doc(id).get();
      projetosOpenModal({ id, data: doc.data() });
    });
  });
}

// Eventos
elProj.btnOpen.addEventListener("click", ()=> projetosOpenModal(null));
elProj.btnClose.addEventListener("click", projetosCloseModal);
elProj.btnSave.addEventListener("click", projetosSave);
elProj.btnDel.addEventListener("click", projetosDelete);
elProj.btnRefresh.addEventListener("click", projetosRefresh);

window.projetosRefresh = projetosRefresh;
window.projetosOpenModal = projetosOpenModal;
