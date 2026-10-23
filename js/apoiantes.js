// Apoiantes confirmados.
// "peso" = valor aproximado da oferta. Quanto maior, mais vezes aparece no carrossel. Não aparece no site.
// "img"  = imagem do apoiante (ex.: "img/apoiantes/ofirdent.jpg"). Sem imagem, aparece um quadrado de cor com as iniciais.
// "logo" = true para logótipos: a imagem aparece inteira. Sem isto, a foto enche o quadrado.
// "link" = Google Maps (ou outra página). Sem link, o cartão não tem botão.
const APOIANTES = [
  { nome: "CMT – Casa Penetra", img: "img/apoiantes/casa-penetra.jpg", peso: 25, link: "https://maps.google.com/?cid=3777675272025239271" },
  { nome: "Florista Bela Arte", img: "img/apoiantes/florista-bela-arte.jpg", peso: 20, link: "https://maps.google.com/?cid=1245702966496861534" },
  { nome: "Chalé Tapas Bar", img: "img/apoiantes/chale-tapas-bar.jpg", peso: 20, link: "https://maps.google.com/?cid=17522394796189714683" },
  { nome: "OfirDent", peso: 50, link: "https://maps.google.com/?cid=6608242803670963054" },
  { nome: "Empresa anónima", peso: 100 },
  { nome: "Claudia Carvalho", peso: 15 },
  { nome: "Supermercado Ramalhão", img: "img/apoiantes/supermercado-ramalhao.jpg", peso: 20, link: "https://www.google.com/maps/place/?q=place_id:ChIJO1xgYd5LJA0RHo5goycyXEU" },
  { nome: "Restaurante Paladar", img: "img/apoiantes/restaurante-paladar.jpg", peso: 15, link: "https://www.google.com/maps/place/?q=place_id:ChIJl558D_VLJA0RBaTuS1vDRkI" },
  { nome: "Rituais de Beleza", img: "img/apoiantes/rituais-de-beleza.jpg", peso: 40, link: "https://www.google.com/maps/place/?q=place_id:ChIJ1wUav95LJA0R58wAuYgrJ3U" },
  { nome: "Doce e Granulado", img: "img/apoiantes/doce-e-granulado.jpg", logo: true, peso: 10, link: "https://www.instagram.com/doce_e_granulado/" },
  { nome: "Bica d'Ofir", img: "img/apoiantes/bica-dofir.jpg", peso: 20, link: "https://www.google.com/maps/place/?q=place_id:ChIJhUkax19LJA0RO9oeZrZFQQM" },
];

function iniciais(nome) {
  return nome.split(/[\s–-]+/).filter(p => /^\p{Lu}/u.test(p)).slice(0, 2).map(p => p[0]).join("");
}

// Um cartão: imagem (ou quadrado de cor), nome e botão para o mapa.
function cartaoApoiante(i) {
  const a = APOIANTES[i];
  const el = document.createElement("div");
  el.className = "apoiante";

  const caixa = document.createElement("div");
  caixa.className = "apoiante-img";
  if (a.img) {
    const img = document.createElement("img");
    img.src = a.img; img.alt = a.nome; img.loading = "lazy";
    if (a.logo) img.className = "logo";
    caixa.appendChild(img);
  } else {
    // Cor diferente para cada apoiante (ângulo de ouro: cores bem espalhadas).
    caixa.classList.add("generica");
    caixa.style.setProperty("--h", Math.round(i * 137.5) % 360);
    caixa.textContent = iniciais(a.nome);
  }
  el.appendChild(caixa);

  const h = document.createElement("h3");
  h.textContent = a.nome;
  el.appendChild(h);

  if (a.link) {
    const l = document.createElement("a");
    l.href = a.link; l.target = "_blank"; l.rel = "noopener";
    l.textContent = a.link.includes("instagram.com") ? "📷 Ver no Instagram" : "📍 Ver no mapa";
    el.appendChild(l);
  }
  return el;
}

