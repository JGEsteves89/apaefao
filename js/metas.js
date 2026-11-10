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
      const lista = await r.json();
      if (Array.isArray(lista) && lista.length) return lista;
    } catch (e) {}
  }
  return carregarJSON("data/metas.json");
}

function selo(m) {
  if (m.estado === "feito") return '<span class="m-selo feito">🎉 Feito</span>';
  if (m.estado === "garantido") return '<span class="m-selo garantido">✅ Garantido</span>';
  if (m.estado === "a seguir") return '<span class="m-selo seguir">🔒 A seguir</span>';
  if (pct(m) >= 80) return '<span class="m-selo quase">Quase lá!</span>';
  return "";
}

function imagem(m) {
  const src = m.estado === "feito" && m.imagem_depois ? m.imagem_depois : m.imagem;
  return src
    ? `<div class="m-img"><img src="${escapar(src)}" alt="" loading="lazy"></div>`
    : `<div class="m-img icone" aria-hidden="true">${escapar(m.emoji || "🎯")}</div>`;
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
    ${resto.length ? `<p class="m-falta">${resto.join(" · ")}</p>` : ""}`;
}

function custos(m) {
  if (!m.custos_detalhe || !m.custos_detalhe.length) return "";
  const linhas = m.custos_detalhe.map(l => `<li>${escapar(EUROS ? l : l.replace(/[≈]?\s?[\d\s.,]+\s?€/g, "").replace(/\s[×=]\s*$/, "").trim())}</li>`).join("");
  return `<details class="m-custos"><summary>Ver custos</summary><ul>${linhas}</ul></details>`;
}

function cartao(m, lista) {
  const el = document.createElement("article");
  el.className = "m-cartao anima estado-" + m.estado.replace(" ", "-");
  el.dataset.grupo = m.grupo || "";
  const prox = m.proxima && lista.find(x => x.id === m.proxima);
  let fundo = "";
  if (m.estado === "a angariar") {
    fundo = `<button class="botao m-ajudar" type="button" data-meta="${escapar(m.id)}">Quero ajudar esta meta</button>`
      + (prox ? `<p class="m-prox">Se sobrar, vai para: ${escapar(prox.emoji)} ${escapar(prox.titulo)}</p>` : "");
  } else if (m.estado === "feito") {
    fundo = `<p class="m-feito">Feito a ${dataCurta(m.feito_em)}${m.nota ? " · " + escapar(m.nota) : ""}</p>`
      + (m.fatura ? `<a class="m-fatura" href="${escapar(m.fatura)}" target="_blank" rel="noopener">🧾 Ver fatura</a>` : "");
  } else if (m.nota) {
    fundo = `<p class="m-feito">${escapar(m.nota)}</p>`;
  }
  el.innerHTML = `${imagem(m)}${selo(m)}
    <div class="m-corpo">
      ${m.estado !== "feito" && m.estado !== "garantido" && m.prioridade ? `<p class="m-prio">⭐ Prioridade ${m.prioridade}${m.motivo ? " · " + escapar(m.motivo) : ""}</p>` : ""}
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

function caminho(lista) {
  const el = document.getElementById("m-caminho");
  const recreio = lista.filter(m => m.grupo === "Recreio");
  el.innerHTML = recreio.map(m => {
    const feito = m.estado === "garantido" || m.estado === "feito";
    return `<li class="${feito ? "aceso" : m.estado === "a angariar" ? "agora" : ""}"><span aria-hidden="true">${escapar(m.emoji)}</span>${escapar(m.titulo.replace(/ para .*$/, ""))}</li>`;
  }).join("");
  if (!recreio.length) el.closest("section").hidden = true;
}

function abrirDialogo(m) {
  const d = document.getElementById("m-dialogo");
  d.querySelector("#m-d-titulo").textContent = `${m.emoji} ${m.titulo}`;
  d.querySelector(".m-d-frase").textContent = m.frase;
  const ref = "META " + m.id.split("-")[0].toUpperCase() + " + o teu nome";
  d.querySelector("#m-ref").textContent = ref;
  d.querySelector("#m-ref2").textContent = ref;
  const temMbway = typeof MBWAY_NUMERO !== "undefined" && MBWAY_NUMERO;
  d.querySelector('[data-metodo="mbway"]').hidden = !temMbway;
  if (temMbway) d.querySelector("#m-mbway").textContent = MBWAY_NUMERO;
  d.querySelector('[data-metodo="ref"]').hidden = !(typeof REFERENCIA_MB !== "undefined" && REFERENCIA_MB);
  const sugestoes = m.custo <= 300 ? [5, 10, 20] : [10, 25, 50];
  d.querySelector("#m-valores").innerHTML = sugestoes.map(v => `<span class="m-valor">${v} €</span>`).join("") + '<span class="m-valor">Outro</span>';
  if (d.showModal) d.showModal(); else d.setAttribute("open", "");
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

  const por = (id, l) => { const el = document.getElementById(id); l.forEach(m => el.appendChild(cartao(m, publicas))); };
  por("m-ativas", ativas);
  if (ativas.length === 1) document.getElementById("m-ativas").classList.add("uma"); por("m-seguir", seguir); por("m-feitas-lista", feitas);
  caminho(publicas);
  animar(document);

  contar(document.getElementById("m-feitas"), feitas.length);
  contar(document.getElementById("m-agora"), ativas.length);
  festejar(publicas);

  document.querySelectorAll(".metas-filtros button").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".metas-filtros button").forEach(x => x.classList.toggle("ativo", x === b));
    document.querySelectorAll(".m-cartao").forEach(c => { c.hidden = b.dataset.grupo && c.dataset.grupo !== b.dataset.grupo; });
  }));
  document.addEventListener("click", e => {
    const b = e.target.closest(".m-ajudar");
    if (b) abrirDialogo(publicas.find(m => m.id === b.dataset.meta));
    const t = e.target.closest(".m-metodos button");
    if (t) {
      document.querySelectorAll(".m-metodos button").forEach(x => x.classList.toggle("ativo", x === t));
      document.querySelectorAll(".m-metodo").forEach(p => { p.hidden = p.dataset.painel !== t.dataset.metodo; });
    }
    const v = e.target.closest(".m-valor");
    if (v) { v.parentElement.querySelectorAll(".m-valor").forEach(x => x.classList.toggle("ativo", x === v)); }
  });
  document.querySelectorAll("[data-copiar]").forEach(b => b.addEventListener("click", () =>
    copiar(document.getElementById(b.dataset.copiar).textContent.trim(), b)));
})();
