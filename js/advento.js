// O Advento da Lumi (advento.html): 24 números sobre o cenário; cada dia abre um desenho para pintar com o dedo.
// Pintar: tocar numa zona do SVG enche-a com a cor escolhida. As cores ficam no telemóvel (localStorage "advento-v1").
// Depois: guardar (PNG), imprimir (pintado ou por pintar) ou enviar para o mural (Sheet; aparece logo, o Jose esconde com "não" em publicar).
// Testes: ?dia=7 (simula 7 de dezembro; ?dia=0 antes, ?dia=30 depois) · ?editar=1 (pôr os números) · ?mural-teste (6 exemplos).
// SPEC: notas/projetos/website/advento/SPEC_advento.md

(() => {
const N_DIAS = 24;
const P = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const ler = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// ---------- Datas (Lisboa) ----------
// fase: "antes" (até 30/11) · "durante" (1–24/12) · "depois" (25/12–6/1: tudo aberto) · "fim" (até ao próximo Natal)
function quando() {
  const d = P.get("dia");
  if (d !== null && /^\d+$/.test(d)) {
    const n = Number(d);
    if (n === 0) return { fase: "antes", dia: 0, texto: "30 de novembro" };
    if (n <= N_DIAS) return { fase: "durante", dia: n, texto: n + " de dezembro" };
    return { fase: "depois", dia: N_DIAS, texto: Math.min(n, 31) + " de dezembro" };
  }
  const [, m, dd] = hojeISO().split("-").map(Number);
  const texto = dd + " de " + MESES[m - 1];
  if (m === 12 && dd <= N_DIAS) return { fase: "durante", dia: dd, texto };
  if ((m === 12) || (m === 1 && dd <= 6)) return { fase: "depois", dia: N_DIAS, texto };
  if (m === 11) return { fase: "antes", dia: 0, texto };
  return { fase: "fim", dia: 0, texto };
}
const Q = quando();
const aberto = n => (Q.fase === "durante" && n <= Q.dia) || Q.fase === "depois";
const diasDoMural = Q.fase === "durante" ? Q.dia : Q.fase === "antes" ? 0 : N_DIAS;

// ---------- Cores guardadas ----------
const CHAVE = "advento-v1";
const pinturas = () => ler(CHAVE, {});
const CHAVE_TRACOS = "advento-tracos-v1";   // pincel: { "7": "#e53935|10,20 14,25;#1e5bd8|…" }
const pintou = n => (pinturas()[n] || []).some(c => c && c.toLowerCase() !== "#fff" && c.toLowerCase() !== "#ffffff") || !!ler(CHAVE_TRACOS, {})[n];

// O mesmo "votante" da ementa (um id por telemóvel). Se não existir, cria.
function votante() {
  let id = null;
  try { id = localStorage.getItem("ementa-votante"); } catch (e) {}
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); try { localStorage.setItem("ementa-votante", id); } catch (e) {} }
  return id;
}

