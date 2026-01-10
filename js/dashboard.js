// js/dashboard.js

/**
 * DASHBOARD
 * - O filtro aqui é uma DATA de referência (dd/mm/aaaa) escolhida pelo usuário.
 * - Internamente usamos o MÊS dessa data (monthKey "MM/AAAA") para filtrar no Firestore.
 *
 * Requisitos implementados:
 * 1) Campo com calendário (input type="date").
 * 2) Ao clicar em "Atualizar", a data permanece (não volta para 01).
 * 3) Ao iniciar o sistema, começa na data de hoje (feito no app.js).
 */

function isoToMonthKey(iso){
  // "YYYY-MM-DD" -> "MM/AAAA"
  const m = String(iso || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return "";
  const yyyy = m[1];
  const mm = m[2];
  return `${mm}/${yyyy}`;
}

function getDashSelectedISO(){
  // dash-mes é type="date" (valor interno YYYY-MM-DD)
  const el = document.getElementById("dash-mes");
  if(!el) return "";

  const raw = String(el.value || "").trim();
  if(!raw){
    const today = utils.todayISO();
    el.value = today;
    return today;
  }

  // aceita YYYY-MM-DD e também dd/mm/aaaa (caso o browser permita digitar assim)
  const iso = utils.brToISO(raw);
  if(!iso) return "";

  // normaliza e garante que o input fique fixo no valor selecionado
  if(el.value !== iso) el.value = iso;
  return iso;
}

async function dashboardRefresh(){
  const isoSelected = getDashSelectedISO();
  if(!isoSelected){
    alert("Data inválida. Use dd/mm/aaaa (ex: 31/01/2026).\n\nDica: você pode selecionar no calendário.");
    return;
  }

  const monthKey = isoToMonthKey(isoSelected) || defaultMonthKey();
  const range = utils.monthKeyToRange(monthKey);
  if(!range){
    alert("Mês inválido.");
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

    const comp = (cur, prevVal)=> {
      if(prevVal === 0 && cur === 0) return `0% vs ${prev}`;
      if(prevVal === 0 && cur !== 0) return `+∞ vs ${prev}`;
      const pct = ((cur - prevVal)/prevVal)*100;
      const sign = pct >= 0 ? "+" : "";
      return `${sign}${pct.toFixed(1)}% vs ${prev}`;
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
      <td>${utils.isoToBR(p.dataISO)}</td>
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
  if(!box) return;
  box.innerHTML = "";

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("notificacoes");
  const today = utils.todayISO();

  try{
    // Evita query que exige índice composto (status + dueDateISO).
    // Busca por vencidas/hoje e filtra "aberta" no JS.
    const snap = await col
      .where("dueDateISO", "<=", today)
      .orderBy("dueDateISO", "asc")
      .limit(25)
      .get();

    const items = [];
    snap.forEach(doc=>{
      const n = doc.data();
      if((n.status || "") === "aberta") items.push({ id: doc.id, ...n });
    });

    if(items.length === 0){
      box.innerHTML = `<p class="muted small">Nenhuma notificação vencida/hoje 🎉</p>`;
      return;
    }

    items.slice(0, 8).forEach(n=>{
      const div = document.createElement("div");
      div.className = "card";
      div.style.marginBottom = "10px";
      const pri = n.prioridade === "alta" ? "danger" : (n.prioridade === "media" ? "warn" : "ok");
      div.innerHTML = `
        <div class="row spread">
          <div><b>${utils.escapeHtml(n.titulo)}</b></div>
          <div>${utils.badge(utils.isoToBR(n.dueDateISO), pri)}</div>
        </div>
        <div class="muted small" style="margin-top:6px">${utils.escapeHtml(n.descricao || "")}</div>
        <div class="row gap" style="margin-top:10px">
          <button class="btn" data-action="done" data-id="${n.id}">Concluir</button>
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
  }catch(err){
    console.error("[dashboardLoadHighlights] erro:", err);
    box.innerHTML = `
      <p class="muted small">
        Não foi possível carregar as notificações em destaque.
        Abra o Console (F12) para ver o erro.
      </p>
    `;
  }
}

async function setNotifDone(id){
  const ref = fb.db.collection("empresas").doc(state.empresaId).collection("notificacoes").doc(id);
  await ref.update({ status: "concluida", updatedAt: fb.serverTimestamp() });
}

window.dashboardRefresh = dashboardRefresh;
window.defaultMonthKey = defaultMonthKey;
