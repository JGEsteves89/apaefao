// Perdidos e achados: o que as duas páginas (perdidos.html e perdidos-novo.html) usam.
const PA_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const PA_PLURAL = { casaco: "casacos", camisola: "camisolas", garrafa: "garrafas", lancheira: "lancheiras", mochila: "mochilas", "chapéu": "chapéus", "calçado": "calçado", outro: "outros" };
const PA_CORES = ["azul", "vermelho", "rosa", "verde", "amarelo", "preto", "branco", "cinzento", "outra"];
const paDia = iso => { const [, m, d] = iso.split("-").map(Number); return d + " de " + PA_MESES[m - 1]; };
const paCurto = iso => { const [, m, d] = iso.split("-").map(Number); return d + " " + PA_MESES[m - 1].slice(0, 3); };
const paMaiuscula = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
const paNome = o => paMaiuscula((o.tipo || "objeto") + (o.cor ? " " + o.cor : ""));

// Reduz a foto no telemóvel (lado maior 1000 px, JPEG 0,7). Também apaga os dados escondidos (ex.: GPS). Devolve o data URL.
async function paReduzir(ficheiro) {
  let img;
  try { img = await createImageBitmap(ficheiro, { imageOrientation: "from-image" }); }
  catch (e) { img = new Image(); img.src = URL.createObjectURL(ficheiro); await img.decode(); }
  const escala = Math.min(1, 1000 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.7);
}

// Botões de escolha (tipo, cor…). "outra" fica com valor vazio.
function paOpcoes(el, nome, lista) {
  el.innerHTML = lista.map(v => `<label class="pa-opcao"><input type="radio" name="${nome}" value="${escapar(v === "outra" ? "" : v)}"><span>${escapar(paMaiuscula(v))}</span></label>`).join("");
}

// POST que lê a resposta do Apps Script ({ok, erro, …}).
async function paPost(dados) {
  if (MODO_TESTE) { await espera(500); return { ok: true, numero: 99, sai_a: "2026-12-11" }; }
  const r = await fetch(ENDPOINT, { method: "POST", body: JSON.stringify(dados), signal: AbortSignal.timeout(60000) });
  return r.json();
}
const paLista = () => /[?&]perdidos-teste/.test(location.search) ? Promise.resolve(paTeste())
  : fetch(ENDPOINT + "?acao=perdidos&t=" + Date.now(), { signal: AbortSignal.timeout(15000) }).then(r => r.json());

function paErro(e) {
  return {
    chave: "A chave não é válida. Pede o link novo à APAEF.", foto: "Falta a foto (ou não chegou bem). Tira outra.",
    tipo: "Escolhe o que é.", contacto: "Escreve o teu nome e um email válido.", rgpd: "Falta aceitar o envio do teu nome e email.",
    limite: "Já enviaste muitos hoje. Tenta amanhã.", numero: "Este pedido já não está aberto.", token: "Este link já não é válido."
  }[e] || "Não foi possível enviar. Tenta daqui a pouco.";
}

function paFotoHTML(o, largura, link) {
  const num = `<span class="pa-num">#${o.numero}</span>`;
  if (!o.foto) return `<div class="pa-foto sem-foto">${num}</div>`;
  const img = `<img src="${escapar(fotoPerdido(o.foto, largura))}" alt="${escapar(paNome(o))}" loading="lazy" onerror="this.parentNode.classList.add('sem-foto');this.remove()">`;
  return link ? `<a class="pa-foto" href="${escapar(fotoPerdido(o.foto, 1600))}" target="_blank" rel="noopener">${img}${num}</a>` : `<div class="pa-foto">${img}${num}</div>`;
}

function paTeste() {
  const f = "1p6H6BNwufh7svA2RxnHBz1bqZPaZ4BMJ";
  return { lista: [
    { numero: 6, pedido: "perdi", tipo: "camisola", cor: "azul", descricao: "Com um dinossauro à frente. Sala D.", foto: "", data: "2026-11-26", sai_a: "2027-01-10", na_escola: false },
    { numero: 5, pedido: "encontrei", tipo: "garrafa", cor: "rosa", descricao: "", onde: "comigo", foto: f, data: "2026-11-25", sai_a: "2027-01-09" },
    { numero: 4, pedido: "encontrei", tipo: "casaco", cor: "azul", descricao: "", onde: "escola", foto: f, data: "2026-11-24", sai_a: "2026-12-11" },
    { numero: 3, pedido: "perdi", tipo: "lancheira", cor: "", descricao: "Lancheira com estrelas", foto: f, data: "2026-11-20", sai_a: "2027-01-04", na_escola: true },
    { numero: 2, pedido: "encontrei", tipo: "casaco", cor: "verde", descricao: "", onde: "escola", foto: "x", data: "2026-11-10", sai_a: "2026-11-27" }
  ] };
}
