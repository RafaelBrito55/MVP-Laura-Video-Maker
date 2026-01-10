// js/dashboard.js

/**
 * DASHBOARD
 * - O filtro aqui é uma DATA de referência (dd/mm/aaaa) escolhida pelo usuário.
 * - Internamente usamos o MÊS dessa data (monthKey "MM/AAAA") para filtrar no Firestore.
 *
 * Requisitos:
 * 1) Campo visível em dd/mm/aaaa + botão de calendário (com input date escondido).
 * 2) Ao clicar em "Atualizar", a data permanece (não volta/zera).
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

function brDigitsToBR(digits){
  // "10012026" -> "10/01/2026"
  const d = String(digits || "").replace(/\D/g, "").slice(0, 8);
  if(d.length <= 2) return d;
  if(d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
}

function expandYearIfNeeded(br){
  // aceita dd/mm/yy e converte pra dd/mm/yyyy (20yy se yy<80, senão 19yy)
  const s = String(br || "").trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if(!m) return s;
  const dd = m[1], mm = m[2], yy = Number(m[3]);
  const yyyy = (yy < 80) ? (2000 + yy) : (1900 + yy);
  return `${dd}/${mm}/${yyyy}`;
}

function getDashSelectedISO(){
  // dash-mes é texto no formato dd/mm/aaaa
  const el = document.getElementById("dash-mes");
  const isoEl = document.getElementById("dash-mes-iso");
  if(!el) return "";

  let raw = String(el.value || "").trim();

  // se vier só dígitos (ex: 10012026), aplica máscara
  const digitsOnly = raw.replace(/\D/g, "");
  if(digitsOnly && raw === digitsOnly){
    raw = brDigitsToBR(digitsOnly);
    el.value = raw;
  }

  // se for dd/mm/yy, expande no refresh/blur
  raw = expandYearIfNeeded(raw);
  if(el.value !== raw) el.value = raw;

  let iso = utils.brToISO(raw);

  if(!iso){
    // vazio -> hoje
    if(!raw){
      iso = utils.todayISO();
      el.value = utils.isoToBR(iso);
    }else{
      return "";
    }
  }

  // sincroniza input date escondido
  if(isoEl) isoEl.value = iso;

  // persiste pra não "voltar" depois do atualizar
  try{ localStorage.setItem("dash_date_br", el.value); }catch(e){}

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



function bindDashboardDateInput(){
  const txt = document.getElementById("dash-mes");
  const iso = document.getElementById("dash-mes-iso");
  if(!txt || !iso) return;

  const calBtn = document.getElementById("dash-cal-btn");
  if(calBtn){
    calBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      try{
        // Chrome/Edge (e outros Chromium): abre o seletor nativo
        if (typeof iso.showPicker === "function") iso.showPicker();
        else { iso.focus(); iso.click(); }
      }catch(err){
        try{ iso.focus(); iso.click(); }catch(e2){}
      }
    });
  }

  // Máscara automática dd/mm/aaaa enquanto digita
  txt.addEventListener("input", ()=>{
    const digits = txt.value.replace(/\D/g, "");
    txt.value = brDigitsToBR(digits);
  });

  // Expande dd/mm/yy -> dd/mm/yyyy ao sair do campo
  txt.addEventListener("blur", ()=>{
    const expanded = expandYearIfNeeded(txt.value);
    if(expanded !== txt.value) txt.value = expanded;
    try{ localStorage.setItem("dash_date_br", txt.value); }catch(e){}
  });

  // Quando escolhe no calendário (input type=date), converte para dd/mm/aaaa
  iso.addEventListener("change", ()=>{
    const v = String(iso.value || "").trim(); // yyyy-mm-dd
    if(!v) return;
    const br = utils.isoToBR(v);
    if(br){
      txt.value = br;
      try{ localStorage.setItem("dash_date_br", br); }catch(e){}
    }
  });
}
window.dashboardRefresh = dashboardRefresh;
window.defaultMonthKey = defaultMonthKey;
window.bindDashboardDateInput = bindDashboardDateInput;