// ---------- Desenhos (SVG) ----------
const desenhos = {};
const ficheiro = n => "img/advento/desenhos/dia-" + String(n).padStart(2, "0") + ".svg";
function desenho(n) {
  if (!desenhos[n]) desenhos[n] = fetch(ficheiro(n)).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
  return desenhos[n];
}
// Cria o <svg> do dia com as cores dadas. Zonas por ordem z1, z2… (é o que se guarda).
// Pincel: os traços ficam numa camada entre as zonas e as linhas pretas (as linhas ficam sempre por cima).
const NS = "http://www.w3.org/2000/svg", TAMANHOS = [12, 26, 48];   // pincel: fino, médio, grosso (unidades do desenho 600×800)
let nClip = 0;
function caminho(pts) { return pts.length ? "M" + pts.map(p => p.join(" ")).join(" L") + (pts.length === 1 ? " L" + pts[0].join(" ") : "") : ""; }
function novoTraco(camada, cor, pts, w = 22) {
  const p = document.createElementNS(NS, "path");
  p.setAttribute("fill", "none"); p.setAttribute("stroke", cor); p.setAttribute("stroke-width", w); p.dataset.w = w;
  p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
  p.dataset.cor = cor; p.pontos = pts; p.setAttribute("d", caminho(pts));
  camada.appendChild(p);
  return p;
}
// Texto de cada traço: "#cor,largura|x,y x,y …" (os antigos não têm largura: 22).
const tracosTexto = camada => [...camada.querySelectorAll("path")].map(p => p.dataset.cor + "," + p.dataset.w + "|" + p.pontos.map(q => q.join(",")).join(" ")).join(";");
function lerTracos(texto) {
  return String(texto || "").split(";").filter(Boolean).map(t => {
    const [corW, pts] = t.split("|"), [cor, w] = String(corW).split(",");
    return { cor, w: Math.min(80, Math.max(4, Number(w) || 22)), pts: String(pts || "").split(" ").filter(Boolean).map(q => q.split(",").map(Number)) };
  }).filter(t => /^#[0-9a-f]{3,6}$/i.test(t.cor) && t.pts.length);
}
function montar(texto, cores, tracos) {
  const doc = new DOMParser().parseFromString(texto, "image/svg+xml");
  const svg = document.importNode(doc.documentElement, true);
  const zonas = [...svg.querySelectorAll(".zona")].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  zonas.forEach((z, i) => { if (cores && cores[i]) z.setAttribute("fill", cores[i]); });
  // camada do pincel, cortada pela moldura do desenho (zona z1)
  const id = "adv-clip-" + (++nClip), defs = document.createElementNS(NS, "defs"), clip = document.createElementNS(NS, "clipPath");
  clip.id = id;
  if (zonas[0]) { const forma = zonas[0].cloneNode(false); forma.removeAttribute("id"); forma.removeAttribute("class"); clip.appendChild(forma); } defs.appendChild(clip); svg.insertBefore(defs, svg.firstChild);
  const camada = document.createElementNS(NS, "g");
  camada.setAttribute("class", "tracos"); camada.setAttribute("pointer-events", "none"); camada.setAttribute("clip-path", `url(#${id})`);
  const linhas = svg.querySelector("#linhas");
  svg.insertBefore(camada, linhas);
  lerTracos(tracos).forEach(t => novoTraco(camada, t.cor, t.pts, t.w));
  const meta = svg.querySelector("metadata");
  let info = {};
  try { info = JSON.parse(meta ? meta.textContent : "{}"); } catch (e) {}
  if (meta) meta.remove();
  svg.removeAttribute("width"); svg.removeAttribute("height");
  return { svg, zonas, info, camada };
}

// ---------- Calendário ----------
const cena = $("adv-cena"), numeros = $("adv-numeros"), balao = $("adv-balao");
const pc = matchMedia("(min-width: 768px)");
let posicoes = null;

function provisorias() {   // se o JSON falhar: grelha espalhada
  const l = [];
  for (let i = 0; i < N_DIAS; i++) l.push({ dia: i + 1, x: 10 + (i % 6) * 16 + (Math.floor(i / 6) % 2) * 8, y: 14 + Math.floor(i / 6) * 22 });
  return { pc: l, telemovel: l };
}

function desenharNumeros() {
  if (EDITAR) return;
  const lista = (posicoes && posicoes[pc.matches ? "pc" : "telemovel"]) || [];
  numeros.innerHTML = "";
  lista.forEach(p => {
    const n = p.dia, b = document.createElement("button");
    b.type = "button"; b.className = "adv-num"; b.textContent = n; b.dataset.dia = n;
    b.style.left = p.x + "%"; b.style.top = p.y + "%";
    if (Q.fase === "durante" && n === Q.dia) { b.classList.add("hoje"); b.setAttribute("aria-label", "Dia " + n + ", hoje"); }
    else if (aberto(n)) {
      b.classList.add("passado"); b.setAttribute("aria-label", "Dia " + n + (pintou(n) ? ", já pintado" : ""));
      if (pintou(n)) b.insertAdjacentHTML("beforeend", '<span class="feito" aria-hidden="true">✓</span>');
    } else {
      b.classList.add("futuro"); b.setAttribute("aria-label", "Dia " + n + ", ainda fechado");   // esbatido chega (sem cadeado)
    }
    b.addEventListener("click", () => aberto(n) ? abrir(n) : aindaNao(b, n));
    numeros.appendChild(b);
  });
}

let balaoT = 0;
function aindaNao(b, n) {
  b.classList.remove("abana"); void b.offsetWidth; b.classList.add("abana");
  const txt = Q.fase === "antes" ? "Ainda não! O Advento começa a 1 de dezembro." : Q.fase === "fim" ? "Até ao próximo Natal!" : "Ainda não! Volta no dia " + n + ".";
  balao.querySelector("span").textContent = txt;
  // O balão fica sempre todo dentro do cenário (largura fixa, centrado no número quando cabe).
  const w = cena.clientWidth, meio = Math.min(w - 8 - 115, Math.max(8 + 115, parseFloat(b.style.left) / 100 * w));
  balao.style.left = meio + "px"; balao.style.top = b.style.top;
  if (parseFloat(b.style.top) < 22) balao.style.transform = "translate(-50%, 36px)"; else balao.style.transform = "";
  balao.hidden = false;
  clearTimeout(balaoT); balaoT = setTimeout(() => { balao.hidden = true; }, 2600);
}

function cabecalho() {
  $("adv-data").textContent = Q.texto;
  const estado = $("adv-estado"), botao = $("adv-abrir-hoje");
  if (Q.fase === "antes") { estado.textContent = "O Advento começa a 1 de dezembro!"; estado.hidden = false; }
  if (Q.fase === "fim") { estado.textContent = "Até ao próximo Natal! O mural continua aqui em baixo."; estado.hidden = false; }
  if (Q.fase === "durante") { botao.textContent = "Abrir o dia " + Q.dia + " →"; botao.hidden = false; botao.onclick = () => abrir(Q.dia); }
  if (Q.fase === "depois") { estado.textContent = "Os 24 desenhos estão abertos. Escolhe um!"; estado.hidden = false; }
}

// ---------- Ecrã de pintar ----------
const CORES = [
  ["#e53935", "vermelho"], ["#2e7d32", "verde-escuro"], ["#8bc34a", "verde-claro"], ["#fdd835", "amarelo"], ["#fb8c00", "laranja"],
  ["#1e5bd8", "azul"], ["#64b5f6", "azul-claro"], ["#8e44ad", "roxo"], ["#f48fb1", "rosa"], ["#8d5a3b", "castanho"],
  ["#f6c9a0", "pele"], ["#9e9e9e", "cinzento"], ["#ffffff", "branco"], ["#d4a017", "dourado"], ["#1f1a14", "preto"],
];
const ecra = $("adv-pintar"), folha = $("adv-folha"), paleta = $("adv-paleta");
let atual = null;   // { dia, zonas, svg, cores, pilha }
let corEscolhida = ler("advento-cor", CORES[0][0]);
let som = ler("advento-som", true);

CORES.forEach(([c, nome]) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "adv-cor"; b.setAttribute("role", "radio"); b.setAttribute("aria-label", nome); b.dataset.cor = c;
  b.innerHTML = `<i style="background:${c}${c === "#d4a017" ? ";background-image:linear-gradient(135deg,#f7e08a,#d4a017 55%,#9c7410)" : ""}"></i>`;
  b.addEventListener("click", () => escolherCor(c));
  paleta.appendChild(b);
});
function escolherCor(c) {
  corEscolhida = c; gravar("advento-cor", c);
  document.querySelectorAll(".adv-ferramenta .adv-ponto").forEach(p => { p.style.background = c; });
  paleta.querySelectorAll(".adv-cor").forEach(b => {
    const sim = b.dataset.cor === c;
    b.setAttribute("aria-checked", sim);
    b.querySelector("i").textContent = sim ? "✓" : "";
    b.querySelector("i").style.color = ["#ffffff", "#fdd835", "#f6c9a0", "#8bc34a", "#64b5f6", "#f48fb1"].includes(b.dataset.cor) ? "#1f1a14" : "#fff";
  });
}
escolherCor(corEscolhida);

