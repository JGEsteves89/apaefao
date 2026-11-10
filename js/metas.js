// Metas: cada pessoa escolhe para que coisa vai a sua ajuda.
// Dados: Google Sheet (folha "metas", lida pelo Apps Script com ?acao=metas). Se falhar, data/metas.json.
// Estados: "a angariar" (barra), "garantido" (barra cheia), "feito" (foto + fatura), "a seguir" (fechada).
// MOSTRAR_EUROS (config.js): enquanto for false, a página mostra só percentagens, sem valores em €.

const EUROS = typeof MOSTRAR_EUROS !== "undefined" && MOSTRAR_EUROS;
const euros = v => Number(v).toLocaleString("pt-PT", { maximumFractionDigits: 0 }) + " €";
const pct = m => Math.min(100, Math.round((m.angariado / m.custo) * 100)) || 0;
const dataCurta = d => new Date(d + "T12:00").toLocaleDateString("pt-PT", { day: "numeric", month: "short" });

async function carregarMetas() {
  if (ENDPOINT) {
    try {
      const r = await fetch(ENDPOINT + "?acao=metas", { signal: AbortSignal.timeout(6000) });
      const dados = await r.json();
      const lista = Array.isArray(dados) ? dados : dados && dados.metas;
      if (Array.isArray(lista) && lista.length) return lista;
    } catch (e) {}
  }
  const dados = await carregarJSON("data/metas.json");
  return Array.isArray(dados) ? dados : dados && dados.metas;
}

function selo(m) {
  if (m.estado === "feito") return '<span class="m-selo feito">🎉 Feito</span>';
  if (m.estado === "garantido") return '<span class="m-selo garantido">✅ Garantido</span>';
  if (m.estado === "a seguir") return '<span class="m-selo seguir">🔒 A seguir</span>';
  if (pct(m) >= 80) return '<span class="m-selo quase">Quase lá!</span>';
  return "";
}

// Várias imagens por meta (como numa loja online): "imagens" = lista; "imagem" continua a servir.
// Cada imagem pode ser "caminho" ou {src, legenda}.
function imagem(m) {
  let lista = m.imagens && m.imagens.length ? m.imagens : (m.imagem ? [m.imagem] : []);
  if (m.estado === "feito" && m.imagem_depois) lista = [m.imagem_depois].concat(lista);
  lista = lista.map(i => typeof i === "string" ? { src: i } : i);
  if (!lista.length) return `<div class="m-img icone" aria-hidden="true">${escapar(m.emoji || "🎯")}</div>`;
  const slides = lista.map((i, n) => `<figure class="m-slide"><img src="${escapar(i.src)}" alt="${escapar(i.legenda || "")}" loading="${n ? "lazy" : "eager"}">${i.legenda ? `<figcaption>${escapar(i.legenda)}</figcaption>` : ""}</figure>`).join("");
  if (lista.length === 1) return `<div class="m-img">${slides}</div>`;
  const pontos = lista.map((_, n) => `<button type="button" class="${n ? "" : "ativo"}" aria-label="Imagem ${n + 1}"></button>`).join("");
  return `<div class="m-img m-galeria"><div class="m-pista">${slides}</div>
    <button type="button" class="m-seta ant" aria-label="Imagem anterior">‹</button><button type="button" class="m-seta seg" aria-label="Imagem seguinte">›</button>
    <div class="m-pontos">${pontos}</div></div>`;
}

function galerias(raiz) {
  raiz.querySelectorAll(".m-galeria").forEach(g => {
    const pista = g.querySelector(".m-pista"), pontos = [...g.querySelectorAll(".m-pontos button")];
    const ir = n => pista.scrollTo({ left: n * pista.clientWidth, behavior: MOVIMENTO ? "smooth" : "auto" });
    const atual = () => Math.round(pista.scrollLeft / pista.clientWidth);
    pista.addEventListener("scroll", () => pontos.forEach((p, n) => p.classList.toggle("ativo", n === atual())), { passive: true });
    pontos.forEach((p, n) => p.addEventListener("click", () => ir(n)));
    g.querySelector(".ant").addEventListener("click", () => ir(Math.max(0, atual() - 1)));
    g.querySelector(".seg").addEventListener("click", () => ir((atual() + 1) % pontos.length));
  });
}

