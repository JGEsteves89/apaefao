// O novo recreio (recreio.html): o que queremos mudar na escola. Só mostra, não pede dinheiro.
// Dados na Google Sheet, folha recreio.json: "areas" (carrossel antes/depois) e "zonas" (o mapa).

// Antes/depois das zonas da escola, num só cartão: setas e pontos mudam de zona; dentro, arrasta-se para comparar
// (a foto de hoje fica por cima, cortada até à pega; rato, dedo e setas do teclado, porque é um input range).
function carrossel(el, areas) {
  if (!areas || !areas.length) { el.hidden = true; return; }
  el.innerHTML = `
    <div class="r-comp" style="--pos: 50%">
      <img class="r-comp-projeto" alt="">
      <img class="r-comp-hoje" alt="">
      <span class="r-comp-rot hoje">Hoje</span><span class="r-comp-rot projeto">O projeto</span><span class="r-comp-rot sim">Simulação</span>
      <span class="r-comp-pega" aria-hidden="true"></span>
      <input type="range" min="0" max="100" value="50">
      <button class="r-car-seta ant" type="button" aria-label="Zona anterior">‹</button>
      <button class="r-car-seta seg" type="button" aria-label="Zona seguinte">›</button>
    </div>
    <div class="r-car-legenda" aria-live="polite"><b></b><span></span></div>
    <div class="r-car-pontos">${areas.map((a, i) => `<button type="button" aria-label="${escapar(a.titulo)}">${i + 1}</button>`).join("")}</div>`;
  const ad = el.querySelector(".r-comp"), r = ad.querySelector("input"), pontos = [...el.querySelectorAll(".r-car-pontos button")];
  let atual = 0;
  const mostra = i => {
    atual = (i + areas.length) % areas.length;
    const a = areas[atual];
    ad.querySelector(".r-comp-projeto").src = a.projeto;
    ad.querySelector(".r-comp-projeto").alt = a.titulo + ": simulação do projeto";
    ad.querySelector(".r-comp-hoje").src = a.hoje;
    ad.querySelector(".r-comp-hoje").alt = a.titulo + " hoje";
    r.value = 50; ad.style.setProperty("--pos", "50%");
    r.setAttribute("aria-label", a.titulo + ": arrasta para comparar hoje e o projeto");
    el.querySelector(".r-car-legenda b").textContent = a.titulo;
    el.querySelector(".r-car-legenda span").textContent = a.frase || "";
    pontos.forEach((p, n) => { p.classList.toggle("ativo", n === atual); p.setAttribute("aria-current", n === atual); });
  };
  r.addEventListener("input", () => ad.style.setProperty("--pos", r.value + "%"));
  el.querySelector(".ant").addEventListener("click", () => mostra(atual - 1));
  el.querySelector(".seg").addEventListener("click", () => mostra(atual + 1));
  pontos.forEach((p, n) => p.addEventListener("click", () => mostra(n)));
  areas.forEach(a => { new Image().src = a.hoje; new Image().src = a.projeto; });
  mostra(0);
}

