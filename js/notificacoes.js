// js/notificacoes.js
const elNotif = {
  list: document.getElementById("notif-list"),
  filtro: document.getElementById("notif-filtro"),
  btnRefresh: document.getElementById("btn-notif-refresh"),
  btnOpen: document.getElementById("btn-open-notif"),

  modal: document.getElementById("modal-notif"),
  title: document.getElementById("notif-modal-title"),
  msg: document.getElementById("notif-msg"),
  btnClose: document.getElementById("btn-close-notif"),
  btnSave: document.getElementById("btn-save-notif"),
  btnDel: document.getElementById("btn-del-notif"),

  titulo: document.getElementById("notif-titulo"),
  data: document.getElementById("notif-data"),
  prioridade: document.getElementById("notif-prioridade"),
  desc: document.getElementById("notif-desc"),
};

let editingNotifId = null;

function notifOpenModal(notif){
  elNotif.modal.classList.remove("hidden");
  elNotif.msg.textContent = "";

  if(notif){
    editingNotifId = notif.id;
    elNotif.title.textContent = "Editar notificação";
    elNotif.btnDel.classList.remove("hidden");

    const d = notif.data;
    elNotif.titulo.value = d.titulo || "";
    elNotif.data.value = utils.isoToBR(d.dueDateISO || "");
    elNotif.prioridade.value = d.prioridade || "media";
    elNotif.desc.value = d.descricao || "";
  }else{
    editingNotifId = null;
    elNotif.title.textContent = "Nova notificação";
    elNotif.btnDel.classList.add("hidden");

    elNotif.titulo.value = "";
    elNotif.data.value = "";
    elNotif.prioridade.value = "media";
    elNotif.desc.value = "";
  }
}

function notifCloseModal(){ elNotif.modal.classList.add("hidden"); }
function setNotifMsg(t){ elNotif.msg.textContent = t || ""; }

async function notifSave(){
  setNotifMsg("");
  const titulo = elNotif.titulo.value.trim();
  const dueISO = utils.brToISO(elNotif.data.value.trim());
  if(!titulo) return setNotifMsg("Informe o título.");
  if(elNotif.data.value.trim() && !dueISO) return setNotifMsg("Data inválida. Use dd/mm/aaaa.");
  if(!dueISO) return setNotifMsg("Informe a data.");

  const data = {
    key: editingNotifId ? undefined : "", // manual não precisa
    titulo,
    descricao: elNotif.desc.value.trim(),
    tipo: "lembrete",
    refTipo: "",
    refId: "",
    dueDateISO: dueISO,
    prioridade: elNotif.prioridade.value,
    status: "aberta",
    updatedAt: fb.serverTimestamp(),
  };

  const col = fb.db.collection("empresas").doc(state.empresaId).collection("notificacoes");
  try{
    if(editingNotifId){
      // não sobrescrever key se existir
      const update = { ...data };
      delete update.key;
      await col.doc(editingNotifId).update(update);
    }else{
      await col.add({ ...data, createdAt: fb.serverTimestamp() });
    }

    notifCloseModal();
    await notificacoesRefresh();
    await dashboardRefresh();
  }catch(err){
    setNotifMsg(err?.message || "Erro ao salvar.");
  }
}

async function notifDelete(){
  if(!editingNotifId) return;
  if(!confirm("Excluir esta notificação?")) return;
  const col = fb.db.collection("empresas").doc(state.empresaId).collection("notificacoes");
  await col.doc(editingNotifId).delete();
  notifCloseModal();
  await notificacoesRefresh();
  await dashboardRefresh();
}

async function notificacoesRefresh(){
  const filtro = elNotif.filtro.value;
  const col = fb.db.collection("empresas").doc(state.empresaId).collection("notificacoes");

  let q = col.orderBy("dueDateISO", "asc");
  if(filtro === "abertas") q = col.where("status", "==", "aberta").orderBy("dueDateISO", "asc");
  if(filtro === "concluidas") q = col.where("status", "==", "concluida").orderBy("dueDateISO", "asc");

  const snap = await q.limit(80).get();
  elNotif.list.innerHTML = "";

  if(snap.empty){
    elNotif.list.innerHTML = `<p class="muted">Nenhuma notificação.</p>`;
    return;
  }

  const today = utils.todayISO();

  snap.forEach(doc=>{
    const n = doc.data();
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "10px";

    const isLate = n.status === "aberta" && n.dueDateISO && n.dueDateISO < today;
    const pri = n.prioridade === "alta" ? "danger" : (n.prioridade === "media" ? "warn" : "ok");
    const lateBadge = isLate ? utils.badge("Atrasada", "danger") : "";

    card.innerHTML = `
      <div class="row spread">
        <div>
          <b>${utils.escapeHtml(n.titulo)}</b>
          <div class="muted small" style="margin-top:4px">${utils.escapeHtml(n.descricao || "")}</div>
        </div>
        <div style="text-align:right">
          <div>${utils.badge(utils.isoToBR(n.dueDateISO || ""), pri)}</div>
          <div style="margin-top:6px">${lateBadge}</div>
        </div>
      </div>

      <div class="row gap" style="margin-top:12px">
        ${n.status === "aberta" ? `<button class="btn" data-action="done" data-id="${doc.id}">Concluir</button>` : ""}
        <button class="btn" data-action="edit" data-id="${doc.id}">Editar</button>
        <button class="btn danger" data-action="del" data-id="${doc.id}">Excluir</button>
      </div>
    `;

    elNotif.list.appendChild(card);
  });

  elNotif.list.querySelectorAll("button[data-action='done']").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      await fb.db.collection("empresas").doc(state.empresaId).collection("notificacoes")
        .doc(btn.dataset.id).update({ status: "concluida", updatedAt: fb.serverTimestamp() });
      await notificacoesRefresh();
      await dashboardRefresh();
    });
  });

  elNotif.list.querySelectorAll("button[data-action='edit']").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.id;
      const doc = await fb.db.collection("empresas").doc(state.empresaId).collection("notificacoes").doc(id).get();
      notifOpenModal({ id, data: doc.data() });
    });
  });

  elNotif.list.querySelectorAll("button[data-action='del']").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.id;
      if(!id) return;
      if(!confirm("Excluir esta notificação?")) return;
      await fb.db.collection("empresas").doc(state.empresaId).collection("notificacoes").doc(id).delete();
      await notificacoesRefresh();
      await dashboardRefresh();
    });
  });
}

elNotif.btnOpen.addEventListener("click", ()=> notifOpenModal(null));
elNotif.btnClose.addEventListener("click", notifCloseModal);
elNotif.btnSave.addEventListener("click", notifSave);
elNotif.btnDel.addEventListener("click", notifDelete);
elNotif.btnRefresh.addEventListener("click", notificacoesRefresh);

window.notificacoesRefresh = notificacoesRefresh;
