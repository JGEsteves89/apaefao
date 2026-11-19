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
  const nome = caminho => caminho.split("/").pop() || "index.html";
  const pagina = nome(location.pathname);
  menu.querySelectorAll("a").forEach(a => {
    if (nome(a.pathname) === pagina && !a.hash) { a.setAttribute("aria-current", "page"); const d = a.closest("details"); if (d && innerWidth < 960) d.open = true; }
  });
  // "Mais ▾" no computador: fecha ao clicar fora
  const listas = [...menu.querySelectorAll(".menu-mais")];
  document.addEventListener("click", e => { if (innerWidth >= 960) listas.forEach(d => { if (d.open && !d.contains(e.target)) d.open = false; }); });
  listas.forEach(d => d.addEventListener("toggle", () => { if (d.open && innerWidth >= 960) listas.forEach(o => { if (o !== d) o.open = false; }); }));
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
// Todos os dados do site vêm da Google Sheet (Apps Script, ?acao=site): um só pedido por página,
// com agenda, noticias, documentos, links, orgaos, recreio, metas e apoiantes.
// Para ser rápido: guarda a última resposta no telemóvel. Se tiver menos de 1 minuto, usa-a logo;
// se for mais velha, espera pela Sheet (e só usa a guardada se a Sheet falhar). Atualiza sempre em fundo.
const CHAVE_SITE = "apaef-site-v1", FRESCO_MS = 60 * 1000;   // 1 minuto (pedido do Jose, 18/11)
let pedidoSite = null;
function guardado() {
  try { return JSON.parse(localStorage.getItem(CHAVE_SITE) || "null"); } catch (e) { return null; }
}
function pedirSite() {
  return fetch(ENDPOINT + "?acao=site", { signal: AbortSignal.timeout(20000) })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { try { localStorage.setItem(CHAVE_SITE, JSON.stringify({ t: Date.now(), d })); } catch (e) {} return d; });
}
function dadosSite() {
  if (pedidoSite) return pedidoSite;
  const g = guardado(), rede = pedirSite();
  if (g && Date.now() - g.t < FRESCO_MS) { rede.catch(() => {}); pedidoSite = Promise.resolve(g.d); }
  else pedidoSite = rede.catch(e => { pedidoSite = null; if (g) return g.d; throw e; });
  return pedidoSite;
}
if (ENDPOINT && document.querySelector("[data-precisa-dados]")) dadosSite();   // começa logo

function semDados(el) {
  if (el) el.innerHTML = '<p class="vazio"><img class="mascote-mini" src="img/mascote/pensa.webp" alt="" width="70" height="89">Não foi possível carregar. Tenta daqui a pouco 🙂</p>';
  return null;
}

async function carregarDados(nome, el, buscar) {
  let aCarregar = null;
  const t = el && setTimeout(() => {
    if (el.children.length) return;               // já tem conteúdo (ex.: esqueletos)
    aCarregar = document.createElement(/^(OL|UL)$/.test(el.tagName) ? "li" : "div");
    aCarregar.className = "a-carregar";
    aCarregar.innerHTML = '<img src="img/mascote/lupa.webp" alt="" width="80" height="97"><span>A procurar…</span>';
    el.appendChild(aCarregar);
  }, 300);
  try {
    const d = buscar ? await buscar() : (await dadosSite())[nome];
    if (d === undefined || d === null) throw new Error("sem " + nome);
    return d;
  } catch (e) {
    if (aCarregar) aCarregar.remove(), aCarregar = null;
    return semDados(el);
  } finally {
    clearTimeout(t);
    if (aCarregar) aCarregar.remove();
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

// Data de hoje (AAAA-MM-DD, hora de Portugal). Notícias com data futura só aparecem nesse dia.
function hojeISO() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });
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
  setTimeout(() => botao.classList.remove("copiado"), 2000);
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