// Som curto gerado (sem ficheiros). Cada cor tem a sua nota.
let audio = null;
function tocar(i = 0, festa = false) {
  if (!som) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const notas = festa ? [523, 659, 784, 1047] : [392 + i * 22];
    notas.forEach((f, k) => {
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + k * .09;
      o.type = "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.18, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + .25);
    });
  } catch (e) {}
}
function mostrarSom() { $("adv-som").textContent = som ? "🔊" : "🔇"; $("adv-som").setAttribute("aria-label", som ? "Som ligado" : "Som desligado"); }
$("adv-som").addEventListener("click", () => { som = !som; gravar("advento-som", som); mostrarSom(); });
mostrarSom();

async function abrir(n, semHistoria) {
  fecharFolhas();
  $("adv-dia").textContent = "Dia " + n;
  folha.innerHTML = "";
  ecra.hidden = false;
  document.documentElement.classList.add("adv-aberto");
  if (!semHistoria) history.pushState({ advento: n }, "");
  atual = { dia: n, zonas: [], svg: null, pilha: [], festejado: false };
  let texto;
  try { texto = await desenho(n); }
  catch (e) {
    folha.innerHTML = '<div class="adv-a-chegar"><img src="img/mascote/pensa.webp" alt="" width="110" height="136">Desenho a chegar 🎨<br><small>Volta mais logo!</small></div>';
    paleta.parentElement.hidden = true;
    return;
  }
  paleta.parentElement.hidden = false;
  const guardadas = pinturas()[n] || [];
  const m = montar(texto, guardadas, ler(CHAVE_TRACOS, {})[n]);
  atual.svg = m.svg; atual.zonas = m.zonas; atual.info = m.info; atual.camada = m.camada;
  atual.festejado = completo();
  // Passos do Desfazer guardados: [i, corAntes] = balde na zona i; ["t"] = um traço do pincel (os últimos traços, por ordem).
  const passos = ler(CHAVE_PASSOS, {})[n] || [], tracos = [...m.camada.children];
  let k = tracos.length - passos.filter(x => x[0] === "t").length;
  atual.pilha = passos.map(x => x[0] === "t" ? (tracos[k] ? { t: tracos[k++] } : null) : (m.zonas[x[0]] ? { z: m.zonas[x[0]], antes: x[1] } : null)).filter(Boolean);
  m.svg.setAttribute("width", 600); m.svg.setAttribute("height", 800);   // tamanho próprio: o desenho cabe sem bordas a mais
  m.svg.setAttribute("role", "img"); m.svg.setAttribute("aria-label", m.info.titulo || "Desenho do dia " + n);
  folha.appendChild(m.svg);
  m.svg.addEventListener("pointerdown", e => ferramenta === "pincel" ? comecarTraco(e) : pintarToque(e));
}

function cores() { return atual.zonas.map(z => z.getAttribute("fill") || "#fff"); }
// As cores e os passos do Desfazer ficam no telemóvel: ao reabrir o desenho, o Desfazer continua a funcionar.
const CHAVE_PASSOS = "advento-passos-v1";
function guardarCores() {
  const t = pinturas(); t[atual.dia] = cores(); gravar(CHAVE, t);
  const tr = ler(CHAVE_TRACOS, {}), txt = tracosTexto(atual.camada);
  if (txt) tr[atual.dia] = txt; else delete tr[atual.dia];
  gravar(CHAVE_TRACOS, tr);
  const p = ler(CHAVE_PASSOS, {}); p[atual.dia] = atual.pilha.slice(-200).map(x => x.t ? ["t"] : [atual.zonas.indexOf(x.z), x.antes]); gravar(CHAVE_PASSOS, p);
}