// Escolhe um apoiante ao acaso, com mais hipóteses para quem tem mais peso.
// Não repete os que já estão à vista.
function sortearApoiante(excluir) {
  const cand = APOIANTES.map((a, i) => i).filter(i => !excluir.includes(i));
  let r = Math.random() * cand.reduce((s, i) => s + APOIANTES[i].peso, 0);
  for (const i of cand) { r -= APOIANTES[i].peso; if (r < 0) return i; }
  return cand[cand.length - 1];
}

// Carrossel: a cada 3,5 s entra um cartão novo pela direita.
function iniciarCarrossel(el) {
  const faixa = document.createElement("div");
  faixa.className = "carrossel-faixa";
  el.appendChild(faixa);

  const mostrados = [];
  const quantos = matchMedia("(min-width: 560px)").matches ? 3 : 2;
  for (let k = 0; k < quantos; k++) {
    const i = sortearApoiante(mostrados);
    mostrados.push(i); faixa.appendChild(cartaoApoiante(i));
  }

  let pausa = false;
  el.addEventListener("mouseenter", () => { pausa = true; });
  el.addEventListener("mouseleave", () => { pausa = false; });

  setInterval(() => {
    if (pausa || document.hidden) return;
    const i = sortearApoiante(mostrados);
    mostrados.push(i); faixa.appendChild(cartaoApoiante(i));
    const passo = faixa.children[1].offsetLeft - faixa.children[0].offsetLeft;
    faixa.style.transition = "transform .6s ease";
    faixa.style.transform = "translateX(" + -passo + "px)";
    setTimeout(() => {
      faixa.style.transition = "none";
      faixa.style.transform = "";
      faixa.firstElementChild.remove();
      mostrados.shift();
    }, 650);
  }, 3500);
}

// Tamanho do cartão na página dos apoiantes (estilo Mondrian).
const TAMANHOS = { grande: 4, alto: 2, largo: 2, pequeno: 1 }; // casas que cada um ocupa
function tamanho(a) {
  return a.peso >= 50 ? "grande" : a.peso >= 40 ? "alto" : a.peso >= 25 ? "largo" : "pequeno";
}

// Página dos apoiantes: tamanhos misturados, como um quadro do Mondrian.
// Ordem: 1.º grande, os altos com dois pequenos ao lado, os largos, os outros grandes, o resto.
function mostrarTodos(el) {
  const por = { grande: [], alto: [], largo: [], pequeno: [] };
  APOIANTES.map((a, i) => i)
    .sort((x, y) => APOIANTES[y].peso - APOIANTES[x].peso ||
      APOIANTES[x].nome.localeCompare(APOIANTES[y].nome, "pt"))
    .forEach(i => por[tamanho(APOIANTES[i])].push(i));
  const ordem = [
    ...por.grande.slice(0, 1), ...por.alto, ...por.pequeno.splice(0, 2 * por.alto.length),
    ...por.largo, ...por.grande.slice(1), ...por.pequeno,
  ];
  ordem.forEach(i => {
    const c = cartaoApoiante(i);
    c.classList.add(tamanho(APOIANTES[i]));
    el.appendChild(c);
  });

  // Se a última linha ficar com um buraco, o último cartão estica para o tapar.
  function taparBuraco() {
    const ultimo = el.lastElementChild;
    ultimo.style.gridColumn = "";
    const colunas = getComputedStyle(el).gridTemplateColumns.split(" ").length;
    const casas = ordem.reduce((s, i) => s + TAMANHOS[tamanho(APOIANTES[i])], 0);
    const falta = (colunas - casas % colunas) % colunas;
    if (falta) ultimo.style.gridColumn = "span " + (falta + 1);
  }
  taparBuraco();
  addEventListener("resize", taparBuraco);
}

document.querySelectorAll("[data-carrossel-apoiantes]").forEach(iniciarCarrossel);
document.querySelectorAll("[data-todos-apoiantes]").forEach(mostrarTodos);
