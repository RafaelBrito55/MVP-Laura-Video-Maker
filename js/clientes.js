// js/clientes.js
const elClientes = {
  tbody: document.getElementById("clientes-tbody"),
  filtro: document.getElementById("clientes-filtro"),
  busca: document.getElementById("clientes-busca"),
  btnRefresh: document.getElementById("btn-clientes-refresh"),
  btnOpen: document.getElementById("btn-open-cliente"),
  modal: document.getElementById("modal-cliente"),
  title: document.getElementById("cliente-modal-title"),
  msg: document.getElementById("cliente-msg"),
  btnClose: document.getElementById("btn-close-cliente"),
  btnSave: document.getElementById("btn-save-cliente"),
  btnDel: document.getElementById("btn-del-cliente"),

  tipo: document.getElementById("cliente-tipo"),
  status: document.getElementById("cliente-status"),
  nome: document.getElementById("cliente-nome"),
  telefone: document.getElementById("cliente-telefone"),
  instagram: document.getElementById("cliente-instagram"),
  email: document.getElementById("cliente-email"),
  origem: document.getElementById("cliente-origem"),
  tags: document.getElementById("cliente-tags"),
  proxTitulo: document.getElementById("cliente-prox-titulo"),
  proxData: document.getElementById("cliente-prox-data"),
  obs: document.getElementById("cliente-obs"),
};

let editingClienteId = null;

function clientesOpenModal(cliente){
  elClientes.modal.classList.remove("hidden");
  elClientes.msg.textContent = "";

  if(cliente){
    editingClienteId = cliente.id;
    elClientes.title.textContent = "Editar cliente/lead";
    elClientes.btnDel.classList.remove("hidden");

    const d = cliente.data;
    elClientes.tipo.value = d.tipo || "lead";
    elClientes.status.value = d.status || "novo";
    elClientes.nome.value = d.nome || "";
    elClientes.telefone.value = d.telefone || "";
    elClientes.instagram.value = d.instagram || "";
    elClientes.email.value = d.email || "";
    elClientes.origem.value = d.origem || "";
    elClientes.tags.value = (d.tags || []).join(", ");
    elClientes.proxTitulo.value = d.proximaAcaoTitulo || "";
    elClientes.proxData.value = utils.isoToBR(d.proximaAcaoDataISO || "");
    elClientes.obs.value = d.observacoes || "";
  }else{
    editingClienteId = null;
    elClientes.title.textContent = "Novo cliente/lead";
    elClientes.btnDel.classList.add("hidden");

    elClientes.tipo.value = "lead";
    elClientes.status.value = "novo";
    elClientes.nome.value = "";
    elClientes.telefone.value = "";
    elClientes.instagram.value = "";
    elClientes.email.value = "";
    elClientes.origem.value = "";
    elClientes.tags.value = "";
    elClientes.proxTitulo.value = "";
    elClientes.proxData.value = "";
    elClientes.obs.value = "";
  }
}

function clientesCloseModal(){
  elClientes.modal.classList.add("hidden");
}

function setClientesMsg(t){ elClientes.msg.textContent = t || ""; }

async function clientesSave(){
  setClientesMsg("");
  const nome = elClientes.nome.value.trim();
  if(!nome) return setClientesMsg("Informe o nome.");

  const proxISO = utils.brToISO(elClientes.proxData.value.trim());
  if(elClientes.proxData.value.trim() && !proxISO){
    return setClientesMsg("Data da próxima ação inválida. Use dd/mm/aaaa.");
  }

  const data = {
    tipo: elClientes.tipo.value,
    status: elClientes.status.value,
    nome,
    telefone: elClientes.telefone.value.trim(),
    instagram: elClientes.instagram.value.trim(),
    email: elClientes.email.value.trim(),
    origem: elClientes.origem.value.trim(),
    tags: elClientes.tags.value.split(",").map(s=>s.trim()).filter(Boolean),
    proximaAcaoTitulo: elClientes.proxTitulo.value.trim(),
    proximaAcaoDataISO: proxISO || "",
    proximaAcaoObs: "",
    observacoes: elClientes.obs.value.trim(),
    updatedAt: fb.serverTimestamp(),
  };

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("clientes");
  try{
    if(editingClienteId){
      await col.doc(editingClienteId).update(data);
    }else{
      await col.add({ ...data, createdAt: fb.serverTimestamp() });
    }

    // se tiver próxima ação, cria/atualiza notificação automática (follow-up)
    await notifUpsertForCliente(editingClienteId ? editingClienteId : null, data);

    clientesCloseModal();
    await clientesRefresh();
    await refreshSelectorsClientsAndProjects(); // atualiza selects de projetos/financeiro
  }catch(err){
    setClientesMsg(err?.message || "Erro ao salvar.");
  }
}

