// js/projetos.js
(function () {
  const { db, serverTimestamp } = window.fb || {};
  if (!db) {
    console.error("[projetos] Firestore não inicializado. Confira js/firebase.js e os <script> no index.html.");
    return;
  }

  const elProj = {
    section: document.getElementById("sec-projetos"),
    monthInput: document.getElementById("projetos-mes"),
    btnRefresh: document.getElementById("btn-projetos-refresh"),
    btnOpen: document.getElementById("btn-projeto-open") || document.getElementById("btn-open-projeto"),
    tbody: document.getElementById("projetos-tbody"),

    modal: document.getElementById("modal-projeto"),
    formId: document.getElementById("projeto-id"),
    inpData: document.getElementById("projeto-data"),
    inpTitulo: document.getElementById("projeto-titulo"),
    selTipo: document.getElementById("projeto-tipo"),
    selStatus: document.getElementById("projeto-status"),
    selCliente: document.getElementById("projeto-cliente"),
    inpValor: document.getElementById("projeto-valor"),

    btnSalvar: document.getElementById("btn-projeto-salvar"),
    btnCancelar: document.getElementById("btn-projeto-cancelar"),
    msg: document.getElementById("projeto-msg"),
  };
  // Helpers de data (dd/mm/aaaa)
  function pad2(n){ return String(n).padStart(2, "0"); }

  function brToISOFlex(input){
    // Aceita:
    // - dd/mm/aaaa  ou dd/mm/aaaaaa (também com hífen)
    // - yyyy-mm-dd (e yyyy-mm-ddTHH:mm...)
    if(!input) return "";
    const s = String(input).trim();
    if(!s) return "";

    // ISO
    let mm = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
    if(mm){
      const yyyy = Number(mm[1]), mo = Number(mm[2]), dd = Number(mm[3]);
      const d = new Date(Date.UTC(yyyy, mo-1, dd));
      if(d.getUTCFullYear()!==yyyy || (d.getUTCMonth()+1)!==mo || d.getUTCDate()!==dd) return "";
      return `${yyyy}-${pad2(mo)}-${pad2(dd)}`;
    }

    // BR
    mm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);
    if(!mm) return "";
    const dd = Number(mm[1]);
    const mo = Number(mm[2]);
    let yyyy = Number(mm[3]);
    if(String(mm[3]).length === 2) yyyy = 2000 + yyyy;

    const d = new Date(Date.UTC(yyyy, mo-1, dd));
    if(d.getUTCFullYear()!==yyyy || (d.getUTCMonth()+1)!==mo || d.getUTCDate()!==dd) return "";
    return `${yyyy}-${pad2(mo)}-${pad2(dd)}`;
  }

  function isoToBRShort(iso){
    const m2 = String(iso||"").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if(!m2) return "";
    const yyyy = m2[1], mo = pad2(m2[2]), dd = pad2(m2[3]);
    return `${dd}/${mo}/${yyyy.slice(-2)}`;
  }

  function monthKeyFromAny(input){
    const s = String(input||"").trim();
    if(!s) return "";

    // MM/AAAA (compat)
    const mk = window.utils?.normalizeMonthKey?.(s);
    if(mk) return mk;

    // dd/mm/aaaa -> pega mês
    const iso = brToISOFlex(s);
    if(!iso) return "";
    const m3 = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m3) return "";
    return `${m3[2]}/${m3[1]}`;
  }

  function monthKeyToInput(monthKey){
    const m = String(monthKey||"").match(/^(\d{2})\/(\d{4})$/);
    if(!m) return "";
    return `01/${m[1]}/${m[2]}`;
  }

  function maskDateDDMMYYYY(inputEl){
    if(!inputEl) return;
    // Aqui a data do projeto é exibida como dd/mm/aa (para combinar com a tabela)
    // e aceita digitação só em números (ex: 100126 -> 10/01/26).
    inputEl.addEventListener("input", ()=>{
      const digits = String(inputEl.value||"").replace(/\D/g,"").slice(0,6); // ddmmyy
      let out = digits;
      if(digits.length > 2) out = digits.slice(0,2) + "/" + digits.slice(2);
      if(digits.length > 4) out = out.slice(0,5) + "/" + out.slice(5);
      inputEl.value = out;
    });
  }


  function projetosSetMsg(text) {
    if (!elProj.msg) return;
    elProj.msg.textContent = text || "";
  }

  function isoToMonthKey(iso) {
    // "YYYY-MM-DD" => "MM/YYYY"
    if (!iso || typeof iso !== "string" || iso.length < 7) return "";
    const parts = iso.split("-");
    if (parts.length < 2) return "";
    const y = parts[0];
    const m = parts[1];
    return `${m}/${y}`;
  }

  function projetosOpenModal(prefill = {}) {
    projetosSetMsg("");

    elProj.formId.value = prefill.id || "";
    elProj.inpData.value = prefill.dataBR || "";
    elProj.inpTitulo.value = prefill.titulo || "";
    elProj.selTipo.value = prefill.tipo || "video";
    elProj.selStatus.value = prefill.status || "novo";
    elProj.inpValor.value = (typeof prefill.valor === "number") ? String(prefill.valor) : (prefill.valor || "");

    elProj.modal.classList.remove("hidden");
    projetosFillClientesSelect(prefill.clienteId || "").catch((err) => {
      console.error(err);
      projetosSetMsg("Erro ao carregar clientes. Veja o Console (F12).");
    });
  }

  function projetosCloseModal() {
    elProj.modal.classList.add("hidden");
  }

  async function projetosFillClientesSelect(selectedId = "") {
    elProj.selCliente.innerHTML = `<option value="">Selecione...</option>`;

    if (!window.state?.empresaId) {
      projetosSetMsg("Empresa não definida. Faça logout e login novamente.");
      return;
    }

    const snap = await db
      .collection("empresas")
      .doc(window.state.empresaId)
      .collection("clientes")
      .orderBy("nome", "asc")
      .get();

    snap.forEach((doc) => {
      const d = doc.data();
      // Se você quiser permitir lead também, remova esse if.
      if (d.tipo && d.tipo !== "cliente") return;

      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.textContent = d.nome || "(sem nome)";
      elProj.selCliente.appendChild(opt);
    });

    if (selectedId) elProj.selCliente.value = selectedId;
  }

  function projetosRenderRow(doc) {
    const d = doc.data();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${isoToBRShort(d.dataISO) || "-"}</td>
      <td>${d.titulo || "-"}</td>
      <td>${d.tipo || "-"}</td>
      <td>${d.status || "-"}</td>
      <td>${d.clienteNome || "-"}</td>
      <td>${window.utils?.formatBRL(d.valor || 0) || "R$ 0,00"}</td>
      <td>
        <button class="btn btn-small" data-act="edit">Editar</button>
        <button class="btn btn-small btn-danger" data-act="del">Excluir</button>
      </td>
    `;

    tr.querySelector('[data-act="edit"]').addEventListener("click", async () => {
      projetosSetMsg("");

      projetosOpenModal({
        id: doc.id,
        dataBR: isoToBRShort(d.dataISO) || "",
        titulo: d.titulo || "",
        tipo: d.tipo || "video",
        status: d.status || "novo",
        clienteId: d.clienteId || "",
        valor: d.valor || 0,
      });
    });

    tr.querySelector('[data-act="del"]').addEventListener("click", async () => {
      if (!confirm("Excluir este serviço?")) return;

      try {
        await db
          .collection("empresas")
          .doc(window.state.empresaId)
          .collection("projetos")
          .doc(doc.id)
          .delete();

        await projetosRefresh();
        if (typeof window.refreshSelectorsClientsAndProjects === "function") {
          window.refreshSelectorsClientsAndProjects();
        }
      } catch (err) {
        console.error(err);
        alert("Erro ao excluir. Veja o Console (F12).");
      }
    });

    return tr;
  }

  async function projetosRefresh() {
    projetosSetMsg("");

    if (!window.state?.empresaId) {
      projetosSetMsg("Empresa não definida. Faça logout e login novamente.");
      return;
    }

    const monthKey = monthKeyFromAny(elProj.monthInput.value);

    const range = window.utils?.monthKeyToRange(monthKey);

    if (!range) {
      projetosSetMsg("Mês inválido. Use dd/mm/aaaaaa (ex: 15/01/2026) ou MM/AAAA (ex: 01/2026).");
      return;
    }

    // Mantém o input sempre em dd/mm/aaaa (primeiro dia do mês)
    const fixed = monthKeyToInput(monthKey);
    if(fixed) elProj.monthInput.value = fixed;
const { startISO, endISOExclusive } = range;

    elProj.tbody.innerHTML = `<tr><td colspan="7">Carregando...</td></tr>`;

    try {
      const snap = await db
        .collection("empresas")
        .doc(window.state.empresaId)
        .collection("projetos")
        .where("dataISO", ">=", startISO)
        .where("dataISO", "<", endISOExclusive)
        .orderBy("dataISO", "asc")
        .get();

      elProj.tbody.innerHTML = "";

      if (snap.empty) {
        elProj.tbody.innerHTML = `<tr><td colspan="7">Nenhum projeto neste mês.</td></tr>`;
        return;
      }

      snap.forEach((doc) => elProj.tbody.appendChild(projetosRenderRow(doc)));
    } catch (err) {
      console.error(err);
      elProj.tbody.innerHTML = `<tr><td colspan="7">Erro ao carregar. Veja o Console (F12).</td></tr>`;
    }
  }

  async function projetosSave() {
    projetosSetMsg("");

    try {
      if (!window.state?.empresaId) {
        throw new Error("Empresa não definida (empresaId vazio). Faça logout e login novamente.");
      }

      const id = elProj.formId.value.trim();
      const dataBR = elProj.inpData.value.trim();
      const dataISO = brToISOFlex(dataBR);

      const titulo = elProj.inpTitulo.value.trim();
      const tipo = elProj.selTipo.value;
      const status = elProj.selStatus.value;
      const clienteId = elProj.selCliente.value;
      const valor = window.utils?.parseBRL(elProj.inpValor.value);

      if (!dataISO) throw new Error("Data inválida (dd/mm/aaaaaa).");
      if (!titulo) throw new Error("Informe um título.");
      if (!clienteId) throw new Error("Selecione um cliente.");

      // Busca nome do cliente
      const clienteDoc = await db
        .collection("empresas")
        .doc(window.state.empresaId)
        .collection("clientes")
        .doc(clienteId)
        .get();

      const clienteNome = clienteDoc.exists ? (clienteDoc.data().nome || "") : "";

      const base = {
        dataISO,
        titulo,
        tipo,
        status,
        clienteId,
        clienteNome,
        valor: Number.isFinite(valor) ? valor : 0,
        updatedAt: serverTimestamp(),
      };

      const col = db.collection("empresas").doc(window.state.empresaId).collection("projetos");

      if (id) {
        await col.doc(id).update(base);
      } else {
        base.createdAt = serverTimestamp();
        await col.add(base);
      }

      // 🔥 UX: ajusta o filtro de mês para o mês do projeto salvo
      const mk = isoToMonthKey(dataISO);
      if (mk && elProj.monthInput) {
        const fixed = monthKeyToInput(mk);
        if(fixed) elProj.monthInput.value = fixed;
      }

      await projetosRefresh();

      if (typeof window.refreshSelectorsClientsAndProjects === "function") {
        window.refreshSelectorsClientsAndProjects();
      }

      projetosCloseModal();
    } catch (err) {
      console.error(err);
      projetosSetMsg(err?.message || "Erro ao salvar. Veja o Console (F12).");
      // NÃO fecha o modal em erro
    }
  }

  
  function bindProjetosDateInput(){
    const txt = document.getElementById("projetos-mes");
    const iso = document.getElementById("projetos-mes-iso");
    if(!txt || !iso) return;

    // Ao sair do campo, fixa no "primeiro dia do mês" (dd/mm/aaaa)
    txt.addEventListener("blur", ()=>{
      const mk = monthKeyFromAny(txt.value);
      const fixed = monthKeyToInput(mk);
      if(fixed) txt.value = fixed;

      const isoV = brToISOFlex(txt.value);
      if(isoV) iso.value = isoV;
      try{ localStorage.setItem("projetos_date_br", txt.value); }catch(e){}
    });

    // Se escolheu no calendário, converte para dd/mm/aaaa e salva
    iso.addEventListener("change", ()=>{
      const v = String(iso.value||"").trim(); // yyyy-mm-dd
      if(!v) return;
      const br = window.utils?.isoToBR?.(v);
      if(br){
        txt.value = br;
        try{ localStorage.setItem("projetos_date_br", br); }catch(e){}
      }
    });
  }

// Ajustes de inputs (datas em dd/mm/aaaa)
  if (elProj.monthInput) {
    elProj.monthInput.addEventListener("blur", ()=>{
      const mk = monthKeyFromAny(elProj.monthInput.value);
      const fixed = monthKeyToInput(mk);
      if(fixed) elProj.monthInput.value = fixed;
    });
  }
  bindProjetosDateInput();

  maskDateDDMMYYYY(elProj.inpData);

// Eventos
  if (elProj.btnOpen) elProj.btnOpen.addEventListener("click", () => projetosOpenModal());
  if (elProj.btnRefresh) elProj.btnRefresh.addEventListener("click", projetosRefresh);
  if (elProj.btnSalvar) elProj.btnSalvar.addEventListener("click", projetosSave);
  if (elProj.btnCancelar) elProj.btnCancelar.addEventListener("click", projetosCloseModal);

  elProj.modal.addEventListener("click", (e) => {
    if (e.target === elProj.modal) projetosCloseModal();
  });

  // Expor refresh (usado em app.js ao trocar de aba)
  window.projetosRefresh = projetosRefresh;
})();
