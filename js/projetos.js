// js/projetos.js
(function(){
  const { db } = window.fb;
  const { badge, escapeHtml } = window.utils;

  const tbody = document.getElementById("projetos-tbody");
  const btnNew = document.getElementById("btn-novo-projeto");
  const monthEl = document.getElementById("mes-projetos");
  const btnRefresh = document.getElementById("btn-projetos-refresh");

  const modal = document.getElementById("modal-projeto");
  const mTitle = document.getElementById("modal-proj-title");
  const msgEl = document.getElementById("modal-proj-msg");

  const fId = document.getElementById("proj-id");
  const fData = document.getElementById("proj-data");
  const fTitulo = document.getElementById("proj-titulo");
  const fTipo = document.getElementById("proj-tipo");
  const fStatus = document.getElementById("proj-status");
  const fCliente = document.getElementById("proj-cliente");
  const fValor = document.getElementById("proj-valor");
  const fObs = document.getElementById("proj-obs");

  const btnSave = document.getElementById("proj-save");
  const btnCancel = document.getElementById("proj-cancel");

  function showMsg(text){
    msgEl.textContent = text || "";
    msgEl.style.display = text ? "block" : "none";
  }

  function getEmpresaCtx(){
    const empresaId = window.state?.empresaId;
    const uid = window.state?.uid;
    if(!empresaId || !uid) throw new Error("Sem contexto de empresa/usuário.");
    return { empresaId, uid };
  }

  function colRef(empresaId){
    return db.collection("empresas").doc(empresaId).collection("projetos");
  }

  function openModal(edit=false){
    modal.classList.add("open");
    showMsg("");
    if(!edit){
      mTitle.textContent = "Novo projeto";
      fId.value = "";
      fData.value = "";
      fTitulo.value = "";
      fTipo.value = "";
      fStatus.value = "";
      fCliente.value = "";
      fValor.value = "";
      fObs.value = "";
    }
  }

  function closeModal(){
    modal.classList.remove("open");
  }

  async function loadProjectsForMonth(monthKey){
    const { empresaId } = getEmpresaCtx();

    const normalized = window.utils.normalizeMonthKey(monthKey);
    if(!normalized){
      tbody.innerHTML = `<tr><td colspan="7">Mês inválido. Use mm/aaaa (ex: 01/2026).</td></tr>`;
      return;
    }
    monthEl.value = normalized;

    const range = window.utils.monthKeyToRange(normalized);
    if(!range){
      tbody.innerHTML = `<tr><td colspan="7">Mês inválido.</td></tr>`;
      return;
    }

    const { startISO, endISOExclusive } = range;

    const snap = await colRef(empresaId)
      .where("dataISO", ">=", startISO)
      .where("dataISO", "<", endISOExclusive)
      .orderBy("dataISO", "asc")
      .get();

    if(snap.empty){
      tbody.innerHTML = `<tr><td colspan="7">Nenhum projeto neste mês.</td></tr>`;
      return;
    }

    let html = "";
    snap.forEach(doc=>{
      const p = doc.data();
      const dataBR = window.utils.isoToBR(p.dataISO) || (p.dataBR || "");
      const valor = window.utils.formatBRL(p.valor || 0);
      html += `
        <tr>
          <td>${escapeHtml(dataBR)}</td>
          <td>${escapeHtml(p.titulo || "")}</td>
          <td>${escapeHtml(p.tipo || "")}</td>
          <td>${badge(escapeHtml(p.status || ""), "info")}</td>
          <td>${escapeHtml(p.cliente || "")}</td>
          <td style="text-align:right">${valor}</td>
          <td class="actions">
            <button class="btn small" data-act="edit" data-id="${doc.id}">Editar</button>
            <button class="btn small danger" data-act="del" data-id="${doc.id}">Excluir</button>
          </td>
        </tr>`;
    });

    tbody.innerHTML = html;
  }

  async function openEdit(id){
    const { empresaId } = getEmpresaCtx();
    showMsg("");

    const doc = await colRef(empresaId).doc(id).get();
    if(!doc.exists){
      showMsg("Projeto não encontrado.");
      return;
    }
    const p = doc.data();
    mTitle.textContent = "Editar projeto";
    fId.value = doc.id;
    fData.value = window.utils.isoToBR(p.dataISO) || (p.dataBR || "");
    fTitulo.value = p.titulo || "";
    fTipo.value = p.tipo || "";
    fStatus.value = p.status || "";
    fCliente.value = p.cliente || "";
    fValor.value = (p.valor != null) ? String(p.valor).replace(".", ",") : "";
    fObs.value = p.obs || "";
    modal.classList.add("open");
  }

  async function saveProject(){
    const { empresaId, uid } = getEmpresaCtx();

    const id = (fId.value || "").trim();
    const dataBR = (fData.value || "").trim();
    const dataISO = window.utils.brToISO(dataBR);

    const titulo = (fTitulo.value || "").trim();
    const tipo = (fTipo.value || "").trim();
    const status = (fStatus.value || "").trim();
    const cliente = (fCliente.value || "").trim();
    const valor = window.utils.parseBRL(fValor.value || "");
    const obs = (fObs.value || "").trim();

    if(!titulo || !tipo || !status || !dataBR){
      showMsg("Preencha Data, Título, Tipo e Status.");
      return;
    }
    if(!dataISO){
      showMsg("Data inválida. Use dd/mm/aaaa (ex: 07/01/2026).");
      return;
    }

    const payload = {
      dataBR,
      dataISO,
      titulo,
      tipo,
      status,
      cliente,
      valor,
      obs,
      updatedAt: window.fb.serverTimestamp(),
      updatedBy: uid,
    };

    try{
      if(id){
        await colRef(empresaId).doc(id).update(payload);
      }else{
        await colRef(empresaId).add({
          ...payload,
          createdAt: window.fb.serverTimestamp(),
          createdBy: uid,
        });
      }
      closeModal();
      await loadProjectsForMonth(monthEl.value);
    }catch(err){
      console.error(err);
      showMsg(err?.message || "Erro ao salvar.");
    }
  }

  async function deleteProject(id){
    const { empresaId } = getEmpresaCtx();
    if(!confirm("Excluir este projeto?")) return;
    await colRef(empresaId).doc(id).delete();
    await loadProjectsForMonth(monthEl.value);
  }

  // listeners
  btnNew?.addEventListener("click", ()=> openModal(false));
  btnCancel?.addEventListener("click", closeModal);
  btnSave?.addEventListener("click", saveProject);

  btnRefresh?.addEventListener("click", ()=> loadProjectsForMonth(monthEl.value));

  tbody?.addEventListener("click", async (e)=>{
    const btn = e.target.closest("button[data-act]");
    if(!btn) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;
    if(act === "edit") await openEdit(id);
    if(act === "del") await deleteProject(id);
  });

  // init
  window.addEventListener("app:ready", ()=>{
    if(!monthEl.value) monthEl.value = window.utils.normalizeMonthKey(`${window.utils.pad2(new Date().getMonth()+1)}/${new Date().getFullYear()}`);
    loadProjectsForMonth(monthEl.value);
  });
})();