// Mapa do recreio: desenho nosso da escola, com a forma da planta geral da Greenplay (não é a planta, que não pode ser copiada).
// Um número por zona; tocar num número mostra a zona: hoje e o projeto, o que vamos fazer
// e "Quero apadrinhar esta parte". Zonas e posições (x, y em % do mapa) em Google Sheet, folha recreio_zonas.
const MAPA_SVG = `<svg viewBox="125 38 1415 1340" role="img" aria-label="Mapa da escola, com o pré-escolar à esquerda e o 1.º ciclo à direita">
  <rect x="129" y="42" width="1407" height="1332" rx="36" fill="#d4e6a6" stroke="#1f1a14" stroke-width="7"/>
  <g fill="#9cc77a" stroke="#6e9a4f" stroke-width="4">
    <circle cx="150" cy="300" r="40"/><circle cx="150" cy="560" r="40"/><circle cx="150" cy="820" r="40"/>
    <circle cx="240" cy="1300" r="70"/><circle cx="420" cy="1320" r="60"/><circle cx="880" cy="1300" r="70"/><circle cx="1060" cy="1330" r="50"/>
    <circle cx="1440" cy="650" r="75"/><circle cx="1480" cy="250" r="45"/><circle cx="560" cy="1060" r="40"/>
  </g>
  <g fill="#efe6d2" stroke="#1f1a14" stroke-width="5">
    <rect x="432" y="160" width="173" height="370"/><rect x="605" y="48" width="335" height="195"/>
    <rect x="768" y="243" width="172" height="287"/><path d="M940 48 H1275 V490 H1105 V163 H940 Z"/>
  </g>
  <text x="772" y="155" text-anchor="middle" class="mapa-txt">Escola</text>
  <path d="M380 530 H940 V163 H1105 V490 H1158 V610 H935 V690 H405 V610 H380 Z" fill="#a9cde6" stroke="#1f1a14" stroke-width="5"/>
  <g stroke="#fff" stroke-width="4"><line x1="420" y1="630" x2="915" y2="630"/><line x1="420" y1="650" x2="915" y2="650"/><line x1="420" y1="670" x2="915" y2="670"/></g>
  <g fill="#9cc77a" stroke="#6e9a4f" stroke-width="4"><circle cx="1022" cy="240" r="26"/><circle cx="1022" cy="320" r="26"/><circle cx="1022" cy="400" r="26"/><circle cx="1022" cy="480" r="26"/><circle cx="1022" cy="565" r="26"/></g>
  <rect x="605" y="243" width="163" height="287" fill="#5aa469" stroke="#1f1a14" stroke-width="5"/>
  <rect x="630" y="268" width="113" height="237" rx="56" fill="none" stroke="#3b8fd6" stroke-width="16"/>
  <line x1="640" y1="386" x2="733" y2="386" stroke="#f5e663" stroke-width="4"/>
  <rect x="218" y="112" width="140" height="80" rx="6" fill="#f3dfa6" stroke="#1f1a14" stroke-width="5"/>
  <path d="M262 182 l14 -50 l14 50 M276 132 h38 M300 132 l14 50 l14 -50" fill="none" stroke="#1f1a14" stroke-width="5"/>
  <rect x="368" y="112" width="204" height="46" rx="6" fill="#6b4a2f" stroke="#1f1a14" stroke-width="5"/>
  <g fill="#e85a7a" stroke="#1f1a14" stroke-width="2"><rect x="400" y="122" width="22" height="22" rx="4"/><rect x="440" y="122" width="22" height="22" rx="4" fill="#f5c542"/><rect x="480" y="122" width="22" height="22" rx="4" fill="#3b8fd6"/><rect x="520" y="122" width="22" height="22" rx="4" fill="#5aa469"/></g>
  <rect x="218" y="198" width="212" height="410" fill="#f5a742" stroke="#1f1a14" stroke-width="5"/>
  <rect x="218" y="198" width="212" height="70" fill="#5aa469"/>
  <path d="M218 520 q53 -30 106 0 t106 0 V608 H218 Z" fill="#3b8fd6"/>
  <rect x="240" y="300" width="76" height="190" rx="38" fill="none" stroke="#8e5bc4" stroke-width="12"/>
  <g fill="#f5e663" stroke="#1f1a14" stroke-width="2"><circle cx="250" cy="572" r="9"/><circle cx="268" cy="572" r="9" fill="#e85a7a"/><circle cx="286" cy="572" r="9" fill="#5aa469"/><circle cx="304" cy="572" r="9"/><circle cx="324" cy="570" r="11" fill="#5aa469"/></g>
  <g fill="#7f9a4a" stroke="#1f1a14" stroke-width="3"><rect x="382" y="282" width="44" height="62"/><rect x="382" y="360" width="44" height="62"/><rect x="382" y="438" width="44" height="62"/><rect x="382" y="516" width="44" height="62"/></g>
  <g fill="#9cc77a" stroke="#6e9a4f" stroke-width="4"><circle cx="345" cy="300" r="24"/><circle cx="345" cy="390" r="24"/><circle cx="345" cy="480" r="24"/></g>
  <g stroke="#1f1a14" stroke-width="2"><rect x="330" y="335" width="12" height="40" rx="3" fill="#3b8fd6"/><rect x="330" y="425" width="12" height="40" rx="3" fill="#e85a7a"/><rect x="330" y="515" width="12" height="40" rx="3" fill="#f5c542"/></g>
  <rect x="190" y="250" width="26" height="390" fill="#a8774a" stroke="#1f1a14" stroke-width="4"/>
  <g fill="#5aa469"><rect x="194" y="290" width="18" height="40"/><rect x="194" y="380" width="18" height="40"/><rect x="194" y="470" width="18" height="40"/><rect x="194" y="560" width="18" height="40"/></g>
  <rect x="190" y="612" width="190" height="210" fill="#c4553d" stroke="#1f1a14" stroke-width="5"/>
  <g transform="translate(250 680)"><circle r="26" fill="#f5c542"/><circle cx="24" cy="8" r="20" fill="#f5c542"/><circle cx="-6" cy="28" r="20" fill="#f5c542"/><circle r="11" fill="#5aa469"/></g>
  <g transform="translate(335 770)"><circle r="26" fill="#e85a7a"/><circle cx="-22" cy="10" r="20" fill="#e85a7a"/><circle cx="6" cy="-24" r="18" fill="#e85a7a"/><circle r="11" fill="#5aa469"/></g>
  <g transform="translate(300 700)"><ellipse rx="22" ry="16" fill="#e0402c" stroke="#1f1a14" stroke-width="3"/><circle cx="8" cy="-4" r="5" fill="#fff"/><circle cx="9" cy="-4" r="2" fill="#1f1a14"/></g>
  <rect x="435" y="700" width="270" height="80" rx="6" fill="#d8d3c8" stroke="#1f1a14" stroke-width="4"/>
  <text x="570" y="750" text-anchor="middle" class="mapa-txt peq">contentores</text>
  <path d="M1100 610 H1158 V745 L1020 785 L1100 752 Z" fill="#c4553d" stroke="#1f1a14" stroke-width="4"/>
  <path d="M1158 610 H1275 L1310 718 L1225 752 L1158 660 Z" fill="#3b8fd6" stroke="#1f1a14" stroke-width="5"/>
  <path d="M1195 640 q30 40 0 60 t30 40" fill="none" stroke="#f5c542" stroke-width="12" stroke-linecap="round"/>
  <path d="M1047 818 L1310 725 L1478 1213 L1215 1305 Z" fill="#2f7fc1" stroke="#b5432f" stroke-width="16" stroke-linejoin="round"/>
  <g fill="none" stroke="#fff" stroke-width="4"><line x1="1135" y1="1060" x2="1394" y2="969"/><circle cx="1262" cy="1015" r="36"/></g>
  <image href="img/mascote/ola.webp" x="640" y="840" width="150" height="184"/>
  <text x="250" y="900" class="mapa-titulo">Pré-escolar</text>
  <text x="1345" y="560" text-anchor="middle" class="mapa-titulo">1.º ciclo</text>
  <text x="180" y="1000" class="mapa-nota" transform="rotate(-5 180 1000)">Flores gigantes! 🌼</text>
  <text x="820" y="880" class="mapa-nota" transform="rotate(4 820 880)">Olá! Toca nos números 👆</text>
  <text x="1080" y="1360" class="mapa-nota" transform="rotate(-3 1080 1360)">Gooolo! ⚽</text>
</svg>`;

