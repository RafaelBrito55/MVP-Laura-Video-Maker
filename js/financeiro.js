// js/financeiro.js
// Correções:
// - Botão "Novo lançamento" abre o modal (IDs corretos: modal-lan / btn-lan-close / btn-lan-save / btn-lan-del)
// - Não quebra se não existir filtro fin-tipo / fin-status
// - Mantém o campo de data do filtro com calendário (força type="date" quando possível)

const elFin = {
  tbody: document.getElementById("fin-tbody"),
  mes: document.getElementById("fin-mes"),
  btnRefresh: document.getElementById("btn-fin-refresh"),

  // botão da tela
  btnOpen:
    document.getElementById("btn-lan-open") ||
    document.getElementById("btn-open-lancamento") ||
    document.getElementById("btn-open-lan") ||
    null,

  // modal (ids variam por versão)
  modal:
    document.getElementById("modal-lan") ||
    document.getElementById("modal-lancamento") ||
    document.getElementById("modal-lanc") ||
    null,

  title:
    document.getElementById("lan-modal-title") ||
    document.getElementById("lancamento-modal-title") ||
    null,

  msg:
    document.getElementById("lan-msg") ||
    document.getElementById("lancamento-msg") ||
    null,

  btnClose:
    document.getElementById("btn-lan-close") ||
    document.getElementById("btn-close-lan") ||
    document.getElementById("btn-close-lancamento") ||
    null,

  btnSave:
    document.getElementById("btn-lan-save") ||
    document.getElementById("btn-save-lan") ||
    document.getElementById("btn-save-lancamento") ||
    null,

  btnDel:
    document.getElementById("btn-lan-del") ||
    document.getElementById("btn-del-lan") ||
    document.getElementById("btn-del-lancamento") ||
    null,

  // campos do formulário (modal-lan do seu index.html)
  lanTipo: document.getElementById("lan-tipo"),
  lanStatus: document.getElementById("lan-status"),
  lanData: document.getElementById("lan-data"), // dd/mm/aaaa (texto)
  lanValor: document.getElementById("lan-valor"),
  lanCategoria: document.getElementById("lan-categoria"),
  lanDesc: document.getElementById("lan-desc"),
  lanCliente: document.getElementById("lan-cliente"),
  lanProjeto: document.getElementById("lan-projeto"),
};

let editingLancamentoId = null;

