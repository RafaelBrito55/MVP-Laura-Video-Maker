// js/utils.js
function pad2(n){ return String(n).padStart(2, "0"); }

function brToISO(br){
  // dd/mm/aaaa -> aaaa-mm-dd
  if(!br) return "";
  const m = br.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m) return "";
  const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
  if(mm < 1 || mm > 12) return "";
  if(dd < 1 || dd > 31) return "";
  return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
}

function isoToBR(iso){
  // aaaa-mm-dd -> dd/mm/aaaa
  if(!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function monthKeyToRange(monthKey){
  // monthKey "01/2026" -> {startISO, endISOExclusive}
  const m = (monthKey || "").trim().match(/^(\d{2})\/(\d{4})$/);
  if(!m) return null;
  const mm = Number(m[1]), yyyy = Number(m[2]);
  if(mm < 1 || mm > 12) return null;
  const start = new Date(Date.UTC(yyyy, mm-1, 1));
  const end = new Date(Date.UTC(yyyy, mm, 1));
  const toISODate = (d)=> `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}`;
  return { startISO: toISODate(start), endISOExclusive: toISODate(end) };
}

function formatBRL(value){
  const v = Number(value || 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBRL(input){
  // aceita "1500,00", "1.500,00", "R$ 1.500,00"
  if(input === null || input === undefined) return 0;
  let s = String(input).trim();
  if(!s) return 0;
  s = s.replace(/[R$\s]/g, "");
  s = s.replace(/\./g, "");
  s = s.replace(",", ".");
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
}

function badge(text, kind){
  const cls = kind ? `badge ${kind}` : "badge";
  return `<span class="${cls}">${text}</span>`;
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function todayISO(){
  const d = new Date();
  // local date -> ISO date
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth()+1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

window.utils = {
  pad2, brToISO, isoToBR, monthKeyToRange,
  formatBRL, parseBRL, badge, escapeHtml, todayISO
};
