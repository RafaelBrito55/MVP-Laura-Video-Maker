// js/financeiro.js
const elFin = {
  tbody: document.getElementById("fin-tbody"),
  mes: document.getElementById("fin-mes"),
  tipo: document.getElementById("fin-tipo"),
  status: document.getElementById("fin-status"),
  btnRefresh: document.getElementById("btn-fin-refresh"),

  btnOpenReceita: document.getElementById("btn-open-receita"),
  btnOpenDespesa: document.getElementById("btn-open-despesa"),

  modal: document.getElementById("modal-lancamento"),
  title: document.getElementById("lancamento-modal-title"),
  msg: document.getElementById("lancamento-msg"),
  btnClose: document.getElementById("btn-close-lancamento"),
  btnSave: document.getElementById("btn-save-lancamento"),
  btnDel: document.getElementById("btn-del-lancamento"),

  lanTipo: document.getElementById("lan-tipo"),
  lanStatus: document.getElementById("lan-status"),
  lanData: document.getElementById("lan-data"),
  lanValor: document.getElementById("lan-valor"),
  lanCategoria: document.getElementById("lan-categoria"),
  lanForma: document.getElementById("lan-forma"),
  lanDesc: document.getElementById("lan-desc"),
  lanCliente: document.getElementById("lan-cliente"),
  lanProjeto: document.getElementById("lan-projeto"),
};

let editingLancamentoId = null;