// ---------- Pincel ----------
// Ferramentas: balde, ou pincel em 3 tamanhos (os botões com um ponto pequeno, médio e grande).
let ferramenta = ler("advento-ferramenta", "balde"), tamanho = ler("advento-tamanho", TAMANHOS[1]);
if (!TAMANHOS.includes(tamanho)) tamanho = TAMANHOS[1];
function escolherFerramenta(f, w) {
  ferramenta = f; gravar("advento-ferramenta", f);
  if (w) { tamanho = w; gravar("advento-tamanho", w); }
  document.querySelectorAll(".adv-ferramenta button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.f === f && (f === "balde" || Number(b.dataset.w) === tamanho))));
  folha.classList.toggle("com-pincel", f === "pincel");
}
document.querySelectorAll(".adv-ferramenta button").forEach(b => b.addEventListener("click", () => escolherFerramenta(b.dataset.f, Number(b.dataset.w) || 0)));
escolherFerramenta(ferramenta);
function pontoSVG(e) {
  const m = atual.svg.getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return [Math.round(p.x), Math.round(p.y)];
}
function comecarTraco(e) {
  if (!atual || !atual.svg) return;
  e.preventDefault();
  const svg = atual.svg, inicio = pontoSVG(e);
  if (!inicio) return;
  const traco = novoTraco(atual.camada, corEscolhida, [inicio], tamanho);
  try { svg.setPointerCapture(e.pointerId); } catch (x) {}
  const mexe = ev => {
    if (ev.pointerId !== e.pointerId) return;
    (ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev]).forEach(c => {
      const q = pontoSVG(c), u = traco.pontos[traco.pontos.length - 1];
      if (q && Math.hypot(q[0] - u[0], q[1] - u[1]) >= 3) traco.pontos.push(q);
    });
    traco.setAttribute("d", caminho(traco.pontos));
  };
  const fim = ev => {
    if (ev.pointerId !== e.pointerId) return;
    svg.removeEventListener("pointermove", mexe); svg.removeEventListener("pointerup", fim); svg.removeEventListener("pointercancel", fim);
    atual.pilha.push({ t: traco });
    tocar(CORES.findIndex(c => c[0] === corEscolhida));
    guardarCores();
  };
  svg.addEventListener("pointermove", mexe); svg.addEventListener("pointerup", fim); svg.addEventListener("pointercancel", fim);
}
const branco = c => !c || /^#f{3}(f{3})?$/i.test(c);
const completo = () => atual.zonas.length > 0 && atual.zonas.every(z => !branco(z.getAttribute("fill")));

