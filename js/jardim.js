// O jardim dos apoiantes (página de teste: jardim.html).
// Cada apoiante é uma flor num jardim de Fão. Tamanho da flor = nível (vem da Sheet; nunca mostra €).
// Arrastar para passear, zoom com + / − / roda do rato / dois dedos, tocar numa flor abre o cartão.
// Lugares: gerados sempre iguais (semente fixa) e escolhidos pelo nome → cada flor fica sempre no mesmo sítio.

(() => {
const MUNDO = { W: 2172, H: 724, fundo: "img/jardim/fundo.webp" };

// Níveis: cabeça (px do fundo), caule, espaço entre flores, disco do miolo (raio / largura da cabeça).
const NIVEIS = {
  sol:      { nome: "Sol",      frase: "Os grandes amigos da escola", ajuda: "Nível de ajuda: enorme", cab: 100, caule: 4, alto: 100, dist: 175, variantes: 3, r: .2 },
  girassol: { nome: "Girassol", frase: "Ajudaram muito", ajuda: "Nível de ajuda: muito",              cab: 62, caule: 3, alto: 64, dist: 104,  variantes: 4, r: .24 },
  flor:     { nome: "Flor",     frase: "Ajudaram a crescer", ajuda: "Nível de ajuda: bastante",          cab: 44, caule: 2, alto: 44, dist: 70,  variantes: 8, r: .23 },
  botao:    { nome: "Botão",    frase: "Toda a ajuda conta", ajuda: "Toda a ajuda conta",          cab: 32, caule: 1, alto: 30, dist: 50,  variantes: 8, r: .21 },
};
const ORDEM = ["sol", "girassol", "flor", "botao"];

// Onde se pode plantar (ponto onde o caule toca na relva). Coordenadas da imagem de fundo.
const ZONAS = {
  sol:      [{ x: [700, 1480], y: [420, 500] }],
  girassol: [{ x: [240, 1960], y: [370, 500] }],
  flor:     [{ x: [60, 2110],  y: [425, 610] }],
  botao:    [{ x: [30, 2140],  y: [490, 716] }],
};
// Sítios proibidos: passadiço (largura cresce para baixo), cercas, Lumi, dunas.
const PASSADICO = [[1130, 724], [1150, 640], [1210, 560], [1290, 470], [1350, 400], [1410, 330], [1440, 290]];
const PROIBIDO = [
  { x: [0, 270], y: [555, 724] }, { x: [425, 745], y: [550, 690] },
  { x: [1435, 1790], y: [550, 690] }, { x: [1890, 2172], y: [555, 724] },
  { x: [800, 940], y: [520, 724] },                 // Lumi
  { x: [1480, 2172], y: [280, 345] },               // dunas
];
const LUMI = { x: 870, y: 712, alto: 170 };

// Tipo de negócio (coluna da Sheet) → emoji 3D.
const EMOJI = {
  loja: "saco-compras", florista: "ramo-flores", restaurante: "prato-talheres", dentista: "dente", roupa: "t-shirt",
  particular: "coracao", supermercado: "carrinho", beleza: "massagem", pastelaria: "bolo", cafe: "cafe", cafetaria: "cafe",
  desporto: "biceps", barbearia: "poste-barbeiro", cabeleireiro: "tesoura", diversao: "macaco", tecnologia: "telemovel",
  lavandaria: "bolhas", talho: "carne", otica: "oculos", farmacia: "comprimido", musica: "nota-musica", grafica: "impressora",
  construcao: "tijolos", serralharia: "chave-inglesa", estufas: "vaso-planta", jardim: "vaso-planta", associacao: "aperto-de-mao",
};
// Enquanto o Apps Script não manda "nivel", usa o tamanho antigo.
const DO_TAMANHO = { grande: "girassol", alto: "flor", largo: "flor", pequeno: "botao" };

// ---------- utilitários ----------
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const normal = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const dentro = (p, z) => p[0] >= z.x[0] && p[0] <= z.x[1] && p[1] >= z.y[0] && p[1] <= z.y[1];
function noPassadico(p) {
  for (let i = 1; i < PASSADICO.length; i++) {
    const a = PASSADICO[i - 1], b = PASSADICO[i];
    if (p[1] > a[1] + 30 || p[1] < b[1] - 30) continue;
    const t = Math.max(0, Math.min(1, (p[1] - a[1]) / (b[1] - a[1] || 1)));
    const cx = a[0] + (b[0] - a[0]) * t, meia = 26 + (p[1] - 290) / 434 * 150;
    if (Math.abs(p[0] - cx) < meia) return true;
  }
  return false;
}
const persp = y => .78 + .38 * (y - 300) / 424;   // mais à frente = um pouco maior

function textoLink(url) {
  if (/google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url)) return "Ver no mapa";
  if (/instagram\.com/i.test(url)) return "Ver no Instagram";
  if (/facebook\.com|fb\.com/i.test(url)) return "Ver no Facebook";
  return "Ver no website";
}

// ---------- lugares (sempre os mesmos) ----------
function gerarLugares() {
  const todos = [], por = {};
  [1, .8, .66].forEach((f, ronda) => ORDEM.forEach(nv => {
    const r = rng(hash("lugares" + nv + ronda)), d = NIVEIS[nv].dist * f;
    por[nv] = por[nv] || [];
    for (let t = 0; t < 5000; t++) {
      const z = ZONAS[nv][0], p = [z.x[0] + r() * (z.x[1] - z.x[0]), z.y[0] + r() * (z.y[1] - z.y[0])];
      if (noPassadico(p) || PROIBIDO.some(q => dentro(p, q))) continue;
      if (todos.some(q => Math.hypot(p[0] - q.x, (p[1] - q.y) * 1.5) < Math.min(d, NIVEIS[q.nv].dist * f) * (q.nv === nv ? 1 : .75))) continue;
      const l = { x: p[0], y: p[1], nv, ronda, i: por[nv].length }; todos.push(l); por[nv].push(l);
    }
  }));
  return por;
}

// ---------- montar o jardim ----------
const vista = document.getElementById("jardim-vista"), mundo = document.getElementById("jardim-mundo");
const nomes = document.getElementById("jardim-nomes"), cartao = document.getElementById("jardim-cartao");
let flores = [], cam = { s: 1, x: 0, y: 0 }, minS = 1, maxS = 4, aberta = null;

// Com poucas flores o jardim fica vazio: as flores crescem. Com ~80 ou mais ficam no tamanho normal.
// Os lugares não mudam (só o tamanho), por isso ninguém salta de sítio quando entram flores novas.
const fatorTamanho = n => Math.min(1.4, Math.max(1, Math.sqrt(80 / Math.max(n, 1))));

function plantar(lista) {
  const por = gerarLugares(), ocup = {}, F = fatorTamanho(lista.length);
  ORDEM.forEach(nv => ocup[nv] = new Set());
  lista.forEach((a, ordem) => {
    const nv = NIVEIS[a.nivel] ? a.nivel : (DO_TAMANHO[a.tamanho] || "botao");
    const lugares = por[nv], confortaveis = lugares.filter(l => l.ronda === 0).length || lugares.length;
    let i = hash(normal(a.nome)) % confortaveis, n = 0;
    while (ocup[nv].has(i) && n < lugares.length) { i = (i + 1) % lugares.length; n++; }
    if (ocup[nv].has(i)) return;   // jardim cheio neste nível (não deve acontecer)
    ocup[nv].add(i);
    const l = lugares[i], N = NIVEIS[nv], p = persp(l.y) * [1, .88, .78][l.ronda];
    const v = hash(a.nome + "v") % N.variantes + 1;
    flores.push({ a, nv, x: l.x, y: l.y, cab: N.cab * p * F, alto: N.alto * p * F, v, ordem });
  });
  // Os de trás primeiro (os da frente tapam os de trás).
  flores.sort((f, g) => f.y - g.y).forEach(f => {
    const N = NIVEIS[f.nv], el = document.createElement("button");
    el.type = "button"; el.className = "flor n-" + f.nv;
    el.setAttribute("aria-label", `${f.a.nome} (${N.nome})`);
    el.style.cssText = `left:${f.x}px;top:${f.y}px;--cab:${f.cab.toFixed(1)}px;--alto:${f.alto.toFixed(1)}px;--d:${-(hash(f.a.nome) % 50) / 10}s`;
    const emoji = EMOJI[f.a.tipo] || "coracao";
    el.innerHTML = `<img class="caule" src="img/jardim/flores/caule-${N.caule}.webp" alt="" draggable="false">
      <span class="cabeca"><img src="img/jardim/flores/${f.nv}-${f.v}.webp" alt="" draggable="false">
      <img class="emoji" src="img/jardim/emojis/${emoji}.webp" alt="" draggable="false" style="--r:${N.r}"></span>`;
    el.addEventListener("click", e => { if (arrastou) return; e.stopPropagation(); enquadrar(); abrir(f); });
    f.el = el; mundo.appendChild(el);
    const n = document.createElement("span"); n.className = "jnome n-" + f.nv; n.textContent = f.a.nome; f.nomeEl = n; nomes.appendChild(n);
  });
  const lumi = document.createElement("img");
  lumi.src = "img/mascote/bracos.webp"; lumi.alt = ""; lumi.className = "jardim-lumi"; lumi.draggable = false;
  lumi.style.cssText = `left:${LUMI.x}px;top:${LUMI.y}px;height:${LUMI.alto}px`;
  mundo.appendChild(lumi);
  document.getElementById("jardim-conta").textContent = flores.length;
  ORDEM.forEach(nv => { const c = document.querySelector(`[data-conta="${nv}"]`); if (c) c.textContent = flores.filter(f => f.nv === nv).length; });
}

// ---------- câmara (passear e zoom) ----------
function limites() {
  const w = vista.clientWidth, h = vista.clientHeight;
  minS = Math.max(w / MUNDO.W, h / MUNDO.H); maxS = minS * 5;
}
function aplicar() {
  const w = vista.clientWidth, h = vista.clientHeight;
  cam.s = Math.min(maxS, Math.max(minS, cam.s));
  cam.x = Math.min(0, Math.max(w - MUNDO.W * cam.s, cam.x));
  cam.y = Math.min(0, Math.max(h - MUNDO.H * cam.s, cam.y));
  mundo.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`;
  document.getElementById("zoom-menos").disabled = cam.s <= minS * 1.01;
  document.getElementById("zoom-mais").disabled = cam.s >= maxS * .99;
  pedirNomes();
  if (aberta) posicionarCartao();
}
function zoomEm(fator, px, py) {
  const s0 = cam.s, s1 = Math.min(maxS, Math.max(minS, s0 * fator));
  cam.x = px - (px - cam.x) * s1 / s0; cam.y = py - (py - cam.y) * s1 / s0; cam.s = s1; aplicar();
}
let voo = null;
function voar(alvo, ms = 650) {
  cancelAnimationFrame(voo);
  if (!MOVIMENTO) { cam = alvo; aplicar(); return; }
  const de = { ...cam }, t0 = performance.now();
  const passo = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    cam = { s: de.s + (alvo.s - de.s) * e, x: de.x + (alvo.x - de.x) * e, y: de.y + (alvo.y - de.y) * e }; aplicar();
    if (k < 1) voo = requestAnimationFrame(passo); };
  voo = requestAnimationFrame(passo);
}
function centrarEm(wx, wy, s, alturaY = .5) {
  const w = vista.clientWidth, h = vista.clientHeight; s = Math.min(maxS, Math.max(minS, s));
  return { s, x: w / 2 - wx * s, y: h * alturaY - wy * s };
}
function inicio() {
  limites();
  // Começa no centro do jardim (os Sóis), a mostrar a altura toda.
  cam = centrarEm(MUNDO.W / 2, MUNDO.H / 2, minS); aplicar();
}

// ---------- gestos ----------
// Na página (telemóvel): 1 dedo faz scroll à página; 2 dedos passeiam e fazem zoom; tocar numa flor abre-a.
// Em ecrã inteiro ("Passear no jardim"): 1 dedo passeia. No PC: arrastar com o rato passeia;
// a roda do rato desce a página e Ctrl/⌘ + roda faz zoom (em ecrã inteiro, a roda faz zoom).
let cheio = false;
const toques = new Map(); let arrastou = false, ini = null, avisado = false, enquadrado = false;
const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const avisoGesto = document.getElementById("jardim-aviso-gesto");
let avisoT = 0;
function avisar(texto) {
  avisoGesto.textContent = texto; avisoGesto.hidden = false;
  clearTimeout(avisoT); avisoT = setTimeout(() => { avisoGesto.hidden = true; }, 1600);
}
// Se o jardim está cortado no ecrã, a página desliza para o mostrar inteiro (só uma vez, só se for preciso).
function enquadrar() {
  if (cheio || enquadrado) return;
  const r = vista.getBoundingClientRect(), H = innerHeight;
  if (r.top >= 0 && r.bottom <= H) return;
  enquadrado = true;
  scrollBy({ top: r.top - Math.max(8, (H - r.height) / 2), behavior: MOVIMENTO ? "smooth" : "auto" });
}
vista.addEventListener("pointerdown", e => {
  if (e.target.closest(".jardim-zoom, .jardim-cartao, .jardim-cheio-botao")) return;
  toques.set(e.pointerId, { x: e.clientX, y: e.clientY, tipo: e.pointerType });
  arrastou = false; avisado = false; ini = { cam: { ...cam }, toques: new Map(toques) };
  cancelAnimationFrame(voo);
  if (toques.size >= 2 || e.pointerType !== "touch" || cheio) { vista.classList.add("ja-mexeu", "a-arrastar"); }
  if (toques.size >= 2) enquadrar();
});
// 2 dedos na página: o browser não faz scroll nem zoom à página (o jardim é que mexe).
vista.addEventListener("touchmove", e => { if (e.touches.length >= 2 || cheio) e.preventDefault(); }, { passive: false });
addEventListener("pointermove", e => {
  if (!toques.has(e.pointerId)) return;
  toques.set(e.pointerId, { x: e.clientX, y: e.clientY, tipo: e.pointerType });
  const r = vista.getBoundingClientRect(), pts = [...toques.values()], ant = [...ini.toques.values()];
  if (pts.length === 1 && ant.length >= 1) {
    const dx = pts[0].x - ant[0].x, dy = pts[0].y - ant[0].y, longe = Math.abs(dx) + Math.abs(dy) > 8;
    if (e.pointerType === "touch" && !cheio) {          // 1 dedo na página: não mexe no jardim
      if (longe) { arrastou = true; if (!avisado) { avisado = true; avisar("Usa dois dedos para passear, ou toca em ⛶ Passear no jardim"); } }
      return;
    }
    if (longe) arrastou = true;
    if (arrastou) { cam.x = ini.cam.x + dx; cam.y = ini.cam.y + dy; aplicar(); }
  } else if (pts.length >= 2 && ant.length >= 2) {
    arrastou = true;
    const d0 = Math.hypot(ant[0].x - ant[1].x, ant[0].y - ant[1].y) || 1, d1 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const c0 = { x: (ant[0].x + ant[1].x) / 2 - r.left, y: (ant[0].y + ant[1].y) / 2 - r.top };
    const c1 = { x: (pts[0].x + pts[1].x) / 2 - r.left, y: (pts[0].y + pts[1].y) / 2 - r.top };
    const s = Math.min(maxS, Math.max(minS, ini.cam.s * d1 / d0));
    cam.s = s; cam.x = c1.x - (c0.x - ini.cam.x) * s / ini.cam.s; cam.y = c1.y - (c0.y - ini.cam.y) * s / ini.cam.s; aplicar();
  }
});
function fim(e) {
  if (!toques.has(e.pointerId)) return;
  toques.delete(e.pointerId);
  if (toques.size) ini = { cam: { ...cam }, toques: new Map(toques) };
  else { vista.classList.remove("a-arrastar"); setTimeout(() => { arrastou = false; }, 0); }
}
addEventListener("pointerup", fim); addEventListener("pointercancel", fim);
vista.addEventListener("wheel", e => {
  if (!cheio && !e.ctrlKey && !e.metaKey) { avisar(`Usa ${MAC ? "⌘" : "Ctrl"} + roda para aproximar`); return; }   // a página desce
  e.preventDefault(); const r = vista.getBoundingClientRect();
  zoomEm(Math.exp(-e.deltaY * .0018), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

// ---------- ecrã inteiro ("Passear no jardim") ----------
// No iPhone não há ecrã inteiro para uma caixa: a caixa passa a ocupar o ecrã (position: fixed) e a página fica parada.
const botaoCheio = document.getElementById("jardim-cheio");
function centroMundo() { return { x: (vista.clientWidth / 2 - cam.x) / cam.s, y: (vista.clientHeight / 2 - cam.y) / cam.s }; }
function entrarCheio(semHistoria) {
  if (cheio) return;
  const c = centroMundo(), s = cam.s;
  cheio = true; document.documentElement.classList.add("jardim-cheio-aberto"); vista.classList.add("cheio", "ja-mexeu");
  botaoCheio.textContent = "✕ Sair"; botaoCheio.setAttribute("aria-label", "Sair do ecrã inteiro");
  limites(); cam = centrarEm(c.x, c.y, Math.max(s, minS)); aplicar();
  if (!semHistoria) history.pushState({ jardim: "cheio" }, "");
  vista.focus({ preventScroll: true });
}
function sairCheio(daHistoria) {
  if (!cheio) return;
  const c = centroMundo(), s = cam.s;
  cheio = false; document.documentElement.classList.remove("jardim-cheio-aberto"); vista.classList.remove("cheio");
  botaoCheio.textContent = "⛶ Passear no jardim"; botaoCheio.setAttribute("aria-label", "Passear no jardim em ecrã inteiro");
  limites(); cam = centrarEm(c.x, c.y, s); aplicar();
  if (!daHistoria && history.state && history.state.jardim) history.back();
  enquadrado = false;
}
botaoCheio.onclick = e => { e.stopPropagation(); cheio ? sairCheio() : entrarCheio(); };
addEventListener("popstate", () => { if (cheio) sairCheio(true); });
vista.addEventListener("dblclick", e => { const r = vista.getBoundingClientRect(); zoomEm(1.8, e.clientX - r.left, e.clientY - r.top); });
vista.addEventListener("click", () => { if (!arrastou && aberta) fechar(); });
document.getElementById("zoom-mais").onclick = e => { e.stopPropagation(); zoomEm(1.6, vista.clientWidth / 2, vista.clientHeight / 2); };
document.getElementById("zoom-menos").onclick = e => { e.stopPropagation(); zoomEm(1 / 1.6, vista.clientWidth / 2, vista.clientHeight / 2); };
vista.addEventListener("keydown", e => {
  const m = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }[e.key];
  if (m) { e.preventDefault(); cam.x += m[0]; cam.y += m[1]; aplicar(); }
  if (e.key === "+" || e.key === "=") zoomEm(1.4, vista.clientWidth / 2, vista.clientHeight / 2);
  if (e.key === "-") zoomEm(1 / 1.4, vista.clientWidth / 2, vista.clientHeight / 2);
  if (e.key === "Escape") { if (aberta) fechar(); else if (cheio) sairCheio(); }
});

// ---------- nomes (aparecem quando a flor já é grande no ecrã; não se tapam) ----------
let pedido = 0;
function pedirNomes() { if (!pedido) pedido = requestAnimationFrame(() => { pedido = 0; mostrarNomes(); }); }
function mostrarNomes() {
  const W = vista.clientWidth, H = vista.clientHeight, postos = [];
  const ordem = flores.slice().sort((f, g) => ORDEM.indexOf(f.nv) - ORDEM.indexOf(g.nv) || g.y - f.y);
  for (const f of ordem) {
    const cabPx = f.cab * cam.s, x = cam.x + f.x * cam.s, topo = cam.y + (f.y - f.alto - f.cab * .1) * cam.s;
    const quer = cabPx >= (f.nv === "sol" ? 30 : 46) || f === aberta || f.achada;
    const n = f.nomeEl;
    if (!quer || x < -60 || x > W + 60 || topo < -20 || topo > H + 20) { n.hidden = true; continue; }
    n.hidden = false; n.style.left = x + "px"; n.style.top = topo + "px";
    const w = n.offsetWidth, h = n.offsetHeight, cx = Math.min(Math.max(x, w / 2 + 4), W - w / 2 - 4), r = [cx - w / 2, topo, cx + w / 2, topo + h];
    n.style.left = cx + "px";
    const choca = postos.some(q => r[0] < q[2] + 2 && r[2] + 2 > q[0] && r[1] < q[3] + 1 && r[3] + 1 > q[1]);
    if (choca && f !== aberta && !f.achada) { n.hidden = true; continue; }
    postos.push(r);
  }
}

// ---------- cartão ----------
function abrir(f) {
  aberta = f; const a = f.a, N = NIVEIS[f.nv];
  flores.forEach(g => g.el.classList.toggle("aberta", g === f));
  const emoji = EMOJI[a.tipo] || "coracao";
  const imagem = a.logo ? `<img class="desfocada" src="${escapar(a.logo)}" alt="" aria-hidden="true"><img src="${escapar(a.logo)}" alt="">` : `<img class="so-emoji" src="img/jardim/emojis/${emoji}.webp" alt="">`;
  const url = a.maps_url ? escapar(a.maps_url) : "";
  // Imagem grande; tocar nela leva ao site / mapa do apoiante.
  const foto = url ? `<a class="jc-foto" href="${url}" target="_blank" rel="noopener" aria-label="${escapar(a.nome)}: ${textoLink(a.maps_url)}">${imagem}</a>`
                   : `<span class="jc-foto">${imagem}</span>`;
  const link = url ? `<a class="botao-amarelo" href="${url}" target="_blank" rel="noopener">${textoLink(a.maps_url)} ›</a>` : "";
  cartao.innerHTML = `<button class="fechar" type="button" aria-label="Fechar">✕</button>${foto}
    <h3>${escapar(a.nome)}</h3><span class="jc-nivel n-${f.nv}"><img src="img/jardim/flores/${f.nv}-1.webp" alt="">${N.nome}<i>·</i>${N.ajuda}</span>${link}`;
  cartao.querySelector(".fechar").onclick = e => { e.stopPropagation(); fechar(); };
  cartao.hidden = false;
  // Se a flor está pequena ou na beira, aproxima um pouco.
  const cabPx = f.cab * cam.s, sx = cam.x + f.x * cam.s, sy = cam.y + f.y * cam.s;
  const movel = vista.clientWidth < 600;
  if (movel || cabPx < 34 || sx < 40 || sx > vista.clientWidth - 40 || sy < 80 || sy > vista.clientHeight) voar(centrarEm(f.x, f.y - f.alto, Math.max(cam.s, 46 / f.cab), movel ? .2 : .5));
  aplicar();
}
function fechar() { aberta = null; cartao.hidden = true; flores.forEach(g => g.el.classList.remove("aberta")); pedirNomes(); }
function posicionarCartao() {
  const f = aberta, W = vista.clientWidth, H = vista.clientHeight, w = cartao.offsetWidth, h = cartao.offsetHeight;
  const cx = cam.x + f.x * cam.s, cy = cam.y + (f.y - f.alto) * cam.s, raio = f.cab * cam.s / 2;
  if (W < 600) { cartao.style.left = "8px"; cartao.style.top = (H - h - 8) + "px"; return; }   // telemóvel: em baixo, largura toda
  let x = cx + raio + 10, y = cy - h / 2;
  if (x + w > W - 8) x = cx - raio - 10 - w;
  if (x < 8) { x = Math.min(Math.max(8, cx - w / 2), W - w - 8); y = cy + raio + 26; if (y + h > H - 8) y = cy - raio - h - 10; }
  cartao.style.left = x + "px"; cartao.style.top = Math.max(8, Math.min(y, H - h - 8)) + "px";
}

// ---------- procurar ----------
const procura = document.getElementById("jardim-procura"), msg = document.getElementById("jardim-procura-msg");
const resultados = document.getElementById("jardim-resultados");
function irPara(f) {
  if (vista.clientWidth < 600 || matchMedia("(pointer: coarse)").matches) entrarCheio(); else enquadrar();
  // A lista fica aberta, para poder escolher outra.
  resultados.querySelectorAll('button').forEach(b => b.classList.toggle('ativo', b.querySelector('span').textContent === f.a.nome));
  flores.forEach(g => { g.achada = g === f; g.el.classList.toggle("achada", g === f); });
  voar(centrarEm(f.x, f.y - f.alto, Math.max(minS * 2.2, 60 / f.cab), vista.clientWidth < 600 ? .2 : .5));
  setTimeout(() => abrir(f), MOVIMENTO ? 680 : 0);
}
// Procura em todas as palavras do nome. Vários resultados → lista para escolher; todos ficam marcados no jardim.
function procurar(ir) {
  const q = normal(procura.value.trim());
  flores.forEach(f => { f.achada = false; f.el.classList.remove("achada"); });
  resultados.hidden = true; resultados.innerHTML = "";
  if (q.length < 2) { msg.textContent = ""; pedirNomes(); return; }
  const achadas = flores.filter(g => normal(g.a.nome).includes(q))
    .sort((f, g) => (normal(g.a.nome).startsWith(q) - normal(f.a.nome).startsWith(q)) || ORDEM.indexOf(f.nv) - ORDEM.indexOf(g.nv) || f.a.nome.localeCompare(g.a.nome, "pt"));
  if (!achadas.length) { msg.textContent = "Ainda não está no jardim. Queres plantar a tua flor?"; pedirNomes(); return; }
  msg.textContent = achadas.length > 1 ? `${achadas.length} flores encontradas. Escolhe uma:` : "";
  achadas.forEach(f => { f.achada = true; f.el.classList.add("achada"); });
  if (achadas.length === 1) { if (ir) irPara(achadas[0]); else pedirNomes(); return; }
  achadas.forEach(f => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.innerHTML = `<img src="img/jardim/flores/${f.nv}-1.webp" alt=""><span></span>`;
    b.querySelector("span").textContent = f.a.nome;
    b.onclick = () => irPara(f);
    li.appendChild(b); resultados.appendChild(li);
  });
  resultados.hidden = false;
  if (ir) irPara(achadas[0]); else pedirNomes();
}
procura.addEventListener("input", () => procurar(false));
procura.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); procurar(true); } });
document.getElementById("jardim-ir").onclick = () => procurar(true);

// ---------- arrancar ----------
async function arrancar() {
  const lista = await carregarDados("apoiantes", document.getElementById("jardim-aviso"));
  document.getElementById("jardim-carregar")?.remove();
  if (!lista) return;
  plantar(lista.filter(a => a.publicar));
  inicio();
  // ?flor=nome abre logo a flor (para partilhar).
  const pedida = new URLSearchParams(location.search).get("flor");
  if (pedida) { procura.value = pedida; procurar(true); }
}
addEventListener("resize", () => { const c = centrarEm((vista.clientWidth / 2 - cam.x) / cam.s, (vista.clientHeight / 2 - cam.y) / cam.s, cam.s); limites(); cam = c; aplicar(); });
arrancar();
})();
