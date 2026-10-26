// Peças comuns às páginas: menu, ler JSON, animar ao aparecer, enviar formulários.
// Precisa do js/config.js antes (ENDPOINT e escapar).

const MOVIMENTO = !matchMedia("(prefers-reduced-motion: reduce)").matches;

// Modo teste: só sem ENDPOINT. Com ENDPOINT, os formulários enviam sempre (também no computador).
const MODO_TESTE = !ENDPOINT;

const espera = ms => new Promise(r => setTimeout(r, ms));

// Menu: marca a página atual. No telemóvel, o botão "☰ Menu" abre e fecha o painel.
(function () {
  const menu = document.querySelector(".menu");
  const botao = document.querySelector(".menu-botao");
  if (!menu) return;
  const pagina = location.pathname.split("/").pop() || "index.html";
  menu.querySelectorAll("a").forEach(a => {
    if (a.pathname.split("/").pop() === pagina && !a.hash) a.setAttribute("aria-current", "page");
  });
  if (!botao) return;
  const abrir = sim => {
    botao.setAttribute("aria-expanded", sim);
    document.body.classList.toggle("menu-aberto", sim);
  };
  botao.addEventListener("click", () => abrir(botao.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", e => { if (e.target.closest("a")) abrir(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") abrir(false); });
})();

// Lê um ficheiro de data/. Se falhar, deixa uma mensagem simpática no sítio.
async function carregarJSON(url, el) {
  try {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch (e) {
    if (el) el.innerHTML = '<p class="vazio">Ainda não há nada aqui 🙂 Volta daqui a uns dias.</p>';
    return null;
  }
}

// Junta a classe "visivel" quando o elemento entra no ecrã (as animações dependem dela).
function aoAparecer(raiz) {
  const els = (raiz || document).querySelectorAll(".anima:not(.visivel)");
  if (!MOVIMENTO || !("IntersectionObserver" in window)) {
    els.forEach(e => e.classList.add("visivel"));
    return;
  }
  const io = new IntersectionObserver(entradas => entradas.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("visivel");
    io.unobserve(e.target);
  }), { threshold: 0.2 });
  els.forEach(e => io.observe(e));
}

// Faixa discreta no topo quando estamos em modo teste.
function avisoTeste() {
  if (!MODO_TESTE || document.querySelector(".faixa-teste")) return;
  const f = document.createElement("div");
  f.className = "faixa-teste";
  f.textContent = "Modo teste: o formulário não envia nada.";
  document.body.prepend(f);
}

// Envia um formulário para o Google Apps Script. Em modo teste, só finge.
async function enviar(evento, dados) {
  const corpo = Object.assign({ evento: evento, enviadoEm: new Date().toISOString() }, dados);
  if (MODO_TESTE) {
    console.log("Modo teste — não enviado:", corpo);
    await espera(400);
    return true;
  }
  try {
    await fetch(ENDPOINT, { method: "POST", mode: "no-cors", body: JSON.stringify(corpo) });
    return true;
  } catch (e) {
    return false;
  }
}

// Copia um texto e mostra um ✓ no botão.
async function copiar(texto, botao) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch (e) {
    const t = document.createElement("textarea");
    t.value = texto; document.body.appendChild(t); t.select();
    document.execCommand("copy"); t.remove();
  }
  botao.classList.add("copiado");
  setTimeout(() => botao.classList.remove("copiado"), 1600);
}

// Confetti leve com as cores do tema.
function confetti() {
  if (!MOVIMENTO) return;
  const cores = ["#ebce58", "#c9a72c", "#1f1a14", "#f2a65a", "#8cc7d9"];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement("span");
    c.className = "confetti";
    c.style.background = cores[i % cores.length];
    c.style.left = 50 + (Math.random() - 0.5) * 30 + "vw";
    document.body.appendChild(c);
    const dx = (Math.random() - 0.5) * 70, dy = 30 + Math.random() * 50;
    c.animate([
      { transform: "translate(0, 0) rotate(0)", opacity: 1 },
      { transform: `translate(${dx}vw, ${dy}vh) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 450 + Math.random() * 150, easing: "cubic-bezier(.2,.6,.4,1)" }).onfinish = () => c.remove();
  }
}