function pintarToque(e) {
  const z = e.target.closest(".zona");
  if (!z) return;
  e.preventDefault();
  const antes = z.getAttribute("fill") || "#fff";
  if (antes.toLowerCase() === corEscolhida.toLowerCase()) return;
  atual.pilha.push({ z, antes });
  z.setAttribute("fill", corEscolhida);
  if (MOVIMENTO && z.animate) z.animate([{ transform: "scale(1)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }], { duration: 150 });
  tocar(CORES.findIndex(c => c[0] === corEscolhida));
  guardarCores();
  if (!atual.festejado && completo()) { atual.festejado = true; setTimeout(festa, 250); }
}

function desfazer() {
  if (!atual || !atual.pilha.length) return;
  const passo = atual.pilha.pop();
  if (passo.t) passo.t.remove(); else passo.z.setAttribute("fill", passo.antes);
  guardarCores();
}
function recomecar() {
  fecharMenu();
  if (!atual || !atual.zonas.length) return;
  if (!confirm("Começar de novo?")) return;
  atual.zonas.forEach(z => z.setAttribute("fill", "#fff"));
  atual.camada.innerHTML = "";
  atual.pilha = []; atual.festejado = false;
  guardarCores();
}
// Desfazer: toque = um passo; manter carregado (0,8 s) = começar de novo.
let carregado = 0, longo = false;
$("adv-desfazer").addEventListener("pointerdown", () => { longo = false; carregado = setTimeout(() => { longo = true; recomecar(); }, 800); });
["pointerup", "pointerleave", "pointercancel"].forEach(t => $("adv-desfazer").addEventListener(t, () => clearTimeout(carregado)));
$("adv-desfazer").addEventListener("click", () => { if (!longo) desfazer(); });
$("adv-desfazer").addEventListener("contextmenu", e => e.preventDefault());

function fecharMenu() { $("adv-menu").hidden = true; $("adv-mais").setAttribute("aria-expanded", "false"); }
$("adv-mais").addEventListener("click", () => { const m = $("adv-menu"); m.hidden = !m.hidden; $("adv-mais").setAttribute("aria-expanded", String(!m.hidden)); });
$("adv-recomecar").addEventListener("click", recomecar);

function fecharFolhas() { ["adv-festa", "adv-form", "adv-imagem"].forEach(id => { $(id).hidden = true; }); ecra.classList.remove("com-folha"); fecharMenu(); }
// Com um cartão aberto (Que bonito!, mural, guardar) o desenho fica bloqueado: só se volta a pintar com "Continuar a pintar".
function mostrarFolha(id) { fecharFolhas(); $(id).hidden = false; ecra.classList.add("com-folha"); }
function fechar(daHistoria) {
  if (ecra.hidden) return;
  ecra.hidden = true; fecharFolhas();
  document.documentElement.classList.remove("adv-aberto");
  atual = null;
  desenharNumeros();   // ✓ nos dias pintados
  if (!daHistoria && history.state && history.state.advento) history.back();
}
$("adv-fechar").addEventListener("click", () => fechar());
addEventListener("popstate", () => fechar(true));
// Esc: primeiro fecha o cartão aberto (volta a pintar); só depois fecha o desenho.
addEventListener("keydown", e => { if (e.key !== "Escape" || ecra.hidden) return; if (ecra.classList.contains("com-folha")) fecharFolhas(); else fechar(); });
// ✕ dos cartões: volta a pintar. (Tocar no desenho esbatido não faz nada: o desenho fica bloqueado.)
document.querySelectorAll("[data-voltar]").forEach(b => b.addEventListener("click", fecharFolhas));

// ---------- Festa ----------
function festa() {
  if (!atual || !atual.svg) return;
  mostrarFolha("adv-festa");
  confetti();
  tocar(0, true);
  const l = document.querySelector(".adv-salta");
  l.classList.remove("salta"); void l.offsetWidth; if (MOVIMENTO) l.classList.add("salta");
}
$("adv-acabei").addEventListener("click", festa);
$("adv-continuar").addEventListener("click", fecharFolhas);

// ---------- Guardar (PNG) ----------
function svgTexto(svg, pintado) {
  const c = svg.cloneNode(true);
  c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  c.setAttribute("width", 600); c.setAttribute("height", 800);
  c.removeAttribute("style");
  if (!pintado) { c.querySelectorAll(".zona").forEach(z => z.setAttribute("fill", "#fff")); c.querySelectorAll(".tracos path").forEach(p => p.remove()); }
  return new XMLSerializer().serializeToString(c);
}
function imagemPNG() {
  return new Promise((ok, falha) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgTexto(atual.svg, true)], { type: "image/svg+xml" }));
    img.onload = () => {
      const cv = document.createElement("canvas"); cv.width = 1200; cv.height = 1600;
      const g = cv.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, 1200, 1600);
      g.drawImage(img, 60, 30, 1080, 1440);
      g.fillStyle = "#1f1a14"; g.font = "600 34px Fredoka, Nunito, sans-serif"; g.textAlign = "center";
      g.fillText("Advento da Lumi · dia " + atual.dia + " · apaefao.pt", 600, 1550);
      URL.revokeObjectURL(url);
      cv.toBlob(b => b ? ok({ blob: b, url: cv.toDataURL("image/png") }) : falha(new Error("png")), "image/png");
    };
    img.onerror = falha;
    img.src = url;
  });
}
$("adv-guardar").addEventListener("click", async () => {
  if (!atual || !atual.svg) return;
  let png;
  try { png = await imagemPNG(); } catch (e) { return; }
  const nome = "advento-lumi-dia-" + atual.dia + ".png";
  const file = typeof File === "function" ? new File([png.blob], nome, { type: "image/png" }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "O Advento da Lumi — dia " + atual.dia }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {   // plano B: tocar e manter o dedo na imagem
    $("adv-imagem-img").src = png.url; mostrarFolha("adv-imagem"); return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(png.blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});
$("adv-imagem-fechar").addEventListener("click", () => mostrarFolha("adv-festa"));

// ---------- Imprimir ----------
const impressao = $("adv-impressao");
function imprimir(pintado) {
  fecharMenu();
  if (!atual || !atual.svg) return;
  impressao.innerHTML = svgTexto(atual.svg, pintado) + `<p>O Advento da Lumi · dia ${atual.dia} · apaefao.pt</p>`;
  document.body.classList.add("adv-a-imprimir");
  setTimeout(() => window.print(), 50);
}
addEventListener("afterprint", () => { document.body.classList.remove("adv-a-imprimir"); impressao.innerHTML = ""; });
$("adv-imprimir").addEventListener("click", () => imprimir(true));
$("adv-imprimir-branco").addEventListener("click", () => imprimir(false));
$("adv-imprimir-branco2").addEventListener("click", () => imprimir(false));

// ---------- Enviar para o mural ----------
const PALAVROES = ["merda", "caralh", "foda", "fodi", "puta", "cabrao", "porra", "bosta", "cona", "piroca", "paneleir", "rabeta"];
$("adv-enviar").addEventListener("click", () => { $("adv-erro").textContent = ""; mostrarFolha("adv-form"); $("adv-nome").focus(); });
$("adv-agora-nao").addEventListener("click", () => mostrarFolha("adv-festa"));
$("adv-form").addEventListener("submit", async e => {
  e.preventDefault();
  const erro = $("adv-erro"), nome = $("adv-nome").value.trim();
  const simples = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ]{2,12}$/.test(nome) || PALAVROES.some(p => simples.includes(p))) { erro.textContent = "Escreve só o primeiro nome (2 a 12 letras)."; return; }
  const botao = e.target.querySelector("[type=submit]"); botao.disabled = true;
  let tracos = tracosTexto(atual.camada);
  for (let passo = 2; tracos.length > 40000 && passo < 64; passo *= 2) {   // desenho muito grande: menos pontos por traço
    tracos = [...atual.camada.querySelectorAll("path")].map(p => p.dataset.cor + "," + p.dataset.w + "|" + p.pontos.filter((q, i, a) => i % passo === 0 || i === a.length - 1).map(q => q.join(",")).join(" ")).join(";");
  }
  if (tracos.length > 40000) tracos = "";
  const ok = await enviar("advento_pintura", { dia: atual.dia, nome, cores: cores(), tracos, voterId: votante() });
  botao.disabled = false;
  if (!ok) { erro.textContent = "Não foi possível enviar. Tenta daqui a pouco."; return; }
  // Enviado: o desenho entra logo no mural (neste telemóvel) e a página vai para lá, com o obrigado.
  const meus = ler(CHAVE_MEUS, []);
  meus.push({ id: "meu-" + Date.now().toString(36), dia: atual.dia, nome, cores: cores(), tracos, coracoes: 0, semana: 0, t: Date.now() });
  gravar(CHAVE_MEUS, meus);
  mostrarMural(ultimoMural);
  setTimeout(carregarMural, 5000);   // a Sheet já deve ter a linha nova
  $("adv-nome").value = "";
  fechar();
  $("adv-obrigado").hidden = false;
  setTimeout(() => $("mural").scrollIntoView({ behavior: MOVIMENTO ? "smooth" : "auto", block: "start" }), 250);
});