// Rodapé: "Atualizado há …" (data da última alteração do site no GitHub).
(function () {
  const rodape = document.querySelector("footer .wrap");
  if (!rodape) return;
  const linha = document.createElement("div");
  linha.className = "atualizado";
  rodape.append(linha);

  function haQuanto(data) {
    const min = Math.max(0, Math.round((Date.now() - data) / 60000));
    if (min < 1) return "agora mesmo";
    if (min < 60) return "há " + min + (min === 1 ? " minuto" : " minutos");
    const h = Math.round(min / 60);
    if (h < 24) return "há " + h + (h === 1 ? " hora" : " horas");
    const d = Math.round(h / 24);
    if (d < 31) return "há " + d + (d === 1 ? " dia" : " dias");
    const m = Math.round(d / 30);
    return "há " + m + (m === 1 ? " mês" : " meses");
  }
  function mostrar(data) {
    if (isNaN(data)) return;
    linha.textContent = "Atualizado " + haQuanto(data);
    linha.title = data.toLocaleString("pt-PT");
  }

  fetch("https://api.github.com/repos/JGEsteves89/apaefao/commits?per_page=1")
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(c => mostrar(new Date(c[0].commit.committer.date)))
    .catch(() => mostrar(new Date(document.lastModified)));
})();

// Lumi (imagem 3D, sempre parada): ao tocar, mostra um balão.
// O texto vem de data-fala; sem data-fala diz olá com o nome.
(function () {
  document.querySelectorAll(".mascote-zona").forEach(zona => {
    const nome = typeof MASCOTE_NOME !== "undefined" && MASCOTE_NOME;
    const fala = zona.dataset.fala || (nome ? "Olá! Chamo-me " + nome + "! 🌻" : "Olá! 🌻");
    const balao = document.createElement("span");
    balao.className = "mascote-balao";
    balao.setAttribute("aria-live", "polite");
    zona.appendChild(balao);
    let tempo;
    zona.addEventListener("click", () => {
      balao.textContent = fala;
      balao.classList.add("ver");
      clearTimeout(tempo);
      tempo = setTimeout(() => balao.classList.remove("ver"), 3500);
    });
  });
})();

// Galeria de fotos (notícias e agenda): o mesmo componente das metas (m-img / m-galeria).
// imgs: lista de "caminho" ou {src, legenda}. A 1.ª imagem é a principal.
function galeriaHTML(imgs, alt) {
  const lista = (imgs || []).filter(Boolean).map(i => typeof i === "string" ? { src: i } : i);
  if (!lista.length) return "";
  const slides = lista.map((i, n) => `<figure class="m-slide"><img src="${escapar(i.src)}" alt="${escapar(i.legenda || alt || "")}" loading="${n ? "lazy" : "eager"}">${i.legenda ? `<figcaption>${escapar(i.legenda)}</figcaption>` : ""}</figure>`).join("");
  if (lista.length === 1) return `<div class="m-img galeria-foto">${slides}</div>`;
  const pontos = lista.map((_, n) => `<button type="button" class="${n ? "" : "ativo"}" aria-label="Imagem ${n + 1}"></button>`).join("");
  return `<div class="m-img m-galeria galeria-foto"><div class="m-pista">${slides}</div>
    <button type="button" class="m-seta ant" aria-label="Imagem anterior">‹</button><button type="button" class="m-seta seg" aria-label="Imagem seguinte">›</button>
    <div class="m-pontos">${pontos}</div></div>`;
}

function ativarGalerias(raiz) {
  (raiz || document).querySelectorAll(".galeria-foto.m-galeria").forEach(g => {
    if (g.dataset.ativa) return; g.dataset.ativa = "1";
    const pista = g.querySelector(".m-pista"), pontos = [...g.querySelectorAll(".m-pontos button")];
    const ir = n => pista.scrollTo({ left: n * pista.clientWidth, behavior: MOVIMENTO ? "smooth" : "auto" });
    const atual = () => Math.round(pista.scrollLeft / pista.clientWidth);
    pista.addEventListener("scroll", () => pontos.forEach((p, n) => p.classList.toggle("ativo", n === atual())), { passive: true });
    pontos.forEach((p, n) => p.addEventListener("click", () => ir(n)));
    g.querySelector(".ant").addEventListener("click", () => ir(Math.max(0, atual() - 1)));
    g.querySelector(".seg").addEventListener("click", () => ir((atual() + 1) % pontos.length));
  });
}

