// js/clientes.js
// Patch focado em 2 coisas:
// 1) Corrigir o "Salvar" mesmo quando o HTML está com IDs diferentes (ou incompletos)
// 2) Garantir que campos extras (Telefone / Instagram / E-mail) existam no modal (injeta se estiverem faltando)

// Helper: pega o primeiro elemento existente por id
function byId(...ids){
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function findButtonByText(rootEl, acceptedTextsLower){
  if (!rootEl) return null;
  const btns = Array.from(rootEl.querySelectorAll("button"));
  for (const b of btns) {
    const t = (b.textContent || "").trim().toLowerCase();
    if (acceptedTextsLower.includes(t)) return b;
  }
  return null;
}

function ensureClienteExtraFields(modalEl){
  if (!modalEl) return;

  // container do form (pode variar entre versões)
  const grid = modalEl.querySelector(".form-grid-2") || modalEl.querySelector(".form-grid") || modalEl;

  // onde inserir: depois do campo Nome (se existir)
  const nomeInput = byId("cliente-nome", "cliente_nome", "nome-cliente");
  const nomeLabel = nomeInput ? nomeInput.closest("label") : null;

  function mkLabel(text, inputId, type, placeholder){
    const label = document.createElement("label");
    const span = document.createElement("span");
    span.textContent = text;
    const input = document.createElement("input");
    input.id = inputId;
    input.type = type;
    input.placeholder = placeholder;
    label.appendChild(span);
    label.appendChild(input);
    return label;
  }

  const needTelefone = !byId("cliente-telefone", "cliente-telefone-whats", "cliente-fone", "cliente-telefone1");
  const needInsta = !byId("cliente-instagram", "cliente-insta", "cliente-inst", "cliente-instagram1");
  const needEmail = !byId("cliente-email", "cliente-e-mail", "cliente_mail", "cliente-email1");

  if (!needTelefone && !needInsta && !needEmail) return;

  const frag = document.createDocumentFragment();
  if (needTelefone) frag.appendChild(mkLabel("Telefone/WhatsApp", "cliente-telefone", "text", "(65) 9xxxx-xxxx"));
  if (needInsta) frag.appendChild(mkLabel("Instagram", "cliente-instagram", "text", "@usuario"));
  if (needEmail) frag.appendChild(mkLabel("E-mail", "cliente-email", "email", "email@exemplo.com"));

  if (nomeLabel && nomeLabel.parentNode) {
    // insere logo depois do label do Nome
    nomeLabel.parentNode.insertBefore(frag, nomeLabel.nextSibling);
  } else {
    // fallback: adiciona no fim da grade
    grid.appendChild(frag);
  }
}

const elClientes = {
  tbody: byId("clientes-tbody"),
  filtro: byId("clientes-filtro"),
  busca: byId("clientes-busca"),
  btnRefresh: byId("btn-clientes-refresh"),
  btnOpen: byId("btn-open-cliente", "btn-open-client", "btn-cliente-open"),

  modal: byId("modal-cliente", "modal-clientes", "modal-cliente-lead"),
  title: byId("cliente-modal-title", "modal-cliente-title"),
  msg: byId("cliente-msg", "cliente-message"),

  btnClose: byId("btn-close-cliente", "btn-cliente-close"),
  btnSave: byId("btn-save-cliente", "btn-cliente-save"),
  btnDel: byId("btn-del-cliente", "btn-cliente-del", "btn-delete-cliente"),

  tipo: byId("cliente-tipo", "cliente_tipo"),
  status: byId("cliente-status", "cliente_status"),
  nome: byId("cliente-nome", "cliente_nome"),

  telefone: byId("cliente-telefone", "cliente-telefone-whats", "cliente-fone"),
  instagram: byId("cliente-instagram", "cliente-insta", "cliente-inst"),
  email: byId("cliente-email", "cliente-e-mail", "cliente_mail"),

  origem: byId("cliente-origem", "cliente-origem-lead"),
  tags: byId("cliente-tags", "cliente_tags"),
  proxTitulo: byId("cliente-prox-titulo", "cliente-proxacao-titulo", "cliente-prox-titulo-acao"),
  proxData: byId("cliente-prox-data", "cliente-proxacao", "cliente-prox-data-acao", "cliente-prox"),
  obs: byId("cliente-obs", "cliente-notas", "cliente-observacoes"),
};

// Se o HTML veio "enxuto" e faltando campos extras, injeta sem mexer no restante do layout
ensureClienteExtraFields(elClientes.modal);

// Re-resolve refs após injeção (se houver)
elClientes.telefone = byId("cliente-telefone", "cliente-telefone-whats", "cliente-fone");
elClientes.instagram = byId("cliente-instagram", "cliente-insta", "cliente-inst");
elClientes.email = byId("cliente-email", "cliente-e-mail", "cliente_mail");

// Se IDs de botões mudaram (sem id), tenta achar por texto dentro do modal
if (!elClientes.btnSave) elClientes.btnSave = findButtonByText(elClientes.modal, ["salvar"]);
if (!elClientes.btnClose) elClientes.btnClose = findButtonByText(elClientes.modal, ["fechar", "cancelar"]);

let editingClienteId = null;

function clientesOpenModal(cliente){
  if (!elClientes.modal) return;
  elClientes.modal.classList.remove("hidden");
  if (elClientes.msg) elClientes.msg.textContent = "";

  // garante campos extras sempre
  ensureClienteExtraFields(elClientes.modal);
  elClientes.telefone = byId("cliente-telefone", "cliente-telefone-whats", "cliente-fone");
  elClientes.instagram = byId("cliente-instagram", "cliente-insta", "cliente-inst");
  elClientes.email = byId("cliente-email", "cliente-e-mail", "cliente_mail");

  if(cliente){
    editingClienteId = cliente.id;
    if (elClientes.title) elClientes.title.textContent = "Editar cliente/lead";
    if (elClientes.btnDel) elClientes.btnDel.classList.remove("hidden");

    const d = cliente.data || {};
    if (elClientes.tipo) elClientes.tipo.value = d.tipo || "lead";
    if (elClientes.status) elClientes.status.value = d.status || "novo";
    if (elClientes.nome) elClientes.nome.value = d.nome || "";
    if (elClientes.telefone) elClientes.telefone.value = d.telefone || "";
    if (elClientes.instagram) elClientes.instagram.value = d.instagram || "";
    if (elClientes.email) elClientes.email.value = d.email || "";
    if (elClientes.origem) elClientes.origem.value = d.origem || "";
    if (elClientes.tags) elClientes.tags.value = (d.tags || []).join(", ");
    if (elClientes.proxTitulo) elClientes.proxTitulo.value = d.proximaAcaoTitulo || "";
    if (elClientes.proxData) elClientes.proxData.value = utils.isoToBR(d.proximaAcaoDataISO || "");
    if (elClientes.obs) elClientes.obs.value = d.observacoes || "";
  }else{
    editingClienteId = null;
    if (elClientes.title) elClientes.title.textContent = "Novo cliente/lead";
    if (elClientes.btnDel) elClientes.btnDel.classList.add("hidden");

    if (elClientes.tipo) elClientes.tipo.value = "lead";
    if (elClientes.status) elClientes.status.value = "novo";
    if (elClientes.nome) elClientes.nome.value = "";
    if (elClientes.telefone) elClientes.telefone.value = "";
    if (elClientes.instagram) elClientes.instagram.value = "";
    if (elClientes.email) elClientes.email.value = "";
    if (elClientes.origem) elClientes.origem.value = "";
    if (elClientes.tags) elClientes.tags.value = "";
    if (elClientes.proxTitulo) elClientes.proxTitulo.value = "";
    if (elClientes.proxData) elClientes.proxData.value = "";
    if (elClientes.obs) elClientes.obs.value = "";
  }
}

function clientesCloseModal(){
  if (!elClientes.modal) return;
  elClientes.modal.classList.add("hidden");
}

function setClientesMsg(t){ if (elClientes.msg) elClientes.msg.textContent = t || ""; }

async function clientesSave(){
  setClientesMsg("");

  const nome = (elClientes.nome?.value || "").trim();
  if(!nome) return setClientesMsg("Informe o nome.");

  const proxRaw = (elClientes.proxData?.value || "").trim();
  const proxISO = utils.brToISO(proxRaw);
  if(proxRaw && !proxISO){
    return setClientesMsg("Data da próxima ação inválida. Use dd/mm/aaaa.");
  }

  const data = {
    tipo: elClientes.tipo?.value || "lead",
    status: elClientes.status?.value || "novo",
    nome,
    telefone: (elClientes.telefone?.value || "").trim(),
    instagram: (elClientes.instagram?.value || "").trim(),
    email: (elClientes.email?.value || "").trim(),
    origem: (elClientes.origem?.value || "").trim(),
    tags: (elClientes.tags?.value || "").split(",").map(s=>s.trim()).filter(Boolean),
    proximaAcaoTitulo: (elClientes.proxTitulo?.value || "").trim(),
    proximaAcaoDataISO: proxISO || "",
    proximaAcaoObs: "",
    observacoes: (elClientes.obs?.value || "").trim(),
    updatedAt: fb.serverTimestamp(),
  };

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("clientes");
  try{
    let createdId = null;
    if(editingClienteId){
      await col.doc(editingClienteId).update(data);
    }else{
      const ref = await col.add({ ...data, createdAt: fb.serverTimestamp() });
      createdId = ref.id;
    }

    // se tiver próxima ação, cria/atualiza notificação automática (follow-up)
    const idToUse = editingClienteId || createdId;
    if (typeof window.notifUpsertForCliente === "function") {
      // se alguma versão expôs no window
      await window.notifUpsertForCliente(idToUse, data);
    } else {
      await notifUpsertForCliente(idToUse, data);
    }

    clientesCloseModal();
    await clientesRefresh();
    if (typeof window.refreshSelectorsClientsAndProjects === "function") {
      window.refreshSelectorsClientsAndProjects();
    }
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
  if (typeof window.refreshSelectorsClientsAndProjects === "function") {
    window.refreshSelectorsClientsAndProjects();
  }
}

async function clientesRefresh(){
  if (!elClientes.tbody) return;
  const filtro = elClientes.filtro?.value || "todos";
  const busca = (elClientes.busca?.value || "").trim().toLowerCase();

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("clientes");
  const snap = await col.orderBy("nome").get();

  const rows = [];
  snap.forEach(doc=>{
    const d = doc.data() || {};
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
    const prox = r.d.proximaAcaoDataISO
      ? `${utils.isoToBR(r.d.proximaAcaoDataISO)} • ${utils.escapeHtml(r.d.proximaAcaoTitulo || "")}`
      : "—";

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
  if(!clienteId) return;

  const dueISO = clienteData.proximaAcaoDataISO || "";
  const titulo = clienteData.proximaAcaoTitulo || "";
  if(!dueISO || !titulo) return;

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("notificacoes");
  const key = `cliente:${clienteId}:${dueISO}`;

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

// ===== Eventos (com null-check para não travar o app) =====
if (elClientes.btnOpen) elClientes.btnOpen.addEventListener("click", ()=> clientesOpenModal(null));
if (elClientes.btnClose) elClientes.btnClose.addEventListener("click", clientesCloseModal);
if (elClientes.btnSave) elClientes.btnSave.addEventListener("click", clientesSave);
if (elClientes.btnDel) elClientes.btnDel.addEventListener("click", clientesDelete);
if (elClientes.btnRefresh) elClientes.btnRefresh.addEventListener("click", clientesRefresh);

window.clientesRefresh = clientesRefresh;