// ---------- Mural ----------
const EXEMPLOS = () => {
  const p = ["#e53935", "#2e7d32", "#fdd835", "#1e5bd8", "#f48fb1", "#fb8c00", "#8e44ad", "#64b5f6", "#d4a017", "#8bc34a"];
  const cor = (s, n) => Array.from({ length: n }, (_, i) => p[(i * 3 + s) % p.length]);
  return [
    { id: "ex1", dia: 1, nome: "Alba", idade: 5, cores: cor(1, 12), coracoes: 7, semana: 4, meu: true },
    { id: "ex2", dia: 1, nome: "Tomás", idade: 7, cores: cor(2, 12), coracoes: 2, semana: 2 },
    { id: "ex3", dia: 2, nome: "Leonor", idade: "", cores: cor(3, 13), coracoes: 12, semana: 9 },
    { id: "ex4", dia: 2, nome: "Rui", idade: 4, cores: cor(4, 13), coracoes: 0, semana: 0 },
    { id: "ex5", dia: 3, nome: "Matilde", idade: 8, cores: cor(5, 13), coracoes: 5, semana: 5 },
    { id: "ex6", dia: 3, nome: "Gaspar", idade: 6, cores: cor(6, 13), coracoes: 1, semana: 1 },
  ];
};
const CHAVE_MURAL = "advento-mural", CHAVE_GOSTOS = "advento-coracoes-v2", CHAVE_MEUS = "advento-meus", CHAVE_MEUS_IDS = "advento-meus-ids", CHAVE_VISTOS = "advento-vistos";
let mural = [], filtro = "todos", ultimoMural = null;
const gostos = ler(CHAVE_GOSTOS, {});      // { id: corações que a Sheet tinha quando dei o meu } (para não contar 2 vezes)
const vistos = ler(CHAVE_VISTOS, {});      // { id: corações que vi da última vez no meu desenho }

// Corações: cada desenho começa com 5 (BASE), para nunca haver um desenho com 0.
// Os teus desenhos aparecem primeiro e, ao abrir a página, animam com os corações novos desde a última visita.
const BASE = 5;
const total = p => BASE + (p.coracoes || 0) + (gostos[p.id] != null && (p.coracoes || 0) <= gostos[p.id] ? 1 : 0);
function cartaoMural(p) {
  const el = document.createElement("article");
  el.className = "adv-cartao" + (p.meu ? " meu" : ""); el.dataset.id = p.id;
  const quem = escapar(p.nome) + (p.idade ? ", " + escapar(String(p.idade)) : "");
  el.innerHTML = `${p.meu ? '<span class="adv-teu">O teu desenho</span>' : ""}<div class="adv-mini" role="img" aria-label="Desenho do dia ${p.dia} pintado por ${quem}"></div>
    <div class="adv-pe"><span class="adv-quem">${quem}<small>Dia ${p.dia}</small></span><button class="adv-coracao" type="button"></button></div>`;
  const b = el.querySelector(".adv-coracao");
  const mostrar = n => {
    const dei = gostos[p.id] != null;
    // Sem números (pedido do Jose): só o coração. O n continua a contar por dentro (para a animação).
    b.innerHTML = `<span class="adv-c-ico">${p.meu || dei ? "♥" : "♡"}</span>`;
    b.setAttribute("aria-pressed", String(dei));
    b.setAttribute("aria-label", p.meu ? "Corações no teu desenho" : dei ? "Já deste um coração" : "Dar um coração");
  };
  if (p.meu) {
    b.disabled = true;   // não se dá coração ao próprio desenho
    const antes = vistos[p.id] != null ? vistos[p.id] : 0, agora = total(p);
    mostrar(antes);
    el.animarMeu = () => { animarCoracoes(el, b, antes, agora, mostrar); vistos[p.id] = agora; gravar(CHAVE_VISTOS, vistos); };
    observarMeus.observe(el);
  } else {
    mostrar(total(p));
    b.addEventListener("click", () => {
      if (gostos[p.id] != null) return;
      gostos[p.id] = p.coracoes || 0; gravar(CHAVE_GOSTOS, gostos);
      b.classList.remove("pop"); void b.offsetWidth; if (MOVIMENTO) b.classList.add("pop");
      mostrar(total(p));
      if (!/^(ex|meu-)/.test(p.id)) enviar("advento_voto", { id: p.id, voterId: votante() });
    });
  }
  observar.observe(el);
  return el;
}
// Os corações novos "voam" para o teu desenho e o número sobe. Sem corações novos: o coração só pulsa.
function animarCoracoes(el, b, de, ate, mostrar) {
  if (!MOVIMENTO || ate <= de) {
    mostrar(ate);
    if (MOVIMENTO) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
    return;
  }
  const novos = ate - de, n = Math.min(novos, 8);
  for (let i = 0; i < n; i++) {
    const c = document.createElement("span");
    c.className = "adv-voa"; c.textContent = "♥";
    c.style.left = 15 + Math.random() * 70 + "%"; c.style.animationDelay = i * 110 + "ms";
    el.appendChild(c);
    setTimeout(() => c.remove(), 1600 + i * 110);
  }
  const t0 = performance.now(), dur = 600 + n * 110;
  (function passo(t) {
    const k = Math.min(1, (t - t0) / dur);
    mostrar(Math.round(de + (ate - de) * k));
    if (k < 1) requestAnimationFrame(passo);
    else { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
  })(t0 + 300);
}
const observarMeus = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  observarMeus.unobserve(e.target); setTimeout(() => e.target.animarMeu && e.target.animarMeu(), 250);
}), { threshold: 0.6 }) : { observe: el => el.animarMeu && el.animarMeu() };
// Só desenha a miniatura quando o cartão aparece no ecrã.
const observar = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  observar.unobserve(e.target); miniatura(e.target);
}), { rootMargin: "200px" }) : { observe: el => miniatura(el), unobserve() {} };
function miniatura(el) {
  const p = mural.find(x => x.id === el.dataset.id) || EXEMPLOS().find(x => x.id === el.dataset.id);
  if (!p) return;
  desenho(p.dia).then(t => { const m = montar(t, p.cores, p.tracos); m.svg.setAttribute("aria-hidden", "true"); el.querySelector(".adv-mini").appendChild(m.svg); })
    .catch(() => { el.querySelector(".adv-mini").innerHTML = '<div class="adv-vazio">🎨</div>'; });
}

