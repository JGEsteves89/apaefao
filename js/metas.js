// Metas: cada pessoa escolhe para que coisa vai a sua ajuda.
// Dados: Google Sheet (folhas "metas" e "movimentos", lidas pelo Apps Script com ?acao=metas). Se falhar, data/metas.json.
// Valores: barra = entradas + passagens da meta; meta feita = o que custou (saídas). fundo_livre = dinheiro ainda sem destino.
// Estados: "a angariar" (barra), "garantido" (barra cheia), "feito" (foto + fatura), "a seguir" (fechada).
// MOSTRAR_EUROS (config.js): enquanto for false, a página mostra só percentagens, sem valores em €.
// Recreio: as metas do grupo "Recreio" juntam-se por "fase" (um cartão por fase). As que têm "peca" + "pecas"
// aparecem em "Apadrinha uma peça". "padrinhos" (nome + nível, sem valores) vem do Apps Script.

const EUROS = typeof MOSTRAR_EUROS !== "undefined" && MOSTRAR_EUROS;
// "1 820 €": espaço nos milhares também com 4 algarismos, e o € nunca fica sozinho noutra linha.
const euros = v => Number(v).toLocaleString("pt-PT", { maximumFractionDigits: 0, useGrouping: "always" }) + "\u00a0€";
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

// A parte que esta pessoa deu (guardada só neste browser; em modo privado não aparece).
function minhas() { try { return JSON.parse(localStorage.getItem("metas-minhas") || "{}"); } catch (e) { return {}; } }
function guardarMinha(id, v) {
  const t = minhas(); t[id] = (t[id] || 0) + v;
  try { localStorage.setItem("metas-minhas", JSON.stringify(t)); } catch (e) {}
}

function barra(m) {
  const meu = m.meu || 0, total = m.angariado + meu;
  const p = Math.min(100, Math.round(total / m.custo * 100)) || 0;
  const pBase = Math.min(100, m.angariado / m.custo * 100) || 0, pMeu = Math.max(0, Math.min(100, total / m.custo * 100) - pBase);
  const valores = EUROS
    ? `<b><span class="m-num" data-ate="${total}">0</span>&nbsp;€</b> de ${euros(m.custo)}`
    : `<b><span class="m-num" data-ate="${p}">0</span>%</b> da meta`;
  const falta = m.custo - total;
  const resto = [];
  if (m.estado === "a angariar") {
    if (EUROS && falta > 0) resto.push(`Faltam ${euros(falta)}`);
    if (m.data_limite) resto.push(`até ${dataCurta(m.data_limite)}`);
  }
  return `
    <div class="m-barra${p >= 80 && p < 100 ? " brilho" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="${p}% da meta">
      <i style="--p:${pBase}%"></i><i class="meu" style="--l:${pBase}%;--p:${pMeu}%"></i>
      <span class="marco" style="left:25%"></span><span class="marco" style="left:50%"></span><span class="marco" style="left:75%"></span>
    </div>
    <p class="m-valores-linha">${valores}${m.apoiantes ? ` · ${m.apoiantes} ${m.apoiantes === 1 ? "apoiante" : "apoiantes"}` : ""}</p>
    ${meu ? `<p class="m-meu">💛 ${EUROS ? euros(meu) + " são teus" : "Uma parte é tua"}. Obrigado!</p>` : ""}
    ${resto.length ? `<p class="m-falta">${resto.join(" · ")}</p>` : ""}`;
}

function custos(m) {
  if (!m.custos_detalhe || !m.custos_detalhe.length) return "";
  const linhas = m.custos_detalhe.map(l => `<li>${escapar(EUROS ? l : l.replace(/[≈]?\s?[\d\s.,]+\s?€/g, "").replace(/\s[×=]\s*$/, "").trim())}</li>`).join("");
  return `<details class="m-custos"><summary>Ver custos</summary><ul>${linhas}</ul></details>`;
}