function barra(m) {
  const p = pct(m);
  const valores = EUROS
    ? `<b><span class="m-num" data-ate="${m.angariado}">0</span> €</b> de ${euros(m.custo)}`
    : `<b><span class="m-num" data-ate="${p}">0</span>%</b> da meta`;
  const falta = m.custo - m.angariado;
  const resto = [];
  if (m.estado === "a angariar") {
    if (EUROS && falta > 0) resto.push(`Faltam ${euros(falta)}`);
    if (m.data_limite) resto.push(`até ${dataCurta(m.data_limite)}`);
  }
  return `
    <div class="m-barra${p >= 80 && p < 100 ? " brilho" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="${p}% da meta">
      <i style="--p:${p}%"></i>
      <span class="marco" style="left:25%"></span><span class="marco" style="left:50%"></span><span class="marco" style="left:75%"></span>
    </div>
    <p class="m-valores-linha">${valores}${m.apoiantes ? ` · ${m.apoiantes} ${m.apoiantes === 1 ? "apoiante" : "apoiantes"}` : ""}</p>
    ${resto.length ? `<p class="m-falta">${resto.join(" · ")}</p>` : ""}
    ${EUROS && m.do_fundo > 0 && m.estado === "a angariar" ? `<p class="m-fundo">Inclui ${euros(m.do_fundo)} do fundo geral da APAEF</p>` : ""}`;
}

// Partilhar uma meta (WhatsApp ou o menu de partilha do telemóvel). O link abre a página nessa meta.
function partilhar(m) {
  const url = location.origin + location.pathname + "#meta-" + m.id;
  const falta = Math.max(0, m.custo - m.angariado);
  const texto = `${m.emoji} ${m.titulo}` + (EUROS && falta ? ` — faltam ${euros(falta)}.` : ".") + " Ajudas a APAEF? " + url;
  if (navigator.share) { navigator.share({ title: m.titulo, text: texto }).catch(() => {}); return; }
  window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank", "noopener");
}

function custos(m) {
  if (!m.custos_detalhe || !m.custos_detalhe.length) return "";
  const linhas = m.custos_detalhe.map(l => `<li>${escapar(EUROS ? l : l.replace(/[≈]?\s?[\d\s.,]+\s?€/g, "").replace(/\s[×=]\s*$/, "").trim())}</li>`).join("");
  return `<details class="m-custos"><summary>Ver custos</summary><ul>${linhas}</ul></details>`;
}

// Metas "a seguir" e "garantidas/feitas": linha curta (miniatura + título + estado), sem barra nem texto longo.
function linha(m) {
  const el = document.createElement("article");
  el.className = "m-linha m-cartao estado-" + m.estado.replace(" ", "-");
  el.id = "meta-" + m.id;
  el.dataset.grupo = m.grupo || "";
  const l = m.imagens && m.imagens.length ? m.imagens : (m.imagem ? [m.imagem] : []);
  const src = m.estado === "feito" && m.imagem_depois ? m.imagem_depois : (l[0] && (l[0].src || l[0]));
  const mini = src ? `<img src="${escapar(src)}" alt="" loading="lazy">` : `<span aria-hidden="true">${escapar(m.emoji || "🎯")}</span>`;
  let estado;
  const valor = EUROS ? ` · <b>${euros(m.angariado || m.custo)}</b>` : "";
  if (m.estado === "feito") estado = `🎉 Feito a ${dataCurta(m.feito_em)}${valor}` + (m.nota ? " · " + escapar(m.nota) : "") + (m.fatura ? ` · <a href="${escapar(m.fatura)}" target="_blank" rel="noopener">🧾 fatura</a>` : "");
  else if (m.estado === "garantido") estado = `✅ Garantido${valor}` + (m.nota ? " · " + escapar(m.nota) : "");
  else estado = "🔒 Abre a seguir" + (EUROS ? ` · ${euros(m.custo)}` : "");
  el.innerHTML = `<div class="m-mini">${mini}</div><div><h3>${escapar(m.emoji)} ${escapar(m.titulo)}</h3><p class="m-linha-estado">${estado}</p></div>`;
  return el;
}

