// Apoiantes: faixa contínua na página inicial e grelha em apoiantes.html.
// Dados na Google Sheet (folha "apoiantes", lida pelo Apps Script). Só aparecem os que têm "publicar" marcado.
// Só a Google Sheet: se não responder, aparece um aviso.
// "logo" = imagem enviada pelo apoiante. Sem logo, aparece um ícone do tipo de negócio.
// "tamanho" do cartão na página dos apoiantes (quem ofereceu mais, maior):
//   "grande" (2×2), "alto" (1×2), "largo" (2×1) ou "pequeno".

const ICONES = {
  florista: "🌸", restaurante: "🍽️", cafe: "☕", pastelaria: "🍰", dentista: "🦷", beleza: "💆",
  supermercado: "🛒", loja: "🧴", roupa: "👕", particular: "💛",
  desporto: "🏋️", barbearia: "💈", cabeleireiro: "💇", diversao: "🐒", musica: "🎵", construcao: "🏗️", grafica: "🖨️", tecnologia: "📱", lavandaria: "🧺", talho: "🥩", farmacia: "💊", otica: "👓", workshops: "🎨",
};

// O texto do link diz para onde vai: mapa, Instagram, Facebook ou website.
function textoLink(url) {
  if (/google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url)) return "📍 Ver no mapa";
  if (/instagram\.com/i.test(url)) return "📷 Ver no Instagram";
  if (/facebook\.com|fb\.com/i.test(url)) return "👍 Ver no Facebook";
  return "🌐 Ver no website";
}

// Logótipos muito largos (com texto) não se cortam: aparecem inteiros, com a própria imagem desfocada por trás.
function logoLargo(img) {
  if (img.naturalWidth / img.naturalHeight < 2) return;
  const caixa = img.parentElement;
  if (caixa.classList.contains("logo")) return;
  const fundo = document.createElement("img");
  fundo.src = img.src; fundo.alt = ""; fundo.className = "fundo"; fundo.setAttribute("aria-hidden", "true");
  caixa.classList.add("logo");
  caixa.prepend(fundo);
}

function cartaoApoiante(a, i) {
  const el = document.createElement("div");
  el.className = "apoiante";
  const imagem = a.logo
    ? `<div class="apoiante-img"><img src="${escapar(a.logo)}" alt="${escapar(a.nome)}" loading="lazy" onload="logoLargo(this)"></div>`
    : `<div class="apoiante-img icone" style="--h:${Math.round(i * 137.5) % 360}" aria-hidden="true">${ICONES[a.tipo] || "💛"}</div>`;
  const link = a.maps_url
    ? `<a href="${escapar(a.maps_url)}" target="_blank" rel="noopener">${textoLink(a.maps_url)}</a>`
    : "";
  el.innerHTML = imagem + `<h3>${escapar(a.nome)}</h3>` + link;
  return el;
}

// Lista da Google Sheet (folha "apoiantes"). Se falhar, aviso de erro (não há cópia no site).
async function carregarApoiantes(el) {
  return carregarDados("apoiantes", el);
}

// Página inicial: faixa lenta sem fim. Para com o rato em cima, ou com um toque.
async function faixaApoiantes(el) {
  const lista = await carregarApoiantes(el);
  if (!lista) return;
  if (MOVIMENTO) el.addEventListener("click", e => { if (!e.target.closest("a")) el.classList.toggle("parado"); });
  desenharFaixa(el, lista);
  // Dados novos: troca a faixa, mas continua no mesmo ponto do movimento (sem saltar para o início).
  aoMudar("apoiantes", d => {
    if (!Array.isArray(d.apoiantes)) return;
    const velha = el.querySelector(".faixa-apoiantes"), anim = velha && velha.getAnimations ? velha.getAnimations()[0] : null;
    const t = anim ? anim.currentTime : null;
    semAnimar(el, () => { if (velha) velha.remove(); desenharFaixa(el, d.apoiantes); });
    const nova = el.querySelector(".faixa-apoiantes"), a2 = nova && nova.getAnimations ? nova.getAnimations()[0] : null;
    if (a2 && t != null) a2.currentTime = t;
  });
}

function desenharFaixa(el, lista) {
  const publicos = lista.filter(a => a.publicar);
  const faixa = document.createElement("div");
  faixa.className = "faixa-apoiantes";
  publicos.forEach((a, i) => faixa.appendChild(cartaoApoiante(a, i)));
  if (MOVIMENTO) {
    // A lista repete-se uma vez para a faixa dar a volta sem salto.
    publicos.forEach((a, i) => {
      const c = cartaoApoiante(a, i);
      c.setAttribute("aria-hidden", "true");
      c.querySelectorAll("a").forEach(l => { l.tabIndex = -1; });
      faixa.appendChild(c);
    });
    faixa.style.setProperty("--dur", publicos.length * 4 + "s");
    el.classList.add("a-andar");
  }
  el.appendChild(faixa);
}