function mapa(el, zonas, painel) {
  if (!zonas || !zonas.length) { el.closest(".r-mapa-sec").hidden = true; return; }
  el.innerHTML = MAPA_SVG + zonas.map((z, i) =>
    `<button class="r-ponto" type="button" style="left:${z.x}%;top:${z.y}%" data-zona="${i}" aria-label="${z.num}: ${escapar(z.titulo)}">${z.num}</button>`).join("");
  const botoes = [...document.querySelectorAll(".r-mapa-sec [data-zona]")];
  const mostra = i => {
    const z = zonas[i];
    botoes.forEach(b => { const sim = Number(b.dataset.zona) === i; b.classList.toggle("ativo", sim); b.setAttribute("aria-pressed", sim); });
    const foto = z.hoje && z.projeto
      ? `<div class="m-img r-vistas" data-vista="projeto"><img class="r-v-projeto" src="${escapar(z.projeto)}" alt="Simulação: ${escapar(z.titulo)}"><img class="r-v-hoje" src="${escapar(z.hoje)}" alt="Hoje: ${escapar(z.titulo)}"><span class="r-v-rot"></span><button class="r-v-botao" type="button" aria-pressed="false"></button></div>`
      : `<div class="m-img"><img src="${escapar(z.projeto)}" alt="Simulação: ${escapar(z.titulo)}"><span class="r-v-rot">Simulação</span></div>`;
    painel.innerHTML = `${foto}<div class="r-zona-txt"><p class="r-zona-letra">${z.num} · ${escapar(z.grupo)}</p><h3>${escapar(z.titulo)}</h3>
      <p class="r-zona-nota">${escapar(z.nota || "")}</p><p>${escapar(z.frase)}</p>
      <a class="botao" href="ajudar.html">Quero apadrinhar esta parte ›</a></div>`;
    const v = painel.querySelector(".r-vistas");
    if (v) vistas(v);
  };
  botoes.forEach(b => b.addEventListener("click", () => mostra(Number(b.dataset.zona))));
  mostra(0);
}

(async function () {
  const plano = await carregarDados("recreio", document.getElementById("r-areas"));
  if (!plano) return;
  carrossel(document.getElementById("r-areas"), plano.areas);
  mapa(document.getElementById("r-mapa"), plano.zonas, document.getElementById("r-zona"));
})();
