// Endereço do Google Apps Script (o mesmo do halloween.html).
// Enquanto estiver vazio, a votação funciona em MODO TESTE: guarda só neste telemóvel e mostra resultados falsos.
const ENDPOINT = "https://script.google.com/macros/s/AKfycbzkDekJna7Yb_CBh2rxkVyHN9RcO0ScqDrl5lkEHzeDCuQwaZQSoLLWODxv9lhvbc-5/exec";

// A votação fecha no fim de 25/10/2026 (hora de Lisboa).
const VOTACAO_FECHA = new Date("2026-10-26T00:00:00Z");

// Ordena as datas pelo dia; "Em qualquer altura" (data null) fica no fim.
function ordenarDatas(datas) {
  return datas.slice().sort((a, b) => (a.data || "9999") < (b.data || "9999") ? -1 : 1);
}

const TIPO = { angariacao: "💰 Angaria dinheiro", ludica: "🎈 Diversão", ambas: "💰🎈 As duas" };
const ESFORCO = { 1: "●○○ Fácil", 2: "●●○ Médio", 3: "●●● Muito trabalho" };

function escapar(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