// Página dos apoiantes: blocos de vários tamanhos que encaixam (estilo Mondrian) e contador.
const CASAS = { grande: 4, alto: 2, largo: 2, pequeno: 1 };   // quantas casas da grelha ocupa cada tamanho
// O tamanho do cartão segue o nível do jardim (o mesmo para os dois). Sem "nivel", usa o "tamanho" antigo.
const DO_NIVEL = { sol: "grande", girassol: "alto", flor: "pequeno", botao: "pequeno" };
const NOME_NIVEL = { sol: "Sol", girassol: "Girassol", flor: "Flor", botao: "Botão" };

// Enquanto a lista chega: cartões "fantasma" a brilhar e o contador a rodar números.
function mostrarCarregar(el, contador) {
  el.setAttribute("aria-busy", "true");
  const aviso = document.createElement("p");
  aviso.className = "a-carregar"; aviso.setAttribute("role", "status"); aviso.textContent = "⏳ A carregar os apoiantes…";
  el.before(aviso);
  el.innerHTML = ["grande", "pequeno", "pequeno", "largo", "alto", "pequeno", "pequeno", "largo"]
      .map(t => `<div class="apoiante esqueleto ${t}" aria-hidden="true"></div>`).join("");
  const roda = MOVIMENTO
    ? setInterval(() => { contador.textContent = 10 + Math.floor(Math.random() * 90); }, 70)
    : (contador.textContent = "…", 0);
  return () => {
    clearInterval(roda);
    el.removeAttribute("aria-busy");
    aviso.remove();
    el.querySelectorAll(".esqueleto").forEach(x => x.remove());
  };
}

async function grelhaApoiantes(el, contador) {
  const parar = mostrarCarregar(el, contador);
  const lista = await carregarApoiantes(el);
  parar();
  if (!lista) { contador.textContent = "0"; return; }
  let taparBuraco = () => {};
  addEventListener("resize", () => taparBuraco());
  taparBuraco = desenharGrelha(el, contador, lista, false);
  aoMudar("apoiantes", d => {
    if (Array.isArray(d.apoiantes)) semAnimar(el, () => { taparBuraco = desenharGrelha(el, contador, d.apoiantes, true); });
  });
}

// Desenha a grelha. Devolve a função que tapa o buraco da última linha (para o resize).
// quieto = true: dados novos, sem animação (o contador vai logo para o número certo).
function desenharGrelha(el, contador, lista, quieto) {
  el.innerHTML = "";
  const publicos = lista.map((a, i) => [a, i]).filter(([a]) => a.publicar);
  const tamanho = a => DO_NIVEL[a.nivel] || (CASAS[a.tamanho] ? a.tamanho : "pequeno");

  // Ordem: 1.º grande, os altos com dois pequenos ao lado, os largos, os outros grandes, o resto.
  const por = { grande: [], alto: [], largo: [], pequeno: [] };
  publicos.sort((x, y) => x[0].nome.localeCompare(y[0].nome, "pt")).forEach(p => por[tamanho(p[0])].push(p));
  const ordem = [
    ...por.grande.slice(0, 1), ...por.alto, ...por.pequeno.splice(0, 2 * por.alto.length),
    ...por.largo, ...por.grande.slice(1), ...por.pequeno,
  ];
  ordem.forEach(([a, i]) => {
    const c = cartaoApoiante(a, i);
    c.classList.add(tamanho(a));
    if (NOME_NIVEL[a.nivel]) c.querySelector("h3").insertAdjacentHTML("afterbegin",
      `<img class="ap-nivel" src="img/jardim/flores/${a.nivel}-1.svg" alt="${NOME_NIVEL[a.nivel]}" title="${NOME_NIVEL[a.nivel]}">`);
    el.appendChild(c);
  });

  // Se a última linha ficar com um buraco, o último cartão estica para o tapar.
  function taparBuraco() {
    const ultimo = el.lastElementChild;
    if (!ultimo) return;
    ultimo.style.gridColumn = "";
    const colunas = getComputedStyle(el).gridTemplateColumns.split(" ").length;
    const casas = ordem.reduce((s, [a]) => s + CASAS[tamanho(a)], 0);
    const falta = (colunas - casas % colunas) % colunas;
    if (falta) ultimo.style.gridColumn = "span " + (falta + 1);
  }
  taparBuraco();

  const alvo = publicos.length;
  if (!MOVIMENTO || quieto) { contador.textContent = alvo; return taparBuraco; }
  const inicio = performance.now(), de = Number(contador.textContent) || 0;
  (function passo(t) {
    const p = Math.min(1, (t - inicio) / 600);
    contador.textContent = Math.round(de + (alvo - de) * p);
    if (p < 1) requestAnimationFrame(passo);
  })(inicio);
  return taparBuraco;
}

document.querySelectorAll("[data-faixa-apoiantes]").forEach(el => faixaApoiantes(el));
document.querySelectorAll("[data-todos-apoiantes]").forEach(el => grelhaApoiantes(el, document.getElementById("contador")));
