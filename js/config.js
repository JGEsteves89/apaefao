// Endereço do Google Apps Script (o mesmo do halloween.html). Recebe os formulários do site.
const ENDPOINT = "https://script.google.com/macros/s/AKfycbzkDekJna7Yb_CBh2rxkVyHN9RcO0ScqDrl5lkEHzeDCuQwaZQSoLLWODxv9lhvbc-5/exec";

function escapar(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Mostrar valores em € na página das metas (precisa do OK da Direção).
const MOSTRAR_EUROS = true;
// MB WAY da APAEF (número de telemóvel). Vazio = a opção MB WAY não aparece.
const MBWAY_NUMERO = "";
// Referência Multibanco: só com contrato Eupago/ifthenpay. false = não aparece.
const REFERENCIA_MB = false;
// MB WAY e Multibanco automáticos (Eupago/ifthenpay através do Apps Script). false = só transferência (e MB WAY manual se houver MBWAY_NUMERO).
const PAGAMENTOS_ONLINE = false;
