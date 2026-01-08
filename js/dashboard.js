// js/dashboard.js

/**
 * DASHBOARD: o filtro de "mês" aqui é uma DATA dentro do mês, no formato dd/mm/aa.
 * Ex.: 15/01/26 (qualquer dia do mês serve).
 * Internamente convertimos para monthKey "MM/AAAA" para filtrar no Firestore.
 */

function isoToBRShort(iso){
  // YYYY-MM-DD -> dd/mm/aa
  if(!iso) return "";
  const m = String(iso).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(!m) return "";
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if(!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return "";
  const d = new Date(yyyy, mm - 1, dd);
  if(d.getFullYear() !== yyyy || d.getMonth() !== (mm - 1) || d.getDate() !== dd) return "";
  const yy = String(yyyy).slice(-2);
  return `${utils.pad2(dd)}/${utils.pad2(mm)}/${yy}`;
}

function monthKeyToDashInput(monthKey){
  // "MM/AAAA" -> "01/MM/AA"
  const m = String(monthKey || "").trim().match(/^(\d{1,2})\/(\d{4})$/);
  if(!m) return "";
  const mm = utils.pad2(Number(m[1]));
  const yy = String(m[2]).slice(-2);
  return `01/${mm}/${yy}`;
}

function dashInputToMonthKey(input){
  // Aceita:
  // - dd/mm/aa (padrão)
  // - dd/mm/aaaa (se colar)
  // - MM/AAAA (legado)
  const s = String(input || "").trim();
  if(!s) return "";

  // legado: MM/AAAA
  if(/^\d{1,2}\/\d{4}$/.test(s)) return utils.normalizeMonthKey(s);

  // BR date: dd/mm/aa ou dd/mm/aaaa
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if(!m) return "";
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yearRaw = m[3];
  const yyyy = yearRaw.length === 2 ? (2000 + Number(yearRaw)) : Number(yearRaw);
  if(!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return "";

  // valida de verdade
  const d = new Date(yyyy, mm - 1, dd);
  if(d.getFullYear() !== yyyy || d.getMonth() !== (mm - 1) || d.getDate() !== dd) return "";
  return `${utils.pad2(mm)}/${yyyy}`;
}

function defaultDashDateInput(){
  // primeiro dia do mês atual, em dd/mm/aa
  return monthKeyToDashInput(defaultMonthKey());
}

function bindDashDateMask(){
  const el = document.getElementById("dash-mes");
  if(!el || el.dataset.maskBound === "1") return;
  el.dataset.maskBound = "1";

  el.addEventListener("input", ()=>{
    let digits = el.value.replace(/\D/g, "");

    // se colar ddmmyyyy, converte pra ddmmyy
    if(digits.length >= 8){
      digits = digits.slice(0, 4) + digits.slice(6, 8);
    } else {
      digits = digits.slice(0, 6);
    }

    if(digits.length <= 2){
      el.value = digits;
      return;
    }
    if(digits.length <= 4){
      el.value = `${digits.slice(0,2)}/${digits.slice(2)}`;
      return;
    }
    el.value = `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4,6)}`;
  });
}

async function dashboardRefresh(){
  bindDashDateMask();

  const raw = document.getElementById("dash-mes").value.trim();
  const monthKey = dashInputToMonthKey(raw) || defaultMonthKey();
  document.getElementById("dash-mes").value = monthKeyToDashInput(monthKey) || defaultDashDateInput();

  const range = utils.monthKeyToRange(monthKey);
  if(!range){
    alert("Data/mês inválido. Use dd/mm/aa (ex: 15/01/26) ou MM/AAAA (ex: 01/2026).\n\nDica: qualquer dia do mês serve.");
    return;
  }

  const prev = prevMonthKey(monthKey);
  const rangePrev = utils.monthKeyToRange(prev);

  // Lançamentos do mês
  const col = fb.db.collection("empresas").doc(state.empresaId).collection("lancamentos");

  const snap = await col
    .where("dataISO", ">=", range.startISO)
    .where("dataISO", "<", range.endISOExclusive)
    .get();

  let fatPago=0, despPago=0, areceber=0;
  snap.forEach(doc=>{
    const d = doc.data();
    const v = Number(d.valor || 0);
    if(d.tipo === "receita"){
      if(d.status === "pago") fatPago += v;
      else areceber += v;
    }else if(d.tipo === "despesa"){
      if(d.status === "pago") despPago += v;
    }
  });

  const res = fatPago - despPago;
  const margem = fatPago > 0 ? (res / fatPago) * 100 : 0;

  document.getElementById("kpi-fat").textContent = utils.formatBRL(fatPago);
  document.getElementById("kpi-desp").textContent = utils.formatBRL(despPago);
  document.getElementById("kpi-res").textContent = utils.formatBRL(res);
  document.getElementById("kpi-margem").textContent = `Margem: ${margem.toFixed(1)}%`;
  document.getElementById("kpi-areceber").textContent = utils.formatBRL(areceber);

  // Comparativos simples vs mês anterior
  if(rangePrev){
    const snapPrev = await col
      .where("dataISO", ">=", rangePrev.startISO)
      .where("dataISO", "<", rangePrev.endISOExclusive)
      .get();

    let fatPrev=0, despPrev=0;
    snapPrev.forEach(doc=>{
      const d = doc.data();
      const v = Number(d.valor || 0);
      if(d.tipo==="receita" && d.status==="pago") fatPrev += v;
      if(d.tipo==="despesa" && d.status==="pago") despPrev += v;
    });

    const comp = (cur, prev)=> {
      if(prev === 0 && cur === 0) return "0%";
      if(prev === 0 && cur !== 0) return "+∞";
      const pct = ((cur - prev)/prev)*100;
      const sign = pct >= 0 ? "+" : "";
      return `${sign}${pct.toFixed(1)}% vs ${monthKeyToDashInput(prevMonthKey(monthKey))}`;
    };

    document.getElementById("kpi-fat-comp").textContent = comp(fatPago, fatPrev);
    document.getElementById("kpi-desp-comp").textContent = comp(despPago, despPrev);
  }

  await dashboardLoadUpcomingProjects();
  await dashboardLoadHighlights();
}

function defaultMonthKey(){
  const d = new Date();
  return `${utils.pad2(d.getMonth()+1)}/${d.getFullYear()}`;
}

function prevMonthKey(monthKey){
  const m = monthKey.match(/^(\d{2})\/(\d{4})$/);
  if(!m) return monthKey;
  let mm = Number(m[1]), yyyy = Number(m[2]);
  mm -= 1;
  if(mm === 0){ mm = 12; yyyy -= 1; }
  return `${utils.pad2(mm)}/${yyyy}`;
}

async function dashboardLoadUpcomingProjects(){
  const tbody = document.getElementById("dash-projetos-tbody");
  tbody.innerHTML = "";

  const today = utils.todayISO();
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const endISO = `${d.getFullYear()}-${utils.pad2(d.getMonth()+1)}-${utils.pad2(d.getDate())}`;

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("projetos");
  // Projetos são salvos como dataISO (veja js/projetos.js)
  const snap = await col
    .where("dataISO", ">=", today)
    .where("dataISO", "<=", endISO)
    .orderBy("dataISO")
    .limit(10)
    .get();

  // map de clientes para nome
  const clientMap = await getClientMap();

  snap.forEach(doc=>{
    const p = doc.data();
    const clienteNome = clientMap[p.clienteId] || "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${isoToBRShort(p.dataISO)}</td>
      <td>${utils.escapeHtml(p.titulo)}</td>
      <td>${utils.escapeHtml(p.status || "")}</td>
      <td>${utils.escapeHtml(clienteNome)}</td>
    `;
    tbody.appendChild(tr);
  });

  if(snap.empty){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="muted">Sem projetos nos próximos 30 dias.</td>`;
    tbody.appendChild(tr);
  }
}

async function dashboardLoadHighlights(){
  const box = document.getElementById("dash-notifs");
  box.innerHTML = "";

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("notificacoes");
  const today = utils.todayISO();
  const snap = await col
    .where("status", "==", "aberta")
    .where("dueDateISO", "<=", today)
    .orderBy("dueDateISO", "asc")
    .limit(8)
    .get();

  if(snap.empty){
    box.innerHTML = `<p class="muted small">Nenhuma notificação vencida/hoje 🎉</p>`;
    return;
  }

  snap.forEach(doc=>{
    const n = doc.data();
    const div = document.createElement("div");
    div.className = "card";
    div.style.marginBottom = "10px";
    const pri = n.prioridade === "alta" ? "danger" : (n.prioridade === "media" ? "warn" : "ok");
    div.innerHTML = `
      <div class="row spread">
        <div><b>${utils.escapeHtml(n.titulo)}</b></div>
        <div>${utils.badge(isoToBRShort(n.dueDateISO), pri)}</div>
      </div>
      <div class="muted small" style="margin-top:6px">${utils.escapeHtml(n.descricao || "")}</div>
      <div class="row gap" style="margin-top:10px">
        <button class="btn" data-action="done" data-id="${doc.id}">Concluir</button>
      </div>
    `;
    box.appendChild(div);
  });

  box.querySelectorAll("button[data-action='done']").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      await setNotifDone(btn.dataset.id);
      await dashboardLoadHighlights();
      await notificacoesRefresh(); // se estiver na aba notifs
    });
  });
}

async function setNotifDone(id){
  const ref = fb.db.collection("empresas").doc(state.empresaId).collection("notificacoes").doc(id);
  await ref.update({ status: "concluida", updatedAt: fb.serverTimestamp() });
}

window.dashboardRefresh = dashboardRefresh;
window.defaultMonthKey = defaultMonthKey;
window.defaultDashDateInput = defaultDashDateInput;
