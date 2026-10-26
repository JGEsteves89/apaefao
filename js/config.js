// Endereço do Google Apps Script (o mesmo do halloween.html). Recebe os formulários do site.
const ENDPOINT = "https://script.google.com/macros/s/AKfycbzkDekJna7Yb_CBh2rxkVyHN9RcO0ScqDrl5lkEHzeDCuQwaZQSoLLWODxv9lhvbc-5/exec";

function escapar(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