async function financeiroOpenModal(tipo, lanc){
  elFin.modal.classList.remove("hidden");
  elFin.msg.textContent = "";
  await fillClientesSelect(elFin.lanCliente, true);
  await fillProjetosSelect(elFin.lanProjeto, true);

  if(lanc){
    editingLancamentoId = lanc.id;
    elFin.title.textContent = "Editar lançamento";
    elFin.btnDel.classList.remove("hidden");

    const d = lanc.data;
    elFin.lanTipo.value = d.tipo || "receita";
    elFin.lanStatus.value = d.status || "pago";
    elFin.lanData.value = utils.isoToBR(d.dataISO || "");
    elFin.lanValor.value = (d.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    elFin.lanCategoria.value = d.categoria || "";
    elFin.lanForma.value = d.formaPgto || "pix";
    elFin.lanDesc.value = d.descricao || "";
    elFin.lanCliente.value = d.clienteId || "";
    elFin.lanProjeto.value = d.projetoId || "";
  }else{
    editingLancamentoId = null;
    elFin.btnDel.classList.add("hidden");
    elFin.lanTipo.value = tipo || "receita";
    elFin.title.textContent = tipo === "despesa" ? "Nova despesa" : "Nova receita";
    elFin.lanStatus.value = "pago";
    elFin.lanData.value = "";
    elFin.lanValor.value = "";
    elFin.lanCategoria.value = "";
    elFin.lanForma.value = "pix";
    elFin.lanDesc.value = "";
    elFin.lanCliente.value = "";
    elFin.lanProjeto.value = "";
  }
}

function financeiroCloseModal(){ elFin.modal.classList.add("hidden"); }
function setFinMsg(t){ elFin.msg.textContent = t || ""; }

async function financeiroSave(){
  setFinMsg("");
  const dataISO = utils.brToISO(elFin.lanData.value.trim());
  if(elFin.lanData.value.trim() && !dataISO) return setFinMsg("Data inválida. Use dd/mm/aaaa.");
  if(!dataISO) return setFinMsg("Informe a data.");

  const valor = utils.parseBRL(elFin.lanValor.value);
  if(valor <= 0) return setFinMsg("Informe um valor > 0.");

  const data = {
    tipo: elFin.lanTipo.value,
    status: elFin.lanStatus.value,
    dataISO,
    valor,
    categoria: elFin.lanCategoria.value.trim(),
    formaPgto: elFin.lanForma.value,
    descricao: elFin.lanDesc.value.trim(),
    clienteId: elFin.lanCliente.value || "",
    projetoId: elFin.lanProjeto.value || "",
    updatedAt: fb.serverTimestamp(),
  };

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("lancamentos");
  try{
    if(editingLancamentoId){
      await col.doc(editingLancamentoId).update(data);
    }else{
      await col.add({ ...data, createdAt: fb.serverTimestamp() });
    }

    // Notificação automática: se receita prevista e data <= hoje, cria cobrança
    await notifUpsertForLancamento(editingLancamentoId ? editingLancamentoId : null, data);

    financeiroCloseModal();
    await financeiroRefresh();
    await dashboardRefresh();
  }catch(err){
    setFinMsg(err?.message || "Erro ao salvar.");
  }
}

async function financeiroDelete(){
  if(!editingLancamentoId) return;
  if(!confirm("Excluir este lançamento?")) return;
  const col = fb.db.collection("empresas").doc(state.empresaId).collection("lancamentos");
  await col.doc(editingLancamentoId).delete();
  financeiroCloseModal();
  await financeiroRefresh();
  await dashboardRefresh();
}

async function financeiroRefresh(){
  const monthKey = elFin.mes.value.trim() || defaultMonthKey();
  elFin.mes.value = monthKey;
  const range = utils.monthKeyToRange(monthKey);
  if(!range) return;

  const tipoFiltro = elFin.tipo.value;
  const statusFiltro = elFin.status.value;

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("lancamentos");
  const snap = await col
    .where("dataISO", ">=", range.startISO)
    .where("dataISO", "<", range.endISOExclusive)
    .orderBy("dataISO")
    .get();

  elFin.tbody.innerHTML = "";
  const rows = [];
  snap.forEach(doc=>{
    const d = doc.data();
    if(tipoFiltro !== "todos" && d.tipo !== tipoFiltro) return;
    if(statusFiltro !== "todos" && d.status !== statusFiltro) return;
    rows.push({ id: doc.id, d });
  });

  for(const r of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${utils.isoToBR(r.d.dataISO)}</td>
      <td>${utils.escapeHtml(r.d.tipo)}</td>
      <td>${utils.escapeHtml(r.d.categoria || "")}</td>
      <td>${utils.escapeHtml(r.d.descricao || "")}</td>
      <td>${utils.formatBRL(r.d.valor || 0)}</td>
      <td>${utils.escapeHtml(r.d.status || "")}</td>
      <td><span class="link" data-action="edit" data-id="${r.id}">Editar</span></td>
    `;
    elFin.tbody.appendChild(tr);
  }

  if(rows.length === 0){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" class="muted">Nenhum lançamento.</td>`;
    elFin.tbody.appendChild(tr);
  }

  elFin.tbody.querySelectorAll("[data-action='edit']").forEach(el=>{
    el.addEventListener("click", async ()=>{
      const id = el.dataset.id;
      const doc = await col.doc(id).get();
      financeiroOpenModal(doc.data()?.tipo || "receita", { id, data: doc.data() });
    });
  });
}

// Notificação automática de cobrança (receita prevista)
async function notifUpsertForLancamento(lancIdMaybeNull, lancData){
  const lancId = lancIdMaybeNull || null;
  if(!lancId) return;

  if(lancData.tipo !== "receita") return;
  if(lancData.status !== "previsto") return;

  const dueISO = lancData.dataISO;
  const titulo = `Cobrança: ${lancData.descricao || "receita prevista"}`;
  const col = fb.db.collection("empresas").doc(state.empresaId).collection("notificacoes");
  const key = `lancamento:${lancId}:${dueISO}`;

  const snap = await col.where("key", "==", key).limit(1).get();
  if(!snap.empty){
    await col.doc(snap.docs[0].id).update({
      titulo,
      descricao: `Receita prevista: ${utils.formatBRL(lancData.valor)}`,
      tipo: "cobranca",
      refTipo: "lancamento",
      refId: lancId,
      dueDateISO: dueISO,
      prioridade: "media",
      status: "aberta",
      updatedAt: fb.serverTimestamp(),
    });
    return;
  }

  await col.add({
    key,
    titulo,
    descricao: `Receita prevista: ${utils.formatBRL(lancData.valor)}`,
    tipo: "cobranca",
    refTipo: "lancamento",
    refId: lancId,
    dueDateISO: dueISO,
    prioridade: "media",
    status: "aberta",
    createdAt: fb.serverTimestamp(),
    updatedAt: fb.serverTimestamp(),
  });
}

// Eventos
elFin.btnOpenReceita.addEventListener("click", ()=> financeiroOpenModal("receita", null));
elFin.btnOpenDespesa.addEventListener("click", ()=> financeiroOpenModal("despesa", null));
elFin.btnClose.addEventListener("click", financeiroCloseModal);
elFin.btnSave.addEventListener("click", financeiroSave);
elFin.btnDel.addEventListener("click", financeiroDelete);
elFin.btnRefresh.addEventListener("click", financeiroRefresh);

window.financeiroRefresh = financeiroRefresh;
window.financeiroOpenModal = financeiroOpenModal;