function finIsoToMonthKey(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[2]}/${m[1]}`;
}

function finEnsureDateInput() {
  // deixa o filtro igual ao Dashboard (calendário)
  if (!elFin.mes) return;
  try {
    if (elFin.mes.tagName === "INPUT" && elFin.mes.type !== "date") {
      elFin.mes.type = "date";
    }
  } catch (_) {
    /* noop */
  }
}

function finGetSelectedISO() {
  if (!elFin.mes) return utils.todayISO();

  const raw = String(elFin.mes.value || "").trim();

  // vazio -> hoje (e mantém no campo)
  if (!raw) {
    const t = utils.todayISO();
    if (elFin.mes.type === "date") elFin.mes.value = t;
    return t;
  }

  // ISO direto (input type=date)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // BR dd/mm/aaaa
  const isoFromBR = utils.brToISO(raw);
  if (isoFromBR) {
    if (elFin.mes.type === "date") elFin.mes.value = isoFromBR;
    return isoFromBR;
  }

  // Mês MM/AAAA (caso ainda exista em algum lugar)
  const mk = utils.normalizeMonthKey(raw);
  if (mk) {
    const [mm, yyyy] = mk.split("/");
    const iso = `${yyyy}-${mm}-01`;
    if (elFin.mes.type === "date") elFin.mes.value = iso;
    return iso;
  }

  // fallback
  const t = utils.todayISO();
  if (elFin.mes.type === "date") elFin.mes.value = t;
  return t;
}

function finModalOpen() {
  if (!elFin.modal) return;
  elFin.modal.classList.remove("hidden");
}
function finModalClose() {
  if (!elFin.modal) return;
  elFin.modal.classList.add("hidden");
}
function finSetMsg(text) {
  if (elFin.msg) elFin.msg.textContent = text || "";
}

async function financeiroOpenModal(lanc) {
  if (!elFin.modal) {
    alert("Modal do Financeiro não encontrado no HTML (esperado: id='modal-lan').");
    return;
  }

  finSetMsg("");
  finModalOpen();

  // Preenche selects (definidos em app.js). Se não existir, só ignora.
  try {
    if (window.fillClientesSelect && elFin.lanCliente) await fillClientesSelect(elFin.lanCliente, true);
    if (window.fillProjetosSelect && elFin.lanProjeto) await fillProjetosSelect(elFin.lanProjeto, true);
  } catch (e) {
    console.warn("[financeiroOpenModal] erro ao preencher selects:", e);
  }

  if (lanc) {
    editingLancamentoId = lanc.id;
    if (elFin.title) elFin.title.textContent = "Editar lançamento";
    if (elFin.btnDel) elFin.btnDel.classList.remove("hidden");

    const d = lanc.data || {};
    if (elFin.lanTipo) elFin.lanTipo.value = d.tipo || "receita";
    if (elFin.lanStatus) elFin.lanStatus.value = d.status || "pago";
    if (elFin.lanData) elFin.lanData.value = utils.isoToBR(d.dataISO || "");
    if (elFin.lanValor)
      elFin.lanValor.value = Number(d.valor || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    if (elFin.lanCategoria) elFin.lanCategoria.value = d.categoria || "";
    if (elFin.lanDesc) elFin.lanDesc.value = d.descricao || "";
    if (elFin.lanCliente) elFin.lanCliente.value = d.clienteId || "";
    if (elFin.lanProjeto) elFin.lanProjeto.value = d.projetoId || "";
  } else {
    editingLancamentoId = null;
    if (elFin.title) elFin.title.textContent = "Novo lançamento";
    if (elFin.btnDel) elFin.btnDel.classList.add("hidden");

    if (elFin.lanTipo) elFin.lanTipo.value = "receita";
    if (elFin.lanStatus) elFin.lanStatus.value = "pago";
    if (elFin.lanData) elFin.lanData.value = "";
    if (elFin.lanValor) elFin.lanValor.value = "";
    if (elFin.lanCategoria) elFin.lanCategoria.value = "";
    if (elFin.lanDesc) elFin.lanDesc.value = "";
    if (elFin.lanCliente) elFin.lanCliente.value = "";
    if (elFin.lanProjeto) elFin.lanProjeto.value = "";
  }
}

async function financeiroSave() {
  finSetMsg("");

  const rawData = String(elFin.lanData?.value || "").trim();
  const dataISO = utils.brToISO(rawData) || (/^\d{4}-\d{2}-\d{2}$/.test(rawData) ? rawData : "");
  if (!dataISO) return finSetMsg("Informe uma data válida (dd/mm/aaaa).");

  const valor = utils.parseBRL(elFin.lanValor?.value || "");
  if (!(valor > 0)) return finSetMsg("Informe um valor maior que 0.");

  const data = {
    tipo: elFin.lanTipo?.value || "receita",
    status: elFin.lanStatus?.value || "pago",
    dataISO,
    valor,
    categoria: String(elFin.lanCategoria?.value || "").trim(),
    descricao: String(elFin.lanDesc?.value || "").trim(),
    clienteId: elFin.lanCliente?.value || "",
    projetoId: elFin.lanProjeto?.value || "",
    updatedAt: fb.serverTimestamp(),
  };

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("lancamentos");

  try {
    if (editingLancamentoId) {
      await col.doc(editingLancamentoId).update(data);
    } else {
      await col.add({ ...data, createdAt: fb.serverTimestamp() });
    }

    finModalClose();
    await financeiroRefresh();
    if (window.dashboardRefresh) await dashboardRefresh();
  } catch (err) {
    finSetMsg(err?.message || "Erro ao salvar.");
  }
}

async function financeiroDelete() {
  if (!editingLancamentoId) return;
  if (!confirm("Excluir este lançamento?")) return;

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("lancamentos");
  await col.doc(editingLancamentoId).delete();

  finModalClose();
  await financeiroRefresh();
  if (window.dashboardRefresh) await dashboardRefresh();
}

async function getProjectMap(limit = 200) {
  const map = {};
  const col = fb.db.collection("empresas").doc(state.empresaId).collection("projetos");
  const snap = await col.orderBy("dataEventoISO", "desc").limit(limit).get();
  snap.forEach((doc) => {
    const d = doc.data() || {};
    map[doc.id] = d.titulo || "";
  });
  return map;
}

async function financeiroRefresh() {
  finEnsureDateInput();

  const isoSelected = finGetSelectedISO();
  const monthKey = finIsoToMonthKey(isoSelected);
  const range = utils.monthKeyToRange(monthKey);
  if (!range) return;

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("lancamentos");

  const snap = await col
    .where("dataISO", ">=", range.startISO)
    .where("dataISO", "<", range.endISOExclusive)
    .orderBy("dataISO")
    .get();

  // mapas para nomes
  let clientMap = {};
  let projectMap = {};
  try {
    if (window.getClientMap) clientMap = await getClientMap();
  } catch (_) {}
  try {
    projectMap = await getProjectMap();
  } catch (_) {}

  if (elFin.tbody) elFin.tbody.innerHTML = "";

  const rows = [];
  snap.forEach((doc) => rows.push({ id: doc.id, d: doc.data() }));

  if (rows.length === 0) {
    if (elFin.tbody) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="8" class="muted">Nenhum lançamento neste mês.</td>`;
      elFin.tbody.appendChild(tr);
    }
    return;
  }

  for (const r of rows) {
    const d = r.d || {};
    const clienteNome = d.clienteId ? (clientMap[d.clienteId] || "—") : "—";
    const projetoTitulo = d.projetoId ? (projectMap[d.projetoId] || "—") : "—";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${utils.isoToBR(d.dataISO || "")}</td>
      <td>${utils.escapeHtml(d.tipo || "")}</td>
      <td>${utils.escapeHtml(d.categoria || "")}</td>
      <td>${utils.escapeHtml(clienteNome)}</td>
      <td>${utils.escapeHtml(projetoTitulo)}</td>
      <td>${utils.formatBRL(d.valor || 0)}</td>
      <td>${utils.escapeHtml(d.status || "")}</td>
      <td><button class="btn" data-action="edit" data-id="${r.id}">Editar</button></td>
    `;
    elFin.tbody.appendChild(tr);
  }

  elFin.tbody.querySelectorAll("button[data-action='edit']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const doc = await col.doc(id).get();
      financeiroOpenModal({ id, data: doc.data() });
    });
  });
}

// ====== BINDS ======
finEnsureDateInput();

if (elFin.btnOpen) {
  elFin.btnOpen.addEventListener("click", () => financeiroOpenModal(null));
}
if (elFin.btnRefresh) {
  elFin.btnRefresh.addEventListener("click", financeiroRefresh);
}
if (elFin.btnClose) {
  elFin.btnClose.addEventListener("click", finModalClose);
}
if (elFin.btnSave) {
  elFin.btnSave.addEventListener("click", financeiroSave);
}
if (elFin.btnDel) {
  elFin.btnDel.addEventListener("click", financeiroDelete);
}

window.financeiroRefresh = financeiroRefresh;
window.financeiroOpenModal = financeiroOpenModal;