// Fundo desfocado nas galerias (metas, notícias, agenda): cada .m-slide recebe a sua foto em --bg (ver style.css).
// Assim as fotos ao alto ou muito largas aparecem inteiras, com a mesma foto desfocada a preencher o espaço.
(function () {
  const marcar = raiz => raiz.querySelectorAll && raiz.querySelectorAll(".m-slide img").forEach(img => {
    const f = img.closest(".m-slide");
    if (f && !f.style.getPropertyValue("--bg")) f.style.setProperty("--bg", `url("${img.getAttribute("src")}")`);
  });
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && marcar(n))))
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => marcar(document));
})();

// Metas e recreio: foto com duas vistas. Um interruptor pequeno no canto de cima ("Hoje | Projeto")
// troca a foto; não tapa a imagem e mostra sempre qual está à vista (16/11).
function vistas(caixa) {
  const botao = caixa.querySelector(".r-v-botao"), rot = caixa.querySelector(".r-v-rot");
  if (rot) rot.hidden = true;
  botao.innerHTML = '<span data-v="hoje">Hoje</span><span data-v="projeto">Projeto</span>';
  const pinta = () => {
    const hoje = caixa.dataset.vista === "hoje";
    botao.setAttribute("aria-label", hoje ? "A ver: como está hoje. Tocar para ver o projeto" : "A ver: o projeto (simulação). Tocar para ver como está hoje");
    botao.setAttribute("aria-pressed", hoje);
  };
  botao.addEventListener("click", e => { e.stopPropagation(); caixa.dataset.vista = caixa.dataset.vista === "hoje" ? "projeto" : "hoje"; pinta(); });
  pinta();
}