async function clientesDelete(){
  if(!editingClienteId) return;
  if(!confirm("Excluir este cliente/lead?")) return;
  const col = fb.db.collection("empresas").doc(state.empresaId).collection("clientes");
  await col.doc(editingClienteId).delete();
  clientesCloseModal();
  await clientesRefresh();
  await refreshSelectorsClientsAndProjects();
}

async function clientesRefresh(){
  const filtro = elClientes.filtro.value;
  const busca = elClientes.busca.value.trim().toLowerCase();

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("clientes");
  let q = col.orderBy("nome");
  const snap = await q.get();

  let rows = [];
  snap.forEach(doc=>{
    const d = doc.data();
    const id = doc.id;

    const matchBusca = !busca || (d.nome || "").toLowerCase().includes(busca);

    let matchFiltro = true;
    if(filtro === "lead" || filtro === "cliente") matchFiltro = d.tipo === filtro;
    else if(filtro !== "todos") matchFiltro = d.status === filtro;

    if(matchBusca && matchFiltro){
      rows.push({ id, d });
    }
  });

  elClientes.tbody.innerHTML = "";
  for(const r of rows){
    const prox = r.d.proximaAcaoDataISO ? `${utils.isoToBR(r.d.proximaAcaoDataISO)} • ${utils.escapeHtml(r.d.proximaAcaoTitulo || "")}` : "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${utils.escapeHtml(r.d.nome || "")}</td>
      <td>${utils.escapeHtml(r.d.tipo || "")}</td>
      <td>${utils.escapeHtml(r.d.status || "")}</td>
      <td>${prox}</td>
      <td>
        <div class="actions">
          <span class="link" data-action="edit" data-id="${r.id}">Editar</span>
        </div>
      </td>
    `;
    elClientes.tbody.appendChild(tr);
  }

  if(rows.length === 0){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="muted">Nenhum registro.</td>`;
    elClientes.tbody.appendChild(tr);
  }

  elClientes.tbody.querySelectorAll("[data-action='edit']").forEach(el=>{
    el.addEventListener("click", async ()=>{
      const id = el.dataset.id;
      const doc = await col.doc(id).get();
      clientesOpenModal({ id, data: doc.data() });
    });
  });
}

// Notificação automática a partir da próxima ação do cliente
async function notifUpsertForCliente(clienteIdMaybeNull, clienteData){
  const clienteId = clienteIdMaybeNull || null;
  // Se for novo cliente, ainda não temos ID aqui. Então pulamos. (o usuário pode criar manual)
  if(!clienteId) return;

  const dueISO = clienteData.proximaAcaoDataISO || "";
  const titulo = clienteData.proximaAcaoTitulo || "";
  if(!dueISO || !titulo) return;

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("notificacoes");
  const key = `cliente:${clienteId}:${dueISO}`;

  // procura notificação pela chave
  const snap = await col.where("key", "==", key).limit(1).get();
  if(!snap.empty){
    const doc = snap.docs[0];
    await col.doc(doc.id).update({
      titulo: titulo,
      descricao: `Follow-up: ${clienteData.nome}`,
      tipo: "followup",
      refTipo: "cliente",
      refId: clienteId,
      dueDateISO: dueISO,
      prioridade: "media",
      status: "aberta",
      updatedAt: fb.serverTimestamp(),
    });
    return;
  }

  await col.add({
    key,
    titulo: titulo,
    descricao: `Follow-up: ${clienteData.nome}`,
    tipo: "followup",
    refTipo: "cliente",
    refId: clienteId,
    dueDateISO: dueISO,
    prioridade: "media",
    status: "aberta",
    createdAt: fb.serverTimestamp(),
    updatedAt: fb.serverTimestamp(),
  });
}

// Eventos
elClientes.btnOpen.addEventListener("click", ()=> clientesOpenModal(null));
elClientes.btnClose.addEventListener("click", clientesCloseModal);
elClientes.btnSave.addEventListener("click", clientesSave);
elClientes.btnDel.addEventListener("click", clientesDelete);
elClientes.btnRefresh.addEventListener("click", clientesRefresh);

window.clientesRefresh = clientesRefresh;
