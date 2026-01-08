// js/tenant.js
const elTenant = {
  modal: document.getElementById("modal-empresa"),
  nomeInput: document.getElementById("empresa-nome-input"),
  msg: document.getElementById("empresa-msg"),
  btnCriar: document.getElementById("btn-criar-empresa"),
  btnSair: document.getElementById("btn-empresa-sair"),
};

function setEmpresaMsg(t){ elTenant.msg.textContent = t || ""; }

function openEmpresaModal(){
  elTenant.modal.classList.remove("hidden");
  elTenant.nomeInput.focus();
}

function closeEmpresaModal(){
  elTenant.modal.classList.add("hidden");
}

async function tenantResolveOrPrompt(){
  // estratégia simples de SaaS:
  // - root doc: usuarios/{uid} com { empresaId, role }
  // - também cria empresas/{empresaId}/usuarios/{uid} como membership
  const uid = state.user.uid;

  const userDocRef = fb.db.collection("usuarios").doc(uid);
  const snap = await userDocRef.get();

  if(snap.exists && snap.data()?.empresaId){
    state.empresaId = snap.data().empresaId;
    // carrega nome da empresa
    const empSnap = await fb.db.collection("empresas").doc(state.empresaId).get();
    state.empresaNome = empSnap.data()?.nomeFantasia || "Empresa";
    document.getElementById("empresa-nome").textContent = state.empresaNome;
    return true;
  }

  // sem empresa: pedir criar
  setEmpresaMsg("");
  elTenant.nomeInput.value = "";
  openEmpresaModal();

  return await new Promise((resolve)=>{
    const onCreate = async ()=>{
      const nome = elTenant.nomeInput.value.trim();
      if(!nome) return setEmpresaMsg("Informe um nome.");
      setEmpresaMsg("Criando...");

      try{
        const empRef = fb.db.collection("empresas").doc(); // gera id
        const empresaId = empRef.id;

        const batch = fb.db.batch();

        batch.set(empRef, {
          nomeFantasia: nome,
          ownerUid: uid,
          plano: "free",
          createdAt: fb.serverTimestamp(),
          updatedAt: fb.serverTimestamp(),
        });

        batch.set(empRef.collection("usuarios").doc(uid), {
          role: "owner",
          nome: state.user.displayName || "",
          email: state.user.email || "",
          ativo: true,
          createdAt: fb.serverTimestamp(),
        });

        batch.set(userDocRef, {
          empresaId,
          role: "owner",
          createdAt: fb.serverTimestamp(),
          updatedAt: fb.serverTimestamp(),
        });

        await batch.commit();

        state.empresaId = empresaId;
        state.empresaNome = nome;
        document.getElementById("empresa-nome").textContent = nome;

        closeEmpresaModal();
        cleanup();
        resolve(true);
      }catch(err){
        setEmpresaMsg(err?.message || "Erro ao criar empresa.");
      }
    };

    const onExit = async ()=>{
      cleanup();
      closeEmpresaModal();
      resolve(false);
    };

    const cleanup = ()=>{
      elTenant.btnCriar.removeEventListener("click", onCreate);
      elTenant.btnSair.removeEventListener("click", onExit);
    };

    elTenant.btnCriar.addEventListener("click", onCreate);
    elTenant.btnSair.addEventListener("click", onExit);
  });
}

window.tenantResolveOrPrompt = tenantResolveOrPrompt;
