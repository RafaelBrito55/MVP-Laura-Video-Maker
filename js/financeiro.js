// js/financeiro.js
// Correção: botões "Nova receita" e "Nova despesa" abrindo o modal (mesmo se IDs mudarem)
// + mês com calendário (input type="date") sem resetar após atualizar

// Helpers
function finById(...ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function finFindButtonByText(rootEl, textsLower) {
  if (!rootEl) return null;
  const btns = Array.from(rootEl.querySelectorAll("button"));
  return (
    btns.find((b) =>
      textsLower.includes((b.textContent || "").trim().toLowerCase())
    ) || null
  );
}

function finOn(el, ev, fn) {
  if (!el) return;
  el.addEventListener(ev, fn);
}

const elFin = {
  view: finById("view-financeiro"),

  tbody: finById("fin-tbody"),
  mes: finById("fin-mes"),
  tipo: finById("fin-tipo"),
  status: finById("fin-status"),
  btnRefresh: finById("btn-fin-refresh"),

  // botões (podem variar entre versões)
  btnOpenReceita: finById("btn-open-receita"),
  btnOpenDespesa: finById("btn-open-despesa"),
  btnOpenLanc: finById("btn-lan-open", "btn-open-lancamento", "btn-open-lan"),

  // modal (podem variar entre versões)
  modal: finById("modal-lancamento", "modal-lan", "modal-lanc"),
  title: finById("lancamento-modal-title", "lan-modal-title"),
  msg: finById("lancamento-msg", "lan-msg"),
  btnClose: finById("btn-close-lancamento", "btn-lan-close", "btn-close-lan"),
  btnSave: finById("btn-save-lancamento", "btn-lan-save", "btn-save-lan"),
  btnDel: finById("btn-del-lancamento", "btn-lan-del", "btn-del-lan"),

  // campos do lançamento
  lanTipo: finById("lan-tipo"),
  lanStatus: finById("lan-status"),
  lanData: finById("lan-data"),
  lanDataISO: finById("lan-data-iso"),
  lanCalBtn: finById("lan-cal-btn"),
  lanValor: finById("lan-valor"),
  lanCategoria: finById("lan-categoria"),
  lanForma: finById("lan-forma"), // pode não existir em algumas versões
  lanDesc: finById("lan-desc"),
  lanCliente: finById("lan-cliente"),
  lanProjeto: finById("lan-projeto"),
};

// Fallback por texto (se os IDs mudarem)
if (!elFin.btnOpenReceita) elFin.btnOpenReceita = finFindButtonByText(elFin.view, ["nova receita"]);
if (!elFin.btnOpenDespesa) elFin.btnOpenDespesa = finFindButtonByText(elFin.view, ["nova despesa"]);

let editingLancamentoId = null;

// ===== Categorias (datalist por tipo: receita x despesa) =====
function finSyncCategoriasDatalist() {
  if (!elFin.lanCategoria) return;
  const t = (elFin.lanTipo ? elFin.lanTipo.value : "receita");
  const listId = (t === "despesa") ? "categorias-despesa" : "categorias-receita";
  try {
    if (elFin.lanCategoria.getAttribute("list") !== listId) {
      elFin.lanCategoria.setAttribute("list", listId);
    }
  } catch (_) {}
}


// ===== Datas (modal Nova receita / Nova despesa) =====
function finBrDigitsToBR(digits){
  const d = String(digits || "").replace(/\D/g, "").slice(0, 8);
  if(d.length <= 2) return d;
  if(d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
}

function finExpandYearIfNeeded(br){
  const s = String(br || "").trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if(!m) return s;
  const dd = m[1], mm = m[2], yy = Number(m[3]);
  const yyyy = (yy < 80) ? (2000 + yy) : (1900 + yy);
  return `${dd}/${mm}/${yyyy}`;
}

function finBindLancamentoDateInput(){
  const txt = elFin.lanData;
  const iso = elFin.lanDataISO;
  const calBtn = elFin.lanCalBtn;
  if(!txt || !iso) return;

  // Garante o tipo date
  try{ if(iso.tagName === "INPUT") iso.type = "date"; }catch(_){ }

  // Clique no ícone abre o calendário nativo
  if(calBtn){
    calBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      try{
        if(typeof iso.showPicker === "function") iso.showPicker();
        else { iso.focus(); iso.click(); }
      }catch(err){
        try{ iso.focus(); iso.click(); }catch(_e2){}
      }
    });
  }

  // Máscara enquanto digita (dd/mm/aaaa)
  txt.addEventListener("input", ()=>{
    const digits = txt.value.replace(/\D/g, "");
    txt.value = finBrDigitsToBR(digits);
  });

  // Ao sair do campo, expande dd/mm/yy -> dd/mm/yyyy e sincroniza o ISO
  txt.addEventListener("blur", ()=>{
    const expanded = finExpandYearIfNeeded(txt.value);
    if(expanded !== txt.value) txt.value = expanded;
    const isoV = utils.brToISO(txt.value);
    if(isoV) iso.value = isoV;
  });

  // Ao escolher no calendário, converte ISO -> BR
  iso.addEventListener("change", ()=>{
    const v = String(iso.value || "").trim();
    if(!v) return;
    const br = utils.isoToBR(v);
    if(br) txt.value = br;
  });
}