function chips() {
  const el = $("adv-chips");
  const ops = ["todos"].concat(Array.from({ length: diasDoMural }, (_, i) => i + 1));
  el.innerHTML = ops.map(o => `<button type="button" role="tab" data-f="${o}" aria-selected="${String(o) === String(filtro)}">${o === "todos" ? "Todos" : "Dia " + o}</button>`).join("");
  el.onclick = e => { const b = e.target.closest("button"); if (!b) return; filtro = b.dataset.f; chips(); grelha(); };
}
function grelha() {
  const el = $("adv-grelha");
  const lista = mural.filter(p => filtro === "todos" || String(p.dia) === String(filtro));
  el.innerHTML = "";
  if (!lista.length) {
    el.innerHTML = `<p class="adv-vazio"><img src="img/mascote/presente.webp" alt="" width="90" height="111">${mural.length ? "Ainda não há desenhos deste dia." : "Ainda não há desenhos no mural. Pinta o de hoje e envia!"}</p>`;
    return;
  }
  lista.forEach(p => el.appendChild(cartaoMural(p)));
}
// "Os preferidos da semana": 3 desenhos, sem números. Se a criança tem desenhos, um deles está sempre lá.
function preferidos() {
  const caixa = $("adv-preferidos"), g = $("adv-preferidos-grelha");
  const pontos = p => (p.semana || 0) * 1000 + (p.coracoes || 0);
  const meu = mural.filter(p => p.meu).sort((a, b) => pontos(b) - pontos(a))[0];
  const outros = mural.filter(p => !p.meu).sort((a, b) => pontos(b) - pontos(a)).slice(0, meu ? 2 : 3);
  const lista = (meu ? [meu] : []).concat(outros);
  caixa.hidden = lista.length < 3;
  g.innerHTML = "";
  if (lista.length >= 3) lista.forEach(p => g.appendChild(cartaoMural(p)));
}
// Os desenhos que este telemóvel enviou aparecem logo, até a Sheet os devolver (no máximo 1 dia).
// Os desenhos que este telemóvel enviou: aparecem logo (até a Sheet os devolver) e ficam marcados como "meus".
function juntarMeus(lista) {
  const igual = (a, b) => a.dia === b.dia && a.nome === b.nome && JSON.stringify(a.cores) === JSON.stringify(b.cores) && (a.tracos || "") === (b.tracos || "");
  const ids = new Set(ler(CHAVE_MEUS_IDS, []));
  const pendentes = ler(CHAVE_MEUS, []).filter(m => {
    const ja = lista.find(p => igual(p, m) && !ids.has(p.id));
    if (ja) { ids.add(ja.id); if (vistos[m.id] != null) { vistos[ja.id] = vistos[m.id]; gravar(CHAVE_VISTOS, vistos); } return false; }
    return Date.now() - m.t < 864e5;
  });
  gravar(CHAVE_MEUS, pendentes); gravar(CHAVE_MEUS_IDS, [...ids]);
  return pendentes.map(m => ({ ...m, meu: true })).concat(lista.map(p => ({ ...p, meu: ids.has(p.id) })));
}
// Ordem: os teus primeiro; depois os novos (menos de 1 dia), do mais recente; depois por corações.
function ordenar(lista) {
  const agora = Date.now(), novo = p => p.t && agora - p.t < 864e5, recente = (a, b) => (b.t || 0) - (a.t || 0);
  const meus = lista.filter(p => p.meu).sort(recente), outros = lista.filter(p => !p.meu);
  return meus.concat(outros.filter(novo).sort(recente), outros.filter(p => !novo(p)).sort((a, b) => ((b.coracoes || 0) - (a.coracoes || 0)) || recente(a, b)));
}
function mostrarMural(d) {
  ultimoMural = d;
  const lista = (d && Array.isArray(d.pinturas) ? d.pinturas : []).filter(p => p && p.id && p.dia >= 1 && p.dia <= N_DIAS && Array.isArray(p.cores));
  mural = ordenar(MODO_TESTE || P.has("mural-teste") ? lista : juntarMeus(lista));
  preferidos(); chips(); grelha();
}
// Como o resto do site: mostra logo a cópia guardada e atualiza quando a Sheet responder (só se mudou).
function carregarMural() {
  if (MODO_TESTE || P.has("mural-teste")) { mostrarMural({ pinturas: ultimoMural ? ultimoMural.pinturas : EXEMPLOS() }); return; }
  const c = ler(CHAVE_MURAL, null);
  let visto = c ? JSON.stringify(c) : null;
  mostrarMural(c);
  fetch(ENDPOINT + "?acao=advento", { signal: AbortSignal.timeout(15000) })
    .then(r => r.json())
    .then(d => {
      if (!d || !Array.isArray(d.pinturas)) return;
      gravar(CHAVE_MURAL, d);
      if (JSON.stringify(d) !== visto) { visto = JSON.stringify(d); mostrarMural(d); }
    }).catch(() => {});
}

