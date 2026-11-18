// Ementa da cantina: página ementa.html (#ementa) e cartão "Hoje na cantina" na página inicial (#ementa-hoje).
// Os pratos vêm de data/ementa.json (escrito por scripts/ementa_import.py a partir do PDF do SIGA).
// Os votos 👍/👎 vão para o Apps Script (folha "ementa_votos"). Teste com datas: ?hoje=2026-11-21 ou ?hoje=2026-11-18T13:00

const EM_ICONE = { peixe: "🐟", carne: "🍗", ovo: "🥚", vegetariano: "🥕", outro: "🍽️" };
const EM_DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const EM_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const EM_MIN_VOTOS = 5;

// Agora em Lisboa: { data: "AAAA-MM-DD", hora: "HH:MM" }
function emAgora() {
  const p = new URLSearchParams(location.search).get("hoje");
  if (p && /^\d{4}-\d{2}-\d{2}/.test(p)) return { data: p.slice(0, 10), hora: p.slice(11, 16) || "13:00" };
  const d = new Date();
  return { data: d.toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" }), hora: d.toLocaleTimeString("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit", hour12: false }) };
}
const emData = iso => new Date(iso + "T12:00:00Z");
const emDiaSemana = iso => EM_DIAS[emData(iso).getUTCDay()];
const emCurto = iso => emDiaSemana(iso).slice(0, 3).toUpperCase() + " " + emData(iso).getUTCDate();
const emDiaMes = iso => emData(iso).getUTCDate() + " " + EM_MESES[emData(iso).getUTCMonth()].slice(0, 3);
const emMaiuscula = t => t ? t[0].toUpperCase() + t.slice(1) : t;

function emSemanaTexto(s) {
  const a = emData(s.inicio), b = emData(s.fim);
  const mes = d => EM_MESES[d.getUTCMonth()];
  return "Semana de " + a.getUTCDate() + (mes(a) === mes(b) ? "" : " de " + mes(a)) + " a " + b.getUTCDate() + " de " + mes(b);
}

// "Tilápia no forno com azeite e alho. Arroz com…" → nome "Tilápia no forno com azeite e alho", resto "Arroz com…"
// "Jardineira de frango (frango, batata…)" → nome "Jardineira de frango", resto "Frango, batata…"
function emPrato(t) {
  const m = String(t || "").match(/^([^.,(]+)[.,(]\s*(.*)$/);
  if (!m) return { nome: String(t || "").trim(), resto: "" };
  const resto = m[2].replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  return { nome: m[1].trim(), resto: emMaiuscula(resto) };
}
const emSopa = t => emMaiuscula(String(t || "").replace(/^sopa de\s+/i, ""));

// Votos: um por telemóvel e por dia, guardado neste telemóvel. Se o envio falhar, volta a enviar na visita seguinte.
function emLer(chave) { try { return JSON.parse(localStorage.getItem(chave) || "null"); } catch (e) { return null; } }
function emGravar(chave, v) { try { localStorage.setItem(chave, JSON.stringify(v)); } catch (e) {} }
function emVotante() {
  let id = emLer("ementa-votante");
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); emGravar("ementa-votante", id); }
  return id;
}
async function emEnviar(dia, voto) {
  const ok = await enviar("ementa_voto", { data: dia.data, voto: voto, prato: dia.prato, proteina: dia.proteina, voterId: emVotante() });
  emGravar("ementa-voto-" + dia.data, { v: voto, enviado: ok });
}

// ?demo na morada: votos inventados (20 por dia, sempre os mesmos), só para ver como fica. Não envia nada.
const EM_DEMO = new URLSearchParams(location.search).has("demo");
function emDemo(semana) {
  const r = {};
  (semana.dias || []).forEach(d => {
    let h = 0; for (const c of d.data) h = (h * 31 + c.charCodeAt(0)) % 9973;
    const up = 4 + h % 17; r[d.data] = { up: up, down: 20 - up };
  });
  return r;
}

function emTotais(semana) {
  if (EM_DEMO) return Promise.resolve(emDemo(semana));
  if (!ENDPOINT) return Promise.resolve(null);
  return fetch(ENDPOINT + "?acao=ementa_votos&semana=" + semana.inicio, { signal: AbortSignal.timeout(15000) })
    .then(r => r.ok ? r.json() : null).catch(() => null);
}

// Pode votar em qualquer dia da semana com refeição, a qualquer hora (pedido do Jose, 18/11).
function emPodeVotar(dia) {
  return !dia.sem_aulas && !!dia.prato;
}

function emPct(t) { return t && t.up + t.down >= EM_MIN_VOTOS ? Math.round(100 * t.up / (t.up + t.down)) : null; }

// Barra pequena: verde = pais contentes, vermelho = não contentes. Sem números (o % fica só para leitores de ecrã).
function emHumor(pct, classe) {
  return pct === null ? "" : `<span class="em-humor${classe ? " " + classe : ""}" role="img" aria-label="${pct}% dos pais gostaram" title="${pct >= 50 ? "Os pais gostaram" : "Os pais não gostaram muito"}"><b style="width:${pct}%"></b></span>`;
}

function emVotoHTML(dia, agora, t, comTendencia) {
  const meu = (emLer("ementa-voto-" + dia.data) || {}).v, pode = emPodeVotar(dia, agora);
  const pct = comTendencia ? emPct(t) : null;
  return `<div class="em-voto" data-voto-dia="${dia.data}">
    <button type="button" class="em-b${meu === 1 ? " meu" : ""}" data-voto="1" aria-pressed="${meu === 1}" aria-label="Gostei"${pode ? "" : " disabled"}>👍</button>
    <button type="button" class="em-b${meu === -1 ? " meu" : ""}" data-voto="-1" aria-pressed="${meu === -1}" aria-label="Não gostei"${pode ? "" : " disabled"}>👎</button>
    ${emHumor(pct)}
  </div>`;
}

// Liga os botões de voto dentro de raiz. Muda logo os números (+1) e envia.
function emLigarVotos(raiz, dias, totais, redesenhar) {
  raiz.addEventListener("click", e => {
    const b = e.target.closest("[data-voto]");
    if (!b || b.disabled) return;
    const data = b.closest("[data-voto-dia]").dataset.votoDia, dia = dias.find(d => d.data === data);
    const voto = Number(b.dataset.voto), antes = (emLer("ementa-voto-" + data) || {}).v;
    if (antes === voto) return;
    const t = totais[data];
    if (t) {
      if (antes === 1) t.up--; if (antes === -1) t.down--;
      if (voto === 1) t.up++; else t.down++;
    }
    emGravar("ementa-voto-" + data, { v: voto, enviado: false });
    if (!EM_DEMO) emEnviar(dia, voto);
    redesenhar();
  });
}

// Reenvia votos que ficaram por enviar (ex.: sem rede).
function emReenviar(dias) {
  dias.forEach(d => { const v = emLer("ementa-voto-" + d.data); if (v && !v.enviado) emEnviar(d, v.v); });
}

// Escolhe a semana a mostrar e o dia aberto.
function emEscolher(ementa, agora) {
  const semanas = (ementa.semanas || []).slice().sort((a, b) => a.inicio < b.inicio ? -1 : 1);
  const semana = semanas.find(s => s.fim >= agora.data);
  if (!semana) return { semana: null };
  const dias = semana.dias || [];
  // dia aberto: hoje, ou o próximo dia com aulas
  const aberto = dias.find(d => d.data === agora.data) || dias.find(d => d.data > agora.data) || dias[dias.length - 1];
  return { semana, dias, aberto };
}

const emNaoSaiu = fds => `<div class="em-vazio cartao-em">
  <img src="img/mascote/pensa.webp" alt="" width="70" height="89">
  <p>${fds ? "<b>Bom fim de semana!</b> A ementa da próxima semana" : "A ementa desta semana"} ainda não saiu. Voltamos a verificar amanhã.</p>
  <a class="botao" href="https://node1.siga.edubox.pt/webapp/menus" target="_blank" rel="noopener">Ver no SIGA</a>
</div>`;

const emFimDeSemana = agora => [0, 6].includes(emData(agora.data).getUTCDay());

// ---------- Página ementa.html ----------
async function emPagina(el) {
  const ementa = await carregarDados("ementa", el, () => fetch("data/ementa.json", { cache: "no-cache" }).then(r => r.json()));
  if (!ementa) return;
  const agora = emAgora(), { semana, dias, aberto } = emEscolher(ementa, agora);
  const sub = document.getElementById("em-semana");
  if (!semana) { sub.textContent = ""; el.innerHTML = emNaoSaiu(emFimDeSemana(agora)); return; }
  sub.textContent = emSemanaTexto(semana) + " · Escola Básica de Fão";
  emReenviar(dias);

  const totais = {};
  let abertoData = aberto && aberto.data;
  const antesDaSemana = agora.data < semana.inicio;

  function cartao(d) {
    const passado = d.data < agora.data, hoje = d.data === agora.data, aberto = d.data === abertoData;
    const ic = EM_ICONE[d.proteina] || EM_ICONE.outro;
    const p = emPrato(d.prato), t = totais[d.data], pct = passado ? emPct(t) : null;
    const semRefeicao = d.sem_aulas || !d.prato;
    const linha = semRefeicao ? (d.nota || "Sem refeições neste dia") : p.nome + (p.resto ? ", " + p.resto.toLowerCase() : "");
    const fim = pct !== null ? emHumor(pct, "mini") : '<span class="em-seta" aria-hidden="true"></span>';
    const item = (rot, txt) => txt ? `<div class="em-item"><div class="em-rot">${rot}</div>${escapar(txt)}</div>` : "";
    const corpo = semRefeicao
      ? `<p class="em-sem">${escapar(d.nota || "Sem refeições neste dia")}</p>`
      : `<h3 class="em-nome">${escapar(p.nome)}</h3>${p.resto ? `<p class="em-resto">${escapar(p.resto)}</p>` : ""}
        ${item("Sopa", emSopa(d.sopa))}${item("Vegetariano", d.vegetariano)}${item("Hortícolas", d.horticolas)}${item("Sobremesa", d.sobremesa)}
        ${emVotoHTML(d, agora, t, true)}`;
    return `<article class="em-dia${passado ? " passado" : ""}${hoje ? " hoje" : ""}${aberto ? " aberto" : ""}" data-dia="${d.data}">
      <button type="button" class="em-mini" aria-expanded="${aberto}" aria-controls="em-g-${d.data}">
        <span class="em-ic" aria-hidden="true">${semRefeicao ? "🏖️" : ic}</span>
        <span class="em-tx"><span class="em-dn">${emDiaSemana(d.data)}<small>${emDiaMes(d.data)}</small></span><span class="em-pr">${escapar(linha)}</span></span>
        ${fim}
      </button>
      <div class="em-grande" id="em-g-${d.data}">
        <div class="em-banda">${hoje ? `<span class="em-tag">HOJE · ${emCurto(d.data)}</span>` : ""}<span class="em-ilu" aria-hidden="true">${semRefeicao ? "🏖️" : ic}</span></div>
        <div class="em-corpo"><p class="em-dnome">${emDiaSemana(d.data).slice(0, 3)} ${emData(d.data).getUTCDate()}</p>${corpo}</div>
      </div>
    </article>`;
  }

  function desenhar() {
    el.innerHTML = (antesDaSemana && emFimDeSemana(agora) ? '<p class="em-fds"><b>Bom fim de semana!</b> Esta é a ementa da próxima semana.</p>' : "")
      + `<div class="em-semana">${dias.map(cartao).join("")}</div>`
      + `<p class="em-fonte">Fonte: <a href="https://node1.siga.edubox.pt/webapp/menus" target="_blank" rel="noopener">ementa oficial (SIGA / Nortake)</a>. A ementa pode mudar.${semana.pdf ? ` <a href="${escapar(semana.pdf)}" target="_blank" rel="noopener">Ver PDF oficial (com alergénios)</a>` : ""}</p>`;
  }

  el.addEventListener("click", e => {
    const b = e.target.closest(".em-mini");
    if (!b) return;
    const data = b.closest(".em-dia").dataset.dia;
    abertoData = abertoData === data ? null : data;
    desenhar();
  });
  emLigarVotos(el, dias, totais, desenhar);
  desenhar();

  const r = await emTotais(semana);
  if (r) { Object.keys(r).forEach(k => { totais[k] = r[k]; }); dias.forEach(d => { totais[d.data] = totais[d.data] || { up: 0, down: 0 }; }); desenhar(); }
}

// ---------- Cartão na página inicial ----------
async function emInicio(el) {
  let ementa;
  try { ementa = await fetch("data/ementa.json", { cache: "no-cache" }).then(r => r.json()); } catch (e) { return; }
  const agora = emAgora(), { semana, dias } = emEscolher(ementa, agora);
  el.hidden = false;
  if (!semana) { el.innerHTML = emNaoSaiu(emFimDeSemana(agora)); return; }
  const comAulas = dias.filter(d => !d.sem_aulas && d.prato && d.data >= agora.data);
  const d = comAulas[0];
  if (!d) { el.innerHTML = emNaoSaiu(emFimDeSemana(agora)); return; }
  const depois = comAulas[1], hoje = d.data === agora.data;
  const amanha = emData(agora.data); amanha.setUTCDate(amanha.getUTCDate() + 1);
  const quando = x => x === amanha.toISOString().slice(0, 10) ? "Amanhã" : emDiaSemana(x);
  const totais = {};
  emReenviar(dias.filter(x => x.data <= agora.data));

  const desenhar = () => {
    const p = emPrato(d.prato);
    const linha = [d.sopa, d.vegetariano && "Vegetariano: " + emPrato(d.vegetariano).nome.toLowerCase(), d.sobremesa].filter(Boolean).join(" · ");
    el.innerHTML = `<div class="em-casa cartao-em">
      <div class="em-banda"><span class="em-tag">${hoje ? "HOJE · " : ""}${emCurto(d.data)}</span><span class="em-ilu" aria-hidden="true">${EM_ICONE[d.proteina] || EM_ICONE.outro}</span></div>
      <div class="em-corpo">
        <p class="em-rot">${hoje ? "Hoje na cantina" : quando(d.data) + " na cantina"}</p>
        <h3 class="em-nome">${escapar(p.nome)}</h3>
        <p class="em-resto">${escapar(linha)}</p>
        <div class="em-acoes"><a class="botao" href="ementa.html">Ver a semana</a>${emVotoHTML(d, agora, totais[d.data], true)}</div>
        ${depois ? `<p class="em-amanha">${quando(depois.data)}: ${escapar(emPrato(depois.prato).nome)}</p>` : ""}
      </div>
    </div>`;
  };
  emLigarVotos(el, dias, totais, desenhar);
  desenhar();
  const r = await emTotais(semana);
  if (r) { totais[d.data] = r[d.data] || { up: 0, down: 0 }; desenhar(); }
}

(function () {
  const pagina = document.getElementById("ementa"), casa = document.getElementById("ementa-hoje");
  if (pagina) emPagina(pagina);
  if (casa) emInicio(casa);
})();