// Metas garantidas e feitas: cartão com as fotos de como foi (galeria grande), título e o que se conseguiu.
function feita(m) {
  const el = document.createElement("article");
  el.className = "m-cartao m-feita estado-" + m.estado.replace(" ", "-");
  el.id = "meta-" + m.id;
  el.dataset.grupo = m.grupo || "";
  const valor = EUROS ? ` · <b>${euros(m.angariado || m.custo)}</b>` : "";
  const custou = EUROS ? ` · custou <b>${euros(m.gasto || m.custo)}</b>` : "";
  const estado = m.estado === "feito" ? `🎉 Feito a ${dataCurta(m.feito_em)}${custou}` : `✅ Garantido${valor}`;
  el.innerHTML = `${imagem(m)}<div class="m-corpo"><h3>${escapar(m.emoji)} ${escapar(m.titulo)}</h3>
    <p class="m-linha-estado">${estado}${m.nota ? " · " + escapar(m.nota) : ""}</p>
    <p class="m-frase">${escapar(m.frase)}</p></div>`;
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
      + "</div>";
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
      if (!MOVIMENTO) { n.textContent = ate.toLocaleString("pt-PT", { useGrouping: "always" }); return; }
      const t0 = performance.now(), dur = 800;
      const passo = t => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        n.textContent = Math.round(ate * e).toLocaleString("pt-PT", { useGrouping: "always" });
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


// Confetes uma vez por meta garantida/feita neste browser.
function festejar(lista) {
  let vistos = [];
  try { vistos = JSON.parse(localStorage.getItem("metas-festejadas") || "[]"); } catch (e) {}
  const novas = lista.filter(m => (m.estado === "garantido" || m.estado === "feito") && !vistos.includes(m.id));
  if (!novas.length) return;
  setTimeout(confetti, 600);
  try { localStorage.setItem("metas-festejadas", JSON.stringify(vistos.concat(novas.map(m => m.id)))); } catch (e) {}
}

// Diálogo "Quero ajudar": valor (com impacto) → forma de pagar.
const ONLINE = (typeof PAGAMENTOS_ONLINE !== "undefined" && PAGAMENTOS_ONLINE) || /demo=pagamentos/.test(location.search);
const DEMO = /demo=pagamentos/.test(location.search);
let metaAberta = null, valorEscolhido = 0, opcoes = {};

function impacto(m, v) {
  if (!v) return "";
  if (opcoes.fixo) return `${v}\u00a0€ = 1 ${m.titulo.charAt(0).toLowerCase() + m.titulo.slice(1)} 💛`;
  const faltaJa = Math.max(0, m.custo - m.angariado);
  if (faltaJa && v >= faltaJa) return `${v} € fecham esta meta! 🎉`;
  return `${v} € = ${Math.max(1, Math.round(v / m.custo * 100))}% desta meta 💛`;
}

function escolherValor(v) {
  valorEscolhido = v;
  const m = metaAberta, d = document.getElementById("m-dialogo");
  const nome = (document.getElementById("m-nome").value || "").trim();
  const ref = (opcoes.ref || "META " + m.id.split("-")[0].toUpperCase()) + (v ? " " + v + "EUR" : "") + " " + (nome || "+ o teu nome");
  d.querySelector("#m-ref").textContent = ref;
  d.querySelector("#m-ref2").textContent = ref;
  d.querySelectorAll(".m-v").forEach(s => { s.textContent = v ? v + " €" : "o valor"; });
  d.querySelector("#m-impacto").textContent = impacto(m, v);
  d.querySelectorAll(".m-pagar").forEach(b => { b.disabled = !v; });
}

// o.fixo: valor fechado (peça). o.ref: início do texto da transferência (ex.: "PECA HORTA").
function abrirDialogo(m, o = {}) {
  metaAberta = m; opcoes = o;
  const d = document.getElementById("m-dialogo");
  d.querySelector("#m-d-titulo").textContent = `${m.emoji} ${m.titulo}`;
  d.querySelector(".m-d-frase").textContent = m.frase;
  const sugestoes = m.custo <= 300 ? [5, 10, 20] : [10, 25, 50];
  d.querySelector("#m-valores").innerHTML = sugestoes.map((v, i) =>
    `<button type="button" role="radio" class="m-valor${i === 1 ? " ativo" : ""}" aria-checked="${i === 1}" data-valor="${v}">${v} €</button>`).join("")
    + '<button type="button" role="radio" class="m-valor" aria-checked="false" data-valor="outro">Outro</button>';
  d.querySelector("#m-valores").hidden = !!o.fixo;
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
  d.querySelector("#m-recibo-erro").textContent = "";
  extras();
  escolherValor(o.fixo || sugestoes[1]);
  if (d.showModal) d.showModal(); else d.setAttribute("open", "");
}

// Recibo para as Finanças e "Preferem vir buscar?": mostram os seus campos.
function extras() {
  const levantar = document.getElementById("m-levantar").checked;
  document.getElementById("m-recibo-campos").hidden = !document.getElementById("m-recibo").checked;
  document.getElementById("m-levantar-campos").hidden = !levantar;
  document.getElementById("m-pagamento").hidden = levantar;
}

// NIF português: 9 algarismos e o último confere com os outros (módulo 11).
function nifValido(n) {
  if (!/^\d{9}$/.test(n)) return false;
  let soma = 0;
  for (let i = 0; i < 8; i++) soma += Number(n[i]) * (9 - i);
  const resto = soma % 11, controlo = resto < 2 ? 0 : 11 - resto;
  return controlo === Number(n[8]);
}

// Dados do recibo (ou null se faltar alguma coisa: mostra o erro e põe o cursor no campo).
function dadosRecibo() {
  const erro = document.getElementById("m-recibo-erro");
  erro.textContent = "";
  if (!document.getElementById("m-recibo").checked) return {};
  const v = id => document.getElementById(id).value.trim();
  const falha = (id, texto) => { erro.textContent = texto; document.getElementById(id).focus(); return null; };
  const nif = v("m-nif").replace(/\s/g, "");
  if (!nifValido(nif)) return falha("m-nif", "O NIF não está certo. Confirma os 9 algarismos.");
  if (!v("m-r-nome")) return falha("m-r-nome", "Escreve o nome ou a empresa para o recibo.");
  if (!/^\S+@\S+\.\S+$/.test(v("m-email"))) return falha("m-email", "Escreve o email para onde enviamos o recibo.");
  return { recibo: true, nif, recibo_nome: v("m-r-nome"), email: v("m-email"), morada: v("m-morada") };
}

function metodo(nome) {
  document.querySelectorAll(".m-metodos button").forEach(x => { x.classList.toggle("ativo", x.dataset.metodo === nome); x.setAttribute("aria-selected", x.dataset.metodo === nome); });
  document.querySelectorAll(".m-metodo").forEach(p => { p.hidden = p.dataset.painel !== nome; });
}

// Pagamento online: o Apps Script fala com a Eupago/ifthenpay (?acao=pagamento). Em ?demo=pagamentos é simulado.
async function pagar(tipo) {
  const m = metaAberta, v = valorEscolhido;
  if (!dadosRecibo()) return;
  const resp = document.getElementById(tipo === "mbway" ? "m-resp-mbway" : "m-resp-ref");
  const tel = (document.getElementById("m-tel").value || "").replace(/\D/g, "");
  if (tipo === "mbway" && !/^9\d{8}$/.test(tel)) { resp.textContent = "Escreve um número de telemóvel português (9 algarismos)."; return; }
  resp.textContent = "A preparar…";
  let r;
  try {
    if (DEMO) { await espera(700); r = tipo === "mbway" ? { ok: true } : { ok: true, entidade: "21 312", referencia: "123 456 789", valor: v }; }
    else {
      const q = new URLSearchParams({ acao: "pagamento", tipo, meta: m.id, valor: v, telemovel: tel });
      r = await (await fetch(ENDPOINT + "?" + q, { signal: AbortSignal.timeout(15000) })).json();
    }
  } catch (e) { r = { ok: false }; }
  if (!r || !r.ok) { resp.textContent = "Não foi possível agora. Experimenta a transferência, por favor."; return; }
  if (tipo === "mbway") {
    resp.innerHTML = `📱 Enviámos um pedido de <b>${v} €</b> para o teu MB WAY. Abre a app e aceita (tens 4 minutos).`;
    if (DEMO) { await espera(2500); pago(m, v, tipo, resp); }
  } else {
    document.getElementById("m-ent").textContent = r.entidade;
    document.getElementById("m-refn").textContent = r.referencia;
    document.getElementById("m-refv").textContent = r.valor + " €";
    document.getElementById("m-refmb").hidden = false;
    resp.innerHTML = "Paga no multibanco ou no homebanking, em <b>Pagamentos de Serviços</b>."
      + (DEMO ? ' <button type="button" class="m-simular" data-simular>Simular o pagamento</button>' : "");
  }
}

// Pagamento recebido: mensagem, linha na Sheet (por confirmar), barra avança só neste browser.
async function pago(m, v, tipo, resp) {
  const recibo = dadosRecibo();
  if (!recibo) return;
  resp.innerHTML = recibo.recibo && tipo === "transf" ? "✅ <b>Obrigado!</b> Vamos confirmar a transferência e enviar o recibo por email. 💛"
    : (tipo === "transf" ? `✅ <b>Obrigado pelos teus ${v}\u00a0€!</b> 💛` : `✅ <b>Recebemos os teus ${v}\u00a0€.</b> Obrigado! 💛`)
      + (recibo.recibo ? " Enviamos o recibo por email." : "");
  enviar("doacao_meta", { ...recibo, meta: m.id, valor: v, metodo: tipo, demo: DEMO,
    nome: document.getElementById("m-nome").value.trim(), contacto: document.getElementById("m-contacto").value.trim(),
    publico: document.getElementById("m-publico").checked, nota: DEMO ? "Demonstração (não é dinheiro real)" : tipo === "transf" ? "Avisou no site que transferiu" : "" });
  guardarMinha(m.id, v);
  m.meu = (m.meu || 0) + v;
  await espera(recibo.recibo ? 3000 : 1400);
  const d = document.getElementById("m-dialogo");
  if (d.close) d.close(); else d.removeAttribute("open");
  if (m.grupo === "Recreio") {
    desenharMetas();
    const f = document.querySelector(`[data-tem-meta~="${m.id}"]`);
    if (f) { f.scrollIntoView({ block: "center", behavior: MOVIMENTO ? "smooth" : "auto" }); f.classList.add("m-festa"); }
    confetti();
    return;
  }
  const c = document.getElementById("meta-" + m.id);
  if (!c) return;
  c.scrollIntoView({ block: "center", behavior: MOVIMENTO ? "smooth" : "auto" });
  await espera(MOVIMENTO ? 500 : 0);
  const velho = c.querySelector(".m-barra").closest(".m-corpo");
  const novo = document.createElement("div");
  novo.innerHTML = barra(m);
  const antes = c.querySelector(".m-barra");
  antes.parentElement.querySelectorAll(".m-barra, .m-valores-linha, .m-meu, .m-falta").forEach(e => e.remove());
  const custo = velho.querySelector(".m-custos") || velho.querySelector(".m-acoes");
  [...novo.children].forEach(e => velho.insertBefore(e, custo));
  // Só a parte nova avança; o resto da barra fica onde estava.
  const base = c.querySelector(".m-barra i:not(.meu)"), meu = c.querySelector(".m-barra i.meu"), num = c.querySelector(".m-num");
  base.style.transition = "none";
  meu.style.width = "0"; meu.style.transitionDelay = ".15s";
  const de = Number(num.dataset.ate) - v, ate = Number(num.dataset.ate);
  num.textContent = Math.round(de).toLocaleString("pt-PT");
  requestAnimationFrame(() => requestAnimationFrame(() => { meu.style.width = ""; }));
  const t0 = performance.now();
  const passo = t => { const k = Math.min(1, (t - t0) / 1200); num.textContent = Math.round(de + (ate - de) * (1 - Math.pow(1 - k, 3))).toLocaleString("pt-PT"); if (k < 1) requestAnimationFrame(passo); };
  requestAnimationFrame(passo);
  c.classList.add("m-festa");
  confetti();
}

// "Preferem vir buscar?": pedido para a Direção ligar. Ainda não é dinheiro, por isso a barra não mexe.
function pedirLevantar() {
  const recibo = dadosRecibo();
  if (!recibo) return;
  const tel = document.getElementById("m-l-tel").value.trim(), resp = document.getElementById("m-resp-levantar");
  if (tel.replace(/\D/g, "").length < 9) { resp.textContent = "Escreve um telefone para combinarmos."; document.getElementById("m-l-tel").focus(); return; }
  if (!valorEscolhido) { resp.textContent = "Escolhe primeiro quanto queres dar."; return; }
  enviar("doacao_meta", { ...recibo, meta: metaAberta.id, valor: valorEscolhido, metodo: "levantar", telefone: tel, demo: DEMO,
    nome: document.getElementById("m-nome").value.trim(), contacto: document.getElementById("m-contacto").value.trim() || tel,
    publico: document.getElementById("m-publico").checked, nota: "Pede para irmos levantar" });
  resp.innerHTML = "✅ <b>Obrigado!</b> Ligamos para combinar. 💛";
}

// ---------- Recreio ----------
// data/recreio.json, "fases": os projetos do recreio, juntos (as "areas" e as "zonas" são da página recreio.html). Uma fase aparece nas metas quando uma das suas metas está "a angariar".
// A Sheet dá o dinheiro e o estado: se tem uma meta com o mesmo id, os valores dela ganham.
let PUBLICAS = [], PLANO = null;
const porPrio = (a, b) => (a.prioridade ?? 99) - (b.prioridade ?? 99);
const PAGA = m => m.estado === "garantido" || m.estado === "feito";

function fasesDoRecreio() {
  if (!PLANO || !PLANO.fases) return [];
  const meus = minhas();
  return PLANO.fases.map((f, i) => {
    const ms = f.projetos.map(p => {
      const s = PUBLICAS.find(m => m.id === p.id);
      const m = { estado: "a seguir", angariado: 0, custos_detalhe: [], prioridade: 99, frase: "", ...p, ...(s || {}), emoji: p.emoji, custo: (s && s.custo) || p.custo };
      m.grupo = "Recreio";
      if (!PAGA(m)) m.meu = meus[m.id] || 0;
      return m;
    });
    return {
      titulo: f.titulo, num: i + 1, metas: ms, hoje: f.hoje, projeto: f.projeto,
      custo: ms.reduce((t, m) => t + (m.custo || 0), 0),
      angariado: ms.reduce((t, m) => t + (m.angariado || 0) + (m.meu || 0), 0),
      aberta: ms.some(m => m.estado === "a angariar"),
      alvo: ms.find(m => m.estado === "a angariar") || ms[0],
      prioridade: Math.min(...ms.map(m => m.prioridade ?? 99)),
    };
  });
}

// Fase do recreio como meta: foto grande (o projeto) com um botão para ver como está hoje, e o resto como as outras metas.
function cartaoFase(f) {
  const el = document.createElement("article");
  el.className = "m-cartao anima estado-a-angariar r-fase";
  el.id = "fase-" + f.num;
  el.dataset.temMeta = f.metas.map(m => m.id).join(" ");
  const p = f.custo ? Math.min(100, Math.round(f.angariado / f.custo * 100)) : 0;
  const falta = Math.max(0, f.custo - f.angariado);
  const custos = f.metas.filter(m => m.custos_detalhe && m.custos_detalhe.length);
  el.innerHTML = `
    <div class="m-img r-vistas" data-vista="projeto">
      <img class="r-v-projeto" src="${escapar(f.projeto)}" alt="Simulação: ${escapar(f.titulo)}" loading="lazy">
      <img class="r-v-hoje" src="${escapar(f.hoje)}" alt="Hoje: ${escapar(f.titulo)}" loading="lazy">
      <span class="r-v-rot"></span>
      <button class="r-v-botao" type="button" aria-pressed="false"></button>
    </div>
    <div class="m-corpo">
      <h3>🌻 ${escapar(f.titulo)}</h3>
      <p class="m-frase">${f.metas.map((m, i) => escapar(i ? m.titulo.charAt(0).toLowerCase() + m.titulo.slice(1) : m.titulo)).join(" e ")}.</p>
      <div class="m-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="${p}% da meta"><i style="--p:${p}%"></i></div>
      <p class="m-valores-linha">${EUROS ? `<b>${euros(f.angariado)}</b> de ${euros(f.custo)}` : `<b>${p}%</b> da meta`}</p>
      ${EUROS && falta ? `<p class="m-falta">Faltam ${euros(falta)}</p>` : ""}
      ${custos.length ? `<details class="m-custos"><summary>Ver custos</summary><ul>${custos.map(m =>
        m.custos_detalhe.map(l => `<li>${escapar(l)}</li>`).join("")).join("")}</ul></details>` : ""}
      <div class="m-acoes"><button class="botao m-ajudar-fase" type="button" data-fase="${f.num}">Quero ajudar esta meta</button></div>
    </div>`;
  vistas(el.querySelector(".r-vistas"));
  return el;
}


// Metas a angariar agora: as metas normais "a angariar" e as fases do recreio abertas, por prioridade.
function desenharMetas() {
  const doPlano = new Set(PLANO && PLANO.fases ? PLANO.fases.flatMap(f => f.projetos.map(p => p.id)) : []);
  const meus = minhas();
  const normais = PUBLICAS.filter(m => m.estado === "a angariar" && !doPlano.has(m.id));
  normais.forEach(m => { m.meu = meus[m.id] || 0; });
  const lista = normais.map(m => ({ m, prioridade: m.prioridade ?? 99 }))
    .concat(fasesDoRecreio().filter(f => f.aberta).map(f => ({ f, prioridade: f.prioridade })))
    .sort((a, b) => a.prioridade - b.prioridade);
  const grelha = document.getElementById("m-ativas");
  grelha.innerHTML = "";
  lista.forEach(x => grelha.appendChild(x.f ? cartaoFase(x.f) : cartao(x.m, PUBLICAS)));
  grelha.closest("section").hidden = !lista.length;
  galerias(grelha);
  animar(grelha);
}

(async function () {
  const [lista, plano] = await Promise.all([carregarMetas(), carregarJSON("data/recreio.json")]);
  PLANO = plano;
  if (!lista) {
    document.getElementById("m-ativas").innerHTML = '<p class="metas-sub">Não conseguimos carregar as metas agora. Experimenta daqui a pouco.</p>';
    return;
  }
  PUBLICAS = lista.filter(m => m.publicar);
  const publicas = PUBLICAS;
  if (DEMO) {
    const aviso = document.createElement("p");
    aviso.className = "m-demo";
    aviso.textContent = "Modo demonstração: MB WAY e Multibanco são simulados. Nenhum pagamento é feito.";
    document.querySelector(".metas-pagina").prepend(aviso);
  }
  // Se sobrar dinheiro, vai para a meta seguinte por prioridade (salvo "proxima" na Sheet).
  const fila = publicas.filter(m => m.estado === "a angariar").sort(porPrio).concat(publicas.filter(m => m.estado === "a seguir").sort(porPrio));
  fila.forEach((m, i) => { if (!m.proxima && fila[i + 1]) m.proxima = fila[i + 1].id; });

  desenharMetas();
  const feitas = publicas.filter(PAGA);
  const el = document.getElementById("m-feitas-lista");
  feitas.forEach(m => el.appendChild(feita(m)));
  el.closest("section").hidden = !feitas.length;
  galerias(el);
  animar(el);
  festejar(publicas);

  // Ajudar uma fase do recreio: o dinheiro vai para a primeira meta aberta dessa fase.
  const abrirFase = num => {
    const f = fasesDoRecreio().find(x => String(x.num) === String(num));
    if (!f) return;
    const m = f.alvo;
    abrirDialogo({ ...m, titulo: f.titulo, emoji: "🌻", frase: `O teu donativo vai para: ${m.titulo}.`, custo: f.custo, angariado: f.angariado,
      unidade: "", grupo: "Recreio", id: m.id }, { ref: "FASE" + f.num });
  };

  document.addEventListener("click", e => {
    const b = e.target.closest(".m-ajudar");
    if (b) abrirDialogo(publicas.find(m => m.id === b.dataset.meta));
    const fb = e.target.closest("[data-fase]");
    if (fb) abrirFase(fb.dataset.fase);
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
    if (e.target.closest("[data-simular]")) pago(metaAberta, valorEscolhido, "ref", document.getElementById("m-resp-ref"));
    if (e.target.closest("[data-transferi]") && valorEscolhido) pago(metaAberta, valorEscolhido, "transf", document.getElementById("m-resp-transf"));
    if (e.target.closest("[data-levantar]")) pedirLevantar();
  });
  ["m-recibo", "m-levantar"].forEach(id => document.getElementById(id).addEventListener("change", extras));
  document.getElementById("m-recibo-campos").addEventListener("input", () => { document.getElementById("m-recibo-erro").textContent = ""; });
  document.getElementById("m-nome").addEventListener("input", () => escolherValor(valorEscolhido));
  document.getElementById("m-outro-valor").addEventListener("input", e => escolherValor(Math.max(0, parseInt(e.target.value, 10) || 0)));
  if (location.hash) { const alvo = document.querySelector(location.hash); if (alvo) setTimeout(() => alvo.scrollIntoView({ block: "center" }), 300); }
  document.querySelectorAll("[data-copiar]").forEach(b => b.addEventListener("click", () =>
    copiar(document.getElementById(b.dataset.copiar).textContent.trim(), b)));
})();
