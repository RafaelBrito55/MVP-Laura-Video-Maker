// js/utils.js
function pad2(n){ return String(n).padStart(2, "0"); }

function isValidDateParts(yyyy, mm, dd){
  if(!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return false;
  if(yyyy < 1900 || yyyy > 3000) return false;
  if(mm < 1 || mm > 12) return false;
  if(dd < 1 || dd > 31) return false;

  // valida de verdade (31/04 etc)
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return (
    d.getUTCFullYear() === yyyy &&
    (d.getUTCMonth() + 1) === mm &&
    d.getUTCDate() === dd
  );
}

function brToISO(input){
  // Aceita:
  // - dd/mm/aaaa, d/m/aaaa, dd-m-aaaa etc
  // - aaaa-mm-dd (e aaaa-mm-ddTHH:mm...)
  if(!input) return "";

  const s = String(input).trim();
  if(!s) return "";

  // ISO: 2026-01-07 ou 2026-1-7 ou 2026-01-07T...
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if(m){
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    if(!isValidDateParts(yyyy, mm, dd)) return "";
    return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
  }

  // BR: 7/1/2026, 07/01/2026, 7-01-2026 etc
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(!m) return "";

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);

  if(!isValidDateParts(yyyy, mm, dd)) return "";
  return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
}

function isoToBR(iso){
  // aceita yyyy-mm-dd (com ou sem zero padding)
  if(!iso) return "";
  const s = String(iso).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(!m) return "";
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if(!isValidDateParts(yyyy, mm, dd)) return "";
  return `${pad2(dd)}/${pad2(mm)}/${yyyy}`;
}

function normalizeMonthKey(monthKey){
  // Aceita "1/2026" ou "01/2026" -> retorna sempre "01/2026"
  const s = String(monthKey || "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if(!m) return "";
  const mm = Number(m[1]);
  const yyyy = Number(m[2]);
  if(mm < 1 || mm > 12) return "";
  return `${pad2(mm)}/${yyyy}`;
}

function monthKeyToRange(monthKey){
  // monthKey "01/2026" -> {startISO, endISOExclusive}
  const mk = normalizeMonthKey(monthKey);
  if(!mk) return null;

  const m = mk.match(/^(\d{2})\/(\d{4})$/);
  const mm = Number(m[1]), yyyy = Number(m[2]);

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
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth()+1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

window.utils = {
  pad2, brToISO, isoToBR, normalizeMonthKey, monthKeyToRange,
  formatBRL, parseBRL, badge, escapeHtml, todayISO
};