function cartao(m, lista) {
  const el = document.createElement("article");
  el.className = "m-cartao anima estado-" + m.estado.replace(" ", "-");
  el.id = "meta-" + m.id;
  el.dataset.grupo = m.grupo || "";
  let fundo = "";
  if (m.estado === "a angariar") {
    fundo = `<div class="m-acoes"><button class="botao m-ajudar" type="button" data-meta="${escapar(m.id)}">Quero ajudar esta meta</button>`
      + `<button class="m-partilhar" type="button" data-partilhar="${escapar(m.id)}">📤 Partilhar esta meta</button></div>`;
  } else if (m.estado === "feito") {
    fundo = `<p class="m-feito">Feito a ${dataCurta(m.feito_em)}${m.nota ? " · " + escapar(m.nota) : ""}</p>`
      + (m.fatura ? `<a class="m-fatura" href="${escapar(m.fatura)}" target="_blank" rel="noopener">🧾 Ver fatura</a>` : "");
  } else if (m.nota) {
    fundo = `<p class="m-feito">${escapar(m.nota)}</p>`;
  }
  el.innerHTML = `${imagem(m)}${selo(m)}
    <div class="m-corpo">
      <h3>${escapar(m.emoji)} ${escapar(m.titulo)}</h3>
      <p class="m-frase">${escapar(m.frase)}</p>
      ${m.estado === "a seguir" ? "" : barra(m)}
      ${custos(m)}
      ${fundo}
    </div>`;
  return el;
}

