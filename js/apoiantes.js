// Apoiantes: faixa contínua na página inicial e grelha em apoiantes.html.
// Dados na Google Sheet (folha "apoiantes", lida pelo Apps Script). Só aparecem os que têm "publicar" marcado.
// Se a Sheet não responder, usa a cópia em data/apoiantes.json.
// "logo" = imagem enviada pelo apoiante. Sem logo, aparece um ícone do tipo de negócio.
// "tamanho" do cartão na página dos apoiantes (quem ofereceu mais, maior):
//   "grande" (2×2), "alto" (1×2), "largo" (2×1) ou "pequeno".

const ICONES = {
  florista: "🌸", restaurante: "🍽️", cafe: "☕", pastelaria: "🍰", dentista: "🦷", beleza: "💆",
  supermercado: "🛒", loja: "🧴", roupa: "👕", particular: "💛",
  desporto: "🏋️", barbearia: "💈", cabeleireiro: "💇", diversao: "🐒", musica: "🎵", tecnologia: "📱", lavandaria: "🧺", talho: "🥩", farmacia: "💊", otica: "👓",
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

// Lista da Sheet (espera até 6 s); se falhar, a cópia guardada no site.
async function carregarApoiantes(el) {
  if (ENDPOINT) {
    try {
      const r = await fetch(ENDPOINT + "?acao=apoiantes", { signal: AbortSignal.timeout(6000) });
      const lista = await r.json();
      if (Array.isArray(lista) && lista.length) return lista;
    } catch (e) {}
  }
  return carregarJSON("data/apoiantes.json", el);
}

// Página inicial: faixa lenta sem fim. Para com o rato em cima, ou com um toque.
async function faixaApoiantes(el) {
  const lista = await carregarApoiantes(el);
  if (!lista) return;
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
    el.addEventListener("click", e => { if (!e.target.closest("a")) el.classList.toggle("parado"); });
  }
  el.appendChild(faixa);
}

// Página dos apoiantes: blocos de vários tamanhos que encaixam (estilo Mondrian) e contador.
const CASAS = { grande: 4, alto: 2, largo: 2, pequeno: 1 };   // quantas casas da grelha ocupa cada tamanho

async function grelhaApoiantes(el, contador) {
  const lista = await carregarApoiantes(el);
  if (!lista) return;
  const publicos = lista.map((a, i) => [a, i]).filter(([a]) => a.publicar);
  const tamanho = a => CASAS[a.tamanho] ? a.tamanho : "pequeno";

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
    el.appendChild(c);
  });

  // Se a última linha ficar com um buraco, o último cartão estica para o tapar.
  function taparBuraco() {
    const ultimo = el.lastElementChild;
    ultimo.style.gridColumn = "";
    const colunas = getComputedStyle(el).gridTemplateColumns.split(" ").length;
    const casas = ordem.reduce((s, [a]) => s + CASAS[tamanho(a)], 0);
    const falta = (colunas - casas % colunas) % colunas;
    if (falta) ultimo.style.gridColumn = "span " + (falta + 1);
  }
  taparBuraco();
  addEventListener("resize", taparBuraco);

  const alvo = publicos.length;
  if (!MOVIMENTO) { contador.textContent = alvo; return; }
  const inicio = performance.now();
  (function passo(t) {
    const p = Math.min(1, (t - inicio) / 600);
    contador.textContent = Math.round(alvo * p);
    if (p < 1) requestAnimationFrame(passo);
  })(inicio);
}

document.querySelectorAll("[data-faixa-apoiantes]").forEach(el => faixaApoiantes(el));
document.querySelectorAll("[data-todos-apoiantes]").forEach(el => grelhaApoiantes(el, document.getElementById("contador")));