// Avisos urgentes (greve, escola fechada, horário…): barra no topo de todas as páginas + cartão na página inicial.
// Vêm da aba "avisos" da Sheet (?acao=avisos, cache de 60 s; não entra no ?acao=site, que guarda 6 h).
// Erro ou sem avisos: não mostra nada. Cada aviso só aparece nos 3 dias antes do evento (ver DIAS_ANTES). Teste com ?avisos-teste na morada (dados inventados, só neste ecrã).
(function () {
  if (!ENDPOINT) return;
  const CHAVE = "apaef-avisos-v1", FRESCO = 60 * 1000;
  const hoje = hojeISO();
  // Só aparece nos 3 dias antes (o dia do evento é o dia antes de "ate") e desaparece às 00:00 de "ate".
  // Ex.: ate = 21/11 (greve a 20/11) → aparece a 17/11.
  const DIAS_ANTES = 3;
  const desde = new Date(new Date(hoje + "T12:00:00Z").getTime() + (DIAS_ANTES + 1) * 864e5).toISOString().slice(0, 10);
  const ativos = l => (Array.isArray(l) ? l : []).filter(a => a && a.ate > hoje && a.ate <= desde && a.atualizacoes && a.atualizacoes.length);
  const lerCopia = () => { try { return JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) { return null; } };

  function teste() {
    const d = new Date(), iso = n => new Date(d.getTime() + n * 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });
    return [{ titulo: "Greve 20/11", nivel: "urgente", quando: "Sexta, 20 de novembro", ate: iso(1), fonte: "Escola", atualizacoes: [
      { hora: hoje + "T09:20", texto: "Não há aulas. A escola pede a todos os pais para irem buscar os alunos." },
      { hora: hoje + "T09:00", texto: "Não há aulas hoje." },
      { hora: hoje + "T07:45", texto: "Os funcionários comunicam às 9h se há aulas." },
      { hora: iso(-2) + "T18:00", texto: "Anunciada greve do pessoal não docente para dia 20." }] }];
  }

  function obter() {
    if (/[?&]avisos-teste/.test(location.search)) return Promise.resolve(teste());
    const c = lerCopia();
    if (c && Date.now() - c.t < FRESCO) return Promise.resolve(c.d);
    return fetch(ENDPOINT + "?acao=avisos", { signal: AbortSignal.timeout(8000) })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => { try { localStorage.setItem(CHAVE, JSON.stringify({ t: Date.now(), d })); } catch (e) {} return d; })
      .catch(() => (c && ativos(c.d).length === (c.d || []).length ? c.d : []));   // cópia velha só se tudo ainda estiver ativo
  }

  // "2026-11-20T09:20" → "Hoje às 9h20" (cartão) / "Hoje, 9h20" (lista) / "Ontem, 18h00" / "Quarta 18/11, 18h00"
  const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  function hora(iso, cartao) {
    const [data, hm = "00:00"] = String(iso).split("T");
    const [h, m] = hm.split(":"), hh = Number(h) + "h" + m;
    const ontem = new Date(new Date(hoje + "T12:00:00Z").getTime() - 864e5).toISOString().slice(0, 10);
    if (data === hoje) return cartao ? "Hoje às " + hh : "Hoje, " + hh;
    if (data === ontem) return "Ontem, " + hh;
    const d = new Date(data + "T12:00:00Z");
    return DIAS[d.getUTCDay()] + " " + data.slice(8, 10) + "/" + data.slice(5, 7) + ", " + hh;
  }

  function faixa(lista) {
    const a = lista[0], urgente = lista.some(x => x.nivel === "urgente");
    const naInicial = document.getElementById("avisos");
    const texto = lista.length > 1
      ? `<b>${lista.length} avisos:</b> ${escapar(a.titulo)}`
      : `<b>${escapar(a.titulo)}:</b> ${escapar(a.atualizacoes[0].texto)}`;
    const f = document.createElement("div");
    f.className = "aviso-faixa " + (urgente ? "urgente" : "info " + a.cor);
    f.setAttribute("role", "region");
    f.setAttribute("aria-label", "Aviso");
    f.innerHTML = `<span class="aviso-ico" aria-hidden="true">${urgente ? "!" : "i"}</span>
      <p><span class="aviso-txt">${texto}</span> <a href="${naInicial ? "#avisos" : "/#avisos"}">Ver&nbsp;→</a></p>`;
    document.body.prepend(f);
  }

  function cartoes(sec, lista) {
    sec.innerHTML = lista.map(a => {
      const [novo, ...antes] = a.atualizacoes;
      return `<article class="aviso-cartao ${a.nivel === "urgente" ? "urgente" : "info " + a.cor}">
        <h2>${escapar(a.titulo)}</h2>
        ${a.quando ? `<p class="aviso-quando">${escapar(a.quando)}</p>` : ""}
        <p class="aviso-agora">${escapar(novo.texto)}</p>
        <p class="aviso-hora"><b>${hora(novo.hora, true)}</b>${a.fonte ? " · Fonte: " + escapar(a.fonte) : ""}</p>
        ${antes.length ? `<p class="aviso-antes">Antes</p><ol class="aviso-hist">${antes.map(u =>
          `<li><span class="aviso-h">${hora(u.hora, false)}</span>${escapar(u.texto)}</li>`).join("")}</ol>` : ""}
      </article>`;
    }).join("");
    sec.hidden = false;
    if (location.hash === "#avisos") sec.scrollIntoView();
  }

  obter().then(l => {
    // urgente primeiro; depois o evento mais perto primeiro
    const lista = ativos(l).sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "urgente" ? -1 : 1) || (a.ate < b.ate ? -1 : a.ate > b.ate ? 1 : 0));
    if (!lista.length) return;
    // Avisos "info": cada um com uma cor dos óculos da Lumi (azul, verde, roxo, rosa, laranja, turquesa), e repete. Vermelho = só urgente.
    let n = 0;
    lista.forEach(x => { x.cor = x.nivel === "urgente" ? "" : "cor-" + (n++ % 6); });
    faixa(lista);
    const sec = document.getElementById("avisos");
    if (sec) cartoes(sec, lista);
  }).catch(() => {});
})();