// Barra e números animam quando o cartão aparece no ecrã.
function animar(raiz) {
  const els = raiz.querySelectorAll(".m-cartao");
  const correr = c => {
    c.classList.add("visivel");
    c.querySelectorAll(".m-num").forEach(n => {
      const ate = Number(n.dataset.ate);
      if (!MOVIMENTO) { n.textContent = ate.toLocaleString("pt-PT"); return; }
      const t0 = performance.now(), dur = 1200;
      const passo = t => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        n.textContent = Math.round(ate * e).toLocaleString("pt-PT");
        if (k < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
  };
  if (!MOVIMENTO || !("IntersectionObserver" in window)) { els.forEach(correr); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    correr(e.target); io.unobserve(e.target);
  }), { threshold: 0.3 });
  els.forEach(c => io.observe(c));
}

function contar(el, ate) {
  if (!MOVIMENTO) { el.textContent = ate; return; }
  let n = 0;
  const t = setInterval(() => { el.textContent = ++n; if (n >= ate) clearInterval(t); }, 120);
  if (!ate) clearInterval(t);
}

// Confetes uma vez por meta garantida/feita neste browser.
function festejar(lista) {
  let vistos = [];
  try { vistos = JSON.parse(localStorage.getItem("metas-festejadas") || "[]"); } catch (e) {}
  const novas = lista.filter(m => (m.estado === "garantido" || m.estado === "feito") && !vistos.includes(m.id));
  if (!novas.length) return;
  setTimeout(confetti, 600);
  try { localStorage.setItem("metas-festejadas", JSON.stringify(vistos.concat(novas.map(m => m.id)))); } catch (e) {}
}

// Plano do recreio: os passos por ordem, com o estado de cada um. Tocar num passo leva ao cartão.
function caminho(lista) {
  const el = document.getElementById("m-caminho");
  const recreio = lista.filter(m => m.grupo === "Recreio").sort((a, b) => (a.prioridade || 99) - (b.prioridade || 99));
  el.innerHTML = recreio.map((m, i) => {
    const feito = m.estado === "garantido" || m.estado === "feito";
    const agora = m.estado === "a angariar";
    const estado = feito ? "✅ Pago" : agora ? `A angariar · ${pct(m)}%` : "🔒 Depois";
    return `<li class="${feito ? "aceso" : agora ? "agora" : ""}"><a href="#meta-${escapar(m.id)}">
      <span class="passo" aria-hidden="true">${escapar(m.emoji)}</span>
      <small>Passo ${i + 1}</small><b>${escapar(m.titulo.replace(/ para .*$/, ""))}</b><em>${estado}</em></a></li>`;
  }).join("");
  if (!recreio.length) el.closest("section").hidden = true;
}

// Diálogo "Quero ajudar": valor (com impacto) → forma de pagar.
const ONLINE = (typeof PAGAMENTOS_ONLINE !== "undefined" && PAGAMENTOS_ONLINE) || /demo=pagamentos/.test(location.search);
const DEMO = /demo=pagamentos/.test(location.search);
let metaAberta = null, valorEscolhido = 0;

function impacto(m, v) {
  if (!v) return "";
  const faltaJa = Math.max(0, m.custo - m.angariado);
  if (faltaJa && v >= faltaJa) return `${v} € fecham esta meta! 🎉`;
  if (m.unidade && m.preco_unidade) {
    const n = Math.floor(v / m.preco_unidade);
    const [um, varios] = m.unidade.split("|").map(s => s.trim());
    if (n >= 1) return `${v} € = ${n} ${n === 1 ? um : (varios || um)} 💛`;
  }
  return `${v} € = ${Math.max(1, Math.round(v / m.custo * 100))}% desta meta 💛`;
}

function escolherValor(v) {
  valorEscolhido = v;
  const m = metaAberta, d = document.getElementById("m-dialogo");
  const ref = "META " + m.id.split("-")[0].toUpperCase() + (v ? " " + v + "EUR" : "") + " + o teu nome";
  d.querySelector("#m-ref").textContent = ref;
  d.querySelector("#m-ref2").textContent = ref;
  d.querySelectorAll(".m-v").forEach(s => { s.textContent = v ? v + " €" : "o valor"; });
  d.querySelector("#m-impacto").textContent = impacto(m, v);
  d.querySelectorAll(".m-pagar").forEach(b => { b.disabled = !v; });
}

function abrirDialogo(m) {
  metaAberta = m;
  const d = document.getElementById("m-dialogo");
  d.querySelector("#m-d-titulo").textContent = `${m.emoji} ${m.titulo}`;
  d.querySelector(".m-d-frase").textContent = m.frase;
  const sugestoes = m.custo <= 300 ? [5, 10, 20] : [10, 25, 50];
  d.querySelector("#m-valores").innerHTML = sugestoes.map((v, i) =>
    `<button type="button" role="radio" class="m-valor${i === 1 ? " ativo" : ""}" aria-checked="${i === 1}" data-valor="${v}">${v} €</button>`).join("")
    + '<button type="button" role="radio" class="m-valor" aria-checked="false" data-valor="outro">Outro</button>';
  d.querySelector("#m-outro").hidden = true;
  d.querySelector("#m-outro-valor").value = "";
  // Formas de pagar: MB WAY (online ou manual), Multibanco (só online), transferência (sempre).
  const mbManual = typeof MBWAY_NUMERO !== "undefined" && MBWAY_NUMERO;
  const temMb = ONLINE || mbManual, temRef = ONLINE || (typeof REFERENCIA_MB !== "undefined" && REFERENCIA_MB);
  d.querySelector('[data-metodo="mbway"]').hidden = !temMb;
  d.querySelector('[data-metodo="ref"]').hidden = !temRef;
  d.querySelector('[data-painel="mbway"] [data-online]').hidden = !ONLINE;
  d.querySelector('[data-painel="mbway"] [data-manual]').hidden = ONLINE || !mbManual;
  if (mbManual) d.querySelector("#m-mbway").textContent = MBWAY_NUMERO;
  d.querySelectorAll(".m-resposta").forEach(r => { r.textContent = ""; });
  d.querySelector("#m-refmb").hidden = true;
  metodo(temMb ? "mbway" : temRef ? "ref" : "transf");
  escolherValor(sugestoes[1]);
  if (d.showModal) d.showModal(); else d.setAttribute("open", "");
}

function metodo(nome) {
  document.querySelectorAll(".m-metodos button").forEach(x => { x.classList.toggle("ativo", x.dataset.metodo === nome); x.setAttribute("aria-selected", x.dataset.metodo === nome); });
  document.querySelectorAll(".m-metodo").forEach(p => { p.hidden = p.dataset.painel !== nome; });
}

// Pagamento online: o Apps Script fala com a Eupago/ifthenpay (?acao=pagamento). Em ?demo=pagamentos é simulado.
async function pagar(tipo) {
  const m = metaAberta, v = valorEscolhido;
  const resp = document.getElementById(tipo === "mbway" ? "m-resp-mbway" : "m-resp-ref");
  const tel = (document.getElementById("m-tel").value || "").replace(/\D/g, "");
  if (tipo === "mbway" && !/^9\d{8}$/.test(tel)) { resp.textContent = "Escreve um número de telemóvel português (9 algarismos)."; return; }
  resp.textContent = "A preparar…";
  let r;
  try {
    if (DEMO) { await espera(800); r = tipo === "mbway" ? { ok: true } : { ok: true, entidade: "00000", referencia: "000 000 000", valor: v }; }
    else {
      const q = new URLSearchParams({ acao: "pagamento", tipo, meta: m.id, valor: v, telemovel: tel });
      r = await (await fetch(ENDPOINT + "?" + q, { signal: AbortSignal.timeout(15000) })).json();
    }
  } catch (e) { r = { ok: false }; }
  if (!r || !r.ok) { resp.textContent = "Não foi possível agora. Experimenta a transferência, por favor."; return; }
  if (tipo === "mbway") resp.textContent = (DEMO ? "[Demonstração] " : "") + `📱 Abre a app MB WAY e aceita o pedido de ${v} € (tens 4 minutos). Obrigado! 💛`;
  else {
    document.getElementById("m-ent").textContent = r.entidade;
    document.getElementById("m-refn").textContent = r.referencia;
    document.getElementById("m-refv").textContent = r.valor + " €";
    document.getElementById("m-refmb").hidden = false;
    resp.textContent = (DEMO ? "[Demonstração — não pagar] " : "") + "Paga no multibanco ou no homebanking, em Pagamentos de Serviços.";
  }
}

// Filtros: esconde cartões, passos e secções que ficam vazias.
function filtrar(grupo) {
  document.querySelectorAll(".m-cartao").forEach(c => { c.hidden = !!grupo && c.dataset.grupo !== grupo; });
  document.querySelectorAll(".metas-caminho li").forEach(li => { li.hidden = !!grupo && grupo !== "Recreio"; });
  document.querySelectorAll(".metas-pagina section").forEach(s => {
    const cartoes = s.querySelectorAll(".m-cartao, .metas-caminho li");
    s.hidden = cartoes.length > 0 && [...cartoes].every(c => c.hidden);
  });
}

(async function () {
  const lista = await carregarMetas();
  if (!lista) return;
  const publicas = lista.filter(m => m.publicar).sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
  const porPrio = (a, b) => (a.prioridade || 99) - (b.prioridade || 99);
  const ativas = publicas.filter(m => m.estado === "a angariar").sort(porPrio);
  const seguir = publicas.filter(m => m.estado === "a seguir").sort(porPrio);
  // Se sobrar dinheiro, vai para a meta seguinte por prioridade (salvo "proxima" na Sheet).
  const fila = ativas.concat(seguir);
  fila.forEach((m, i) => { if (!m.proxima && fila[i + 1]) m.proxima = fila[i + 1].id; });
  const feitas = publicas.filter(m => m.estado === "garantido" || m.estado === "feito");

  const por = (id, l, f) => { const el = document.getElementById(id); l.forEach(m => el.appendChild(f ? f(m) : cartao(m, publicas))); };
  por("m-ativas", ativas);
  if (ativas.length === 1) document.getElementById("m-ativas").classList.add("uma"); por("m-seguir", seguir, linha); por("m-feitas-lista", feitas, linha);
  caminho(publicas);
  galerias(document);
  animar(document);

  contar(document.getElementById("m-feitas"), feitas.length);
  contar(document.getElementById("m-agora"), ativas.length);
  festejar(publicas);

  document.querySelectorAll(".metas-filtros button").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".metas-filtros button").forEach(x => { x.classList.toggle("ativo", x === b); x.setAttribute("aria-pressed", x === b); });
    filtrar(b.dataset.grupo);
  }));
  document.addEventListener("click", e => {
    const b = e.target.closest(".m-ajudar");
    if (b) abrirDialogo(publicas.find(m => m.id === b.dataset.meta));
    const t = e.target.closest(".m-metodos button");
    if (t) metodo(t.dataset.metodo);
    const v = e.target.closest(".m-valor");
    if (v) {
      v.parentElement.querySelectorAll(".m-valor").forEach(x => { x.classList.toggle("ativo", x === v); x.setAttribute("aria-checked", x === v); });
      const outro = v.dataset.valor === "outro";
      document.getElementById("m-outro").hidden = !outro;
      if (outro) { const i = document.getElementById("m-outro-valor"); i.focus(); escolherValor(parseInt(i.value, 10) || 0); }
      else escolherValor(Number(v.dataset.valor));
    }
    const p = e.target.closest("[data-pagar]");
    if (p) pagar(p.dataset.pagar);
    const s = e.target.closest("[data-partilhar]");
    if (s) partilhar(publicas.find(m => m.id === s.dataset.partilhar));
  });
  document.getElementById("m-outro-valor").addEventListener("input", e => escolherValor(Math.max(0, parseInt(e.target.value, 10) || 0)));
  if (location.hash) { const alvo = document.querySelector(location.hash); if (alvo) setTimeout(() => alvo.scrollIntoView({ block: "center" }), 300); }
  document.querySelectorAll("[data-copiar]").forEach(b => b.addEventListener("click", () =>
    copiar(document.getElementById(b.dataset.copiar).textContent.trim(), b)));
})();