// ---------- Modo de edição (?editar=1): o Jose põe os 24 números no sítio ----------
const EDITAR = P.get("editar") === "1";
function modoEditar() {
  let qual = pc.matches ? "pc" : "telemovel";
  const pos = { pc: (posicoes.pc || []).slice(), telemovel: (posicoes.telemovel || []).slice() };
  const img = $("adv-img"), source = document.querySelector(".adv-cena source");
  const painel = document.createElement("div");
  painel.className = "adv-editar";
  painel.innerHTML = `<p id="adv-ed-txt"></p>
    <button type="button" data-a="desfazer">Desfazer</button><button type="button" data-a="limpar">Limpar</button>
    <button type="button" data-a="trocar"></button><button type="button" data-a="copiar">Copiar JSON</button>`;
  cena.before(painel);
  cena.classList.add("adv-editando");
  const proximo = () => { for (let n = 1; n <= N_DIAS; n++) if (!pos[qual].some(p => p.dia === n)) return n; return 0; };
  function pintar() {
    // Força a imagem do modo escolhido (pc ou telemóvel), seja qual for o ecrã.
    source.media = qual === "pc" ? "all" : "not all";
    img.src = "img/advento/cenario-" + (qual === "pc" ? "pc" : "telemovel") + ".webp";
    const n = proximo();
    $("adv-ed-txt").innerHTML = (n ? `Toca na imagem para pôr o dia <b>${n}</b>.` : "Os 24 estão postos.") + ` Arrasta para acertar. (${qual === "pc" ? "computador" : "telemóvel"})`;
    painel.querySelector('[data-a="trocar"]').textContent = qual === "pc" ? "Ver telemóvel" : "Ver computador";
    numeros.innerHTML = "";
    pos[qual].forEach(p => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "adv-num"; b.textContent = p.dia;
      b.style.left = p.x + "%"; b.style.top = p.y + "%";
      b.addEventListener("pointerdown", ev => {
        ev.stopPropagation(); b.setPointerCapture(ev.pointerId);
        const mexe = e2 => { const r = numeros.getBoundingClientRect();
          p.x = Math.round(Math.min(100, Math.max(0, (e2.clientX - r.left) / r.width * 100)) * 10) / 10;
          p.y = Math.round(Math.min(100, Math.max(0, (e2.clientY - r.top) / r.height * 100)) * 10) / 10;
          b.style.left = p.x + "%"; b.style.top = p.y + "%"; };
        b.addEventListener("pointermove", mexe);
        b.addEventListener("pointerup", () => b.removeEventListener("pointermove", mexe), { once: true });
      });
      numeros.appendChild(b);
    });
  }
  numeros.addEventListener("pointerdown", e => {
    if (e.target !== numeros) return;
    const n = proximo(); if (!n) return;
    const r = numeros.getBoundingClientRect();
    pos[qual].push({ dia: n, x: Math.round((e.clientX - r.left) / r.width * 1000) / 10, y: Math.round((e.clientY - r.top) / r.height * 1000) / 10 });
    pintar();
  });
  painel.addEventListener("click", e => {
    const a = e.target.dataset.a; if (!a) return;
    if (a === "desfazer") { const n = proximo() || N_DIAS + 1; const ult = pos[qual].reduce((m, p) => p.dia > m ? p.dia : m, 0); pos[qual] = pos[qual].filter(p => p.dia !== ult); void n; }
    if (a === "limpar" && confirm("Tirar todos os números deste cenário?")) pos[qual] = [];
    if (a === "trocar") qual = qual === "pc" ? "telemovel" : "pc";
    if (a === "copiar") {
      const ord = l => l.slice().sort((x, y) => x.dia - y.dia).map(p => ({ dia: p.dia, x: p.x, y: p.y }));
      copiar(JSON.stringify({ pc: ord(pos.pc), telemovel: ord(pos.telemovel) }), e.target);
      e.target.textContent = "Copiado ✓"; setTimeout(() => { e.target.textContent = "Copiar JSON"; }, 2000);
    }
    pintar();
  });
  pintar();
}

// ---------- Arrancar ----------
cabecalho();
fetch("data/advento-numeros.json", { cache: "no-cache" }).then(r => r.json()).catch(() => provisorias())
  .then(d => { posicoes = d && d.pc ? d : provisorias(); if (EDITAR) modoEditar(); else desenharNumeros(); });
pc.addEventListener ? pc.addEventListener("change", desenharNumeros) : pc.addListener(desenharNumeros);
carregarMural();
avisoTeste();
// ?abrir=7 abre logo o dia (para links partilhados), se já estiver aberto.
const pedido = Number(P.get("abrir"));
if (pedido && aberto(pedido)) abrir(pedido);
})();