function finIsoToMonthKey(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[2]}/${m[1]}`;
}

function finSetMesToMonthKey(monthKey) {
  if (!elFin.mes) return;
  const mk = utils.normalizeMonthKey(monthKey) || defaultMonthKey();
  const parts = mk.split("/");
  const mm = parts[0];
  const yyyy = parts[1];

  if (elFin.mes.tagName === "INPUT" && elFin.mes.type === "date") {
    elFin.mes.value = `${yyyy}-${mm}-01`;
  } else {
    elFin.mes.value = mk;
  }
}

function finEnsureMesDatePicker() {
  if (!elFin.mes) return;

  // tenta trocar para calendário (type="date")
  try {
    if (elFin.mes.tagName === "INPUT" && elFin.mes.type !== "date") {
      elFin.mes.type = "date";
    }
  } catch (_) {}

  // normaliza valor inicial (app.js costuma setar "MM/AAAA")
  const raw = String(elFin.mes.value || "").trim();
  if (!raw) {
    // inicia sempre no dia atual
    elFin.mes.value = utils.todayISO();
    return;
  }

  if (elFin.mes.type === "date") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return;

    // se veio "MM/AAAA"
    const mk = utils.normalizeMonthKey(raw);
    if (mk) return finSetMesToMonthKey(mk);

    // se veio "dd/mm/aaaa"
    const iso = utils.brToISO(raw);
    if (iso) elFin.mes.value = iso;
  }
}

function finGetSelectedMonthKey() {
  if (!elFin.mes) return defaultMonthKey();

  const raw = String(elFin.mes.value || "").trim();
  if (!raw) {
    finEnsureMesDatePicker();
    return finIsoToMonthKey(elFin.mes.value) || defaultMonthKey();
  }

  // input type date => ISO
  if (elFin.mes.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return finIsoToMonthKey(raw) || defaultMonthKey();
  }

  // dd/mm/aaaa (texto)
  const isoFromBR = utils.brToISO(raw);
  if (isoFromBR) {
    if (elFin.mes.type === "date") elFin.mes.value = isoFromBR;
    return finIsoToMonthKey(isoFromBR) || defaultMonthKey();
  }

  // MM/AAAA
  const mk = utils.normalizeMonthKey(raw);
  if (mk) {
    finSetMesToMonthKey(mk);
    return mk;
  }

  // fallback
  return defaultMonthKey();
}

async function financeiroOpenModal(tipo, lanc) {
  if (!elFin.modal) {
    alert('Modal do lançamento não encontrado no HTML (esperado: #modal-lancamento).');
    return;
  }

  elFin.modal.classList.remove("hidden");
  if (elFin.msg) elFin.msg.textContent = "";

  // Preenche selects (se existirem as funções)
  try {
    if (typeof window.fillClientesSelect === "function" && elFin.lanCliente) {
      await window.fillClientesSelect(elFin.lanCliente, true);
    }
    if (typeof window.fillProjetosSelect === "function" && elFin.lanProjeto) {
      await window.fillProjetosSelect(elFin.lanProjeto, true);
    }
  } catch (e) {
    console.warn("[financeiro] erro ao preencher selects:", e);
  }

  if (lanc) {
    editingLancamentoId = lanc.id;
    if (elFin.title) elFin.title.textContent = "Editar lançamento";
    if (elFin.btnDel) elFin.btnDel.classList.remove("hidden");

    const d = lanc.data || {};
    if (elFin.lanTipo) elFin.lanTipo.value = d.tipo || "receita";
    if (elFin.lanStatus) elFin.lanStatus.value = d.status || "pago";
    {
      const isoV = d.dataISO || "";
      if (elFin.lanData) elFin.lanData.value = utils.isoToBR(isoV);
      if (elFin.lanDataISO) elFin.lanDataISO.value = isoV;
    }
    if (elFin.lanValor) elFin.lanValor.value = utils.formatBRL(d.valor || 0).replace("R$ ", "");
    if (elFin.lanCategoria) elFin.lanCategoria.value = d.categoria || "";
    if (elFin.lanForma) elFin.lanForma.value = d.forma || "pix";
    if (elFin.lanDesc) elFin.lanDesc.value = d.descricao || "";
    if (elFin.lanCliente) elFin.lanCliente.value = d.clienteId || "";
    if (elFin.lanProjeto) elFin.lanProjeto.value = d.projetoId || "";
  } else {
    editingLancamentoId = null;
    if (elFin.btnDel) elFin.btnDel.classList.add("hidden");

    const t = tipo || "receita";
    if (elFin.lanTipo) elFin.lanTipo.value = t;
    finSyncCategoriasDatalist();
    if (elFin.title) elFin.title.textContent = t === "despesa" ? "Nova despesa" : "Nova receita";

    if (elFin.lanStatus) elFin.lanStatus.value = "pago";
    {
      const todayISO = utils.todayISO();
      const todayBR = utils.isoToBR(todayISO);
      if (elFin.lanData) elFin.lanData.value = todayBR;
      if (elFin.lanDataISO) elFin.lanDataISO.value = todayISO;
    }
    if (elFin.lanValor) elFin.lanValor.value = "";
    if (elFin.lanCategoria) elFin.lanCategoria.value = "";
    if (elFin.lanForma) elFin.lanForma.value = "pix";
    if (elFin.lanDesc) elFin.lanDesc.value = "";
    if (elFin.lanCliente) elFin.lanCliente.value = "";
    if (elFin.lanProjeto) elFin.lanProjeto.value = "";
  }
}

function financeiroCloseModal() {
  if (!elFin.modal) return;
  elFin.modal.classList.add("hidden");
}

function setFinMsg(t) {
  if (!elFin.msg) return;
  elFin.msg.textContent = t || "";
}

async function financeiroSave() {
  setFinMsg("");

  let rawData = String((elFin.lanData && elFin.lanData.value) ? elFin.lanData.value : "").trim();
  rawData = finExpandYearIfNeeded(rawData);
  if (elFin.lanData && elFin.lanData.value !== rawData) elFin.lanData.value = rawData;
  const dataISO = utils.brToISO(rawData) || (/^\d{4}-\d{2}-\d{2}$/.test(rawData) ? rawData : "");
  if (!dataISO) return setFinMsg("Informe a data (dd/mm/aaaa).");

  const valor = utils.parseBRL(String((elFin.lanValor && elFin.lanValor.value) ? elFin.lanValor.value : ""));
  if (!(valor > 0)) return setFinMsg("Informe um valor > 0.");

  const data = {
    tipo: (elFin.lanTipo ? elFin.lanTipo.value : "receita"),
    status: (elFin.lanStatus ? elFin.lanStatus.value : "pago"),
    dataISO,
    valor,
    categoria: String(elFin.lanCategoria ? elFin.lanCategoria.value : "").trim(),
    forma: elFin.lanForma ? (elFin.lanForma.value || "pix") : "pix",
    descricao: String(elFin.lanDesc ? elFin.lanDesc.value : "").trim(),
    clienteId: (elFin.lanCliente ? elFin.lanCliente.value : ""),
    projetoId: (elFin.lanProjeto ? elFin.lanProjeto.value : ""),
    updatedAt: fb.serverTimestamp(),
  };

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("lancamentos");

  try {
    if (editingLancamentoId) {
      await col.doc(editingLancamentoId).update(data);
    } else {
      const ref = await col.add({ ...data, createdAt: fb.serverTimestamp() });
      editingLancamentoId = ref.id; // para gerar notificação se necessário
    }

    // Notificação automática: receita prevista
    await notifUpsertForLancamento(editingLancamentoId ? editingLancamentoId : null, data);

    financeiroCloseModal();
    await financeiroRefresh();
    if (typeof window.dashboardRefresh === "function") await window.dashboardRefresh();
  } catch (err) {
    setFinMsg((err && err.message) ? err.message : "Erro ao salvar.");
  }
}

async function financeiroDelete() {
  if (!editingLancamentoId) return;
  if (!confirm("Excluir este lançamento?")) return;

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("lancamentos");
  await col.doc(editingLancamentoId).delete();

  financeiroCloseModal();
  await financeiroRefresh();
  if (typeof window.dashboardRefresh === "function") await window.dashboardRefresh();
}

async function financeiroRefresh() {
  finEnsureMesDatePicker();

  const monthKey = finGetSelectedMonthKey();
  const range = utils.monthKeyToRange(monthKey);
  if (!range) return;

  const tipoFiltro = elFin.tipo ? elFin.tipo.value : "todos";
  const statusFiltro = elFin.status ? elFin.status.value : "todos";

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("lancamentos");
  const snap = await col
    .where("dataISO", ">=", range.startISO)
    .where("dataISO", "<", range.endISOExclusive)
    .orderBy("dataISO")
    .get();

  if (elFin.tbody) elFin.tbody.innerHTML = "";

  const rows = [];
  snap.forEach((doc) => rows.push({ id: doc.id, d: doc.data() || {} }));

  // aplica filtros
  const filtered = rows.filter((r) => {
    const d = r.d;
    const okTipo = (tipoFiltro === "todos") || (d.tipo === tipoFiltro);
    const okStatus = (statusFiltro === "todos") || (d.status === statusFiltro);
    return okTipo && okStatus;
  });

  if (!elFin.tbody) return;

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" class="muted">Nenhum lançamento neste mês.</td>`;
    elFin.tbody.appendChild(tr);
    return;
  }

  for (const r of filtered) {
    const d = r.d;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${utils.isoToBR(d.dataISO || "")}</td>
      <td>${utils.escapeHtml(d.tipo || "")}</td>
      <td>${utils.escapeHtml(d.categoria || "")}</td>
      <td>${utils.escapeHtml(d.descricao || "")}</td>
      <td>${utils.formatBRL(d.valor || 0)}</td>
      <td>${utils.escapeHtml(d.status || "")}</td>
      <td><span class="link" data-action="edit" data-id="${r.id}">Editar</span></td>
    `;
    elFin.tbody.appendChild(tr);
  }

  elFin.tbody.querySelectorAll("[data-action='edit']").forEach((el) => {
    el.addEventListener("click", async () => {
      const id = el.dataset.id;
      const doc = await col.doc(id).get();
      const data = doc.data() || {};
      financeiroOpenModal(data.tipo || "receita", { id, data });
    });
  });
}

// Notificação automática de cobrança (receita prevista)
async function notifUpsertForLancamento(lancIdMaybeNull, lancData) {
  const lancId = lancIdMaybeNull || null;
  if (!lancId) return;

  if (lancData.tipo !== "receita") return;
  if (lancData.status !== "previsto") return;

  const dueISO = lancData.dataISO;
  const titulo = `Cobrança: ${lancData.descricao || "receita prevista"}`;
  const col = fb.db.collection("empresas").doc(state.empresaId).collection("notificacoes");
  const key = `lancamento:${lancId}:${dueISO}`;

  const snap = await col.where("key", "==", key).limit(1).get();
  if (!snap.empty) {
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

// Eventos (com null-check para não travar o app)
finBindLancamentoDateInput();
finOn(elFin.lanTipo, "change", finSyncCategoriasDatalist);

finOn(elFin.btnOpenReceita, "click", function () { financeiroOpenModal("receita", null); });
finOn(elFin.btnOpenDespesa, "click", function () { financeiroOpenModal("despesa", null); });
finOn(elFin.btnOpenLanc, "click", function () { financeiroOpenModal("receita", null); });

finOn(elFin.btnClose, "click", financeiroCloseModal);
finOn(elFin.btnSave, "click", financeiroSave);
finOn(elFin.btnDel, "click", financeiroDelete);
finOn(elFin.btnRefresh, "click", financeiroRefresh);

window.financeiroRefresh = financeiroRefresh;
window.financeiroOpenModal = financeiroOpenModal;

// primeira carga: garante calendário e mantém valor
finEnsureMesDatePicker();

// Re-normaliza depois que o app.js inicializar os valores
setTimeout(function () {
  try { finEnsureMesDatePicker(); } catch (_) {}
}, 0);
