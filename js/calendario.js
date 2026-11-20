// Página calendario.html: vista do mês (abre no mês atual) e vista do ano (10 meses pequenos com a lista).
// Os dados vêm da Sheet (?acao=site → calendario + agenda), através de js/calendario-dados.js.
// Teste com outra data: ?hoje=2026-11-18

(async function () {
  const el = document.getElementById("cal");
  if (!el) return;
  const dados = await carregarDados("calendario", el, () => dadosSite());
  if (!dados) return;
  let cal = calendarioDe(dados);
  if (!cal) return semDados(el);

  const p = new URLSearchParams(location.search).get("hoje");
  const HOJE = /^\d{4}-\d{2}-\d{2}$/.test(p || "") ? diaDe(p) : diaDe(hojeISO());
  const HOJE_S = calIso(HOJE);
  const e_ = escapar;
  const maiuscula = t => t[0].toUpperCase() + t.slice(1);
  const nomeDia = d => `${CAL_DIAS[d.getDay()]}, ${d.getDate()} de ${CAL_MESES[d.getMonth()]}`;
  const semEscola = t => t === "ferias" || t === "feriado" || t === "verao";

  // Meses do ano letivo: do mês do 1.º dia de aulas até ao mês a seguir ao último (ex.: set 2026 – jul 2027).
  let INICIO, FIM, MES_MIN, MES_MAX, anoLetivo, feriados;
  function limitesAno() {
    INICIO = diaDe(cal.primeiro); FIM = diaDe(cal.ultimo);
    MES_MIN = new Date(INICIO.getFullYear(), INICIO.getMonth(), 1);
    MES_MAX = new Date(FIM.getFullYear(), FIM.getMonth() + 1, 1);
    anoLetivo = `${INICIO.getFullYear()}/${String(FIM.getFullYear()).slice(2)}`;
    feriados = cal.feriados;
  }
  limitesAno();

  let comeco = new Date(HOJE.getFullYear(), HOJE.getMonth(), 1);
  if (comeco < MES_MIN) comeco = MES_MIN;
  if (comeco > MES_MAX) comeco = MES_MAX;
  const st = { vista: "mes", y: comeco.getFullYear(), m: comeco.getMonth(), sel: HOJE_S };

  function tagHTML(e) {
    if (e.tipo === "semaulas") return `<span class="tag semaulas">Sem escola</span>`;
    return `<span class="tag ${e.tipo}">${e.tipo === "apaef" ? "APAEF" : "Escola"}</span>${e.conf ? `<span class="tag conf">a confirmar</span>` : ""}`;
  }

  function legendaHTML() {
    return `<div class="legenda">
      <span class="lg"><i class="aulas"></i>Há escola</span>
      <span class="lg"><i class="ferias">🏠</i>Férias</span>
      <span class="lg"><i class="feriado">🏠</i>Feriado</span>
      <span class="lg"><i class="fds"></i>Fim de semana</span>
      <span class="lg"><i class="hj"></i>Hoje</span>
      <span class="chip apaef"><b>APAEF</b></span>
      <span class="chip escola"><b>Escola</b></span>
      <span class="chip escola conf"><b>A confirmar</b></span>
    </div>`;
  }

  // ---------- Mês ----------
  function htmlMes() {
    const first = new Date(st.y, st.m, 1);
    const lead = (first.getDay() + 6) % 7, n = new Date(st.y, st.m + 1, 0).getDate();
    let cel = CAL_DIAS3.slice(1).concat(CAL_DIAS3[0]).map(x => `<div class="sem" aria-hidden="true">${x}</div>`).join("");
    for (let i = 0; i < lead; i++) cel += `<div class="c vazio"></div>`;
    for (let d = 1; d <= n; d++) {
      const dt = new Date(st.y, st.m, d), s = calIso(dt), t = cal.tipoDia(dt), ev = cal.eventosDia(s);
      const hoje = s === HOJE_S, passou = s < HOJE_S;
      let etq = "";
      if (t === "feriado") etq = `<span class="tag-dia">Feriado · ${e_(feriados[s])}</span>`;
      else if (t === "ferias") { const f = cal.feriasDe(s); if (s === f.ini || dt.getDay() === 1 || d === 1) etq = `<span class="tag-dia">${e_(f.nome)}</span>`; }
      else if (t === "verao" && (dt.getDay() === 1 || d === 1)) etq = `<span class="tag-dia">Férias de verão</span>`;
      const chips = ev.map(e => `<span class="chip ${e.tipo}${e.conf ? " conf" : ""}" title="${e_(e.nome)}"><i>${e_(e.e)}</i><b>${e_(e.curto || e.nome)}</b></span>`).join("");
      const casa = semEscola(t) ? `<span class="casa" aria-hidden="true">🏠</span>` : "";
      const ap = ev.some(e => e.tipo === "apaef");
      cel += `<button type="button" class="c ${t}${ap ? " tem-apaef" : ""}${hoje ? " hoje" : ""}${passou ? " passou" : ""}${s === st.sel ? " sel" : ""}" data-d="${s}" aria-label="${nomeDia(dt)}${ev.length ? ": " + e_(ev.map(e => e.nome).join(", ")) : ""}" aria-pressed="${s === st.sel}">
        <span class="n">${d}</span>${hoje ? `<span class="hoje-fita">HOJE</span>` : casa}${etq}<span class="chips">${chips}</span></button>`;
    }

    let painel = "";
    if (st.sel && diaDe(st.sel).getMonth() === st.m && diaDe(st.sel).getFullYear() === st.y) {
      const sd = diaDe(st.sel), es = cal.estadoDia(sd), ev = cal.eventosDia(st.sel);
      painel = `<div class="dia-painel" aria-live="polite"><h4>${nomeDia(sd)}${st.sel === HOJE_S ? " · hoje" : ""}</h4>
        <span class="estado${es.casa ? " casa" : ""}">${e_(es.txt)}</span>
        ${ev.length ? `<ul>${ev.map(e => `<li class="${e.tipo}"><span class="em">${e_(e.e)}</span><div><b>${e_(e.nome)}</b> ${tagHTML(e)}${e.txt ? `<br><span class="txt">${e_(e.txt)}</span>` : ""}</div></li>`).join("")}</ul>` : `<p class="nada">Nada de especial neste dia.</p>`}
      </div>`;
    }

    // Lista do mês: atividades + férias que começam neste mês + feriados em dias de semana (fora das férias)
    const ini = calIso(first), fim = calIso(new Date(st.y, st.m, n));
    const lista = cal.eventos.filter(e => e.d <= fim && (e.fim || e.d) >= ini);
    const semAulas = [];
    cal.ferias.forEach(f => { if (f.ini >= ini && f.ini <= fim) semAulas.push({ d: f.ini, fim: f.fim, e: f.emoji, nome: f.nome, tipo: "semaulas", txt: `Não há escola até ${diaDe(f.fim).getDate()} de ${CAL_MESES[diaDe(f.fim).getMonth()]}.` }); });
    Object.entries(feriados).forEach(([s, nm]) => { const w = diaDe(s).getDay(); if (s >= ini && s <= fim && w > 0 && w < 6 && !cal.feriasDe(s)) semAulas.push({ d: s, e: "🏠", nome: "Feriado — " + nm, tipo: "semaulas", txt: "Não há escola." }); });
    const tudo = lista.concat(semAulas).sort((a, b) => a.d.localeCompare(b.d));
    const semDia = cal.semDia.filter(x => x.mes === `${st.y}-${calPad(st.m + 1)}`);
    let prox = false;
    const itens = tudo.map(e => {
      const dd = diaDe(e.d), passou = (e.fim || e.d) < HOJE_S;
      let cls = passou ? " passou" : "";
      if (!passou && !prox && e.tipo === "apaef") { cls = " proxima"; prox = true; }   // a próxima atividade da APAEF
      const ate = e.fim ? `até ${diaDe(e.fim).getDate()} ${CAL_MESES3[diaDe(e.fim).getMonth()]} · ` : "";
      return `<li class="item ${e.tipo}${cls}"><div class="folha" aria-hidden="true"><div class="m">${CAL_MESES3[dd.getMonth()]}</div><div class="d">${dd.getDate()}</div><div class="w">${CAL_DIAS3[dd.getDay()]}</div></div>
        <span class="em" aria-hidden="true">${e_(e.e)}</span><div><h5>${e_(e.nome)}</h5><p>${tagHTML(e)}${ate}${e_(e.txt)}</p></div></li>`;
    }).concat(semDia.map(e => `<li class="item ${e.tipo}"><div class="folha sem-data" aria-hidden="true"><div class="m">${CAL_MESES3[st.m]}</div><div class="d">?</div><div class="w">dia</div></div>
        <span class="em" aria-hidden="true">${e_(e.e)}</span><div><h5>${e_(e.nome)}</h5><p>${tagHTML(e)}<span class="tag conf">dia a definir</span> ${e_(e.txt)}</p></div></li>`)).join("");

    const atual = new Date(st.y, st.m, 1);
    return `
    <div class="mes-topo">
      <button type="button" class="seta" data-nav="-1" aria-label="Mês anterior"${atual <= MES_MIN ? " disabled" : ""}>‹</button>
      <h2>${maiuscula(CAL_MESES[st.m])} <small>${st.y}</small></h2>
      <button type="button" class="seta" data-nav="1" aria-label="Mês seguinte"${atual >= MES_MAX ? " disabled" : ""}>›</button>
      <button type="button" class="btn-hoje" data-nav="0">Hoje</button>
    </div>
    <div class="grelha">${cel}</div>
    ${painel}
    ${legendaHTML()}
    <h3 class="lista-titulo">Em ${CAL_MESES[st.m]}</h3>
    <ul class="lista">${itens || `<li class="item"><div>Sem atividades este mês.</div></li>`}</ul>`;
  }

  // ---------- Ano ----------
  function listaMes(y, m) {
    const ini = `${y}-${calPad(m + 1)}-01`, fim = calIso(new Date(y, m + 1, 0));
    const it = [];
    cal.eventos.filter(e => e.d >= ini && e.d <= fim).forEach(e => it.push({ d: e.d, e: e.e, nome: e.curto || e.nome, conf: e.conf, apaef: e.tipo === "apaef" }));
    cal.ferias.filter(f => f.ini >= ini && f.ini <= fim).forEach(f => it.push({ d: f.ini, e: "🏠", nome: `${f.nome} até ${diaDe(f.fim).getDate()} ${CAL_MESES3[diaDe(f.fim).getMonth()]}`, casa: true }));
    Object.entries(feriados).forEach(([s]) => { const w = diaDe(s).getDay(); if (s >= ini && s <= fim && w > 0 && w < 6 && !cal.feriasDe(s)) it.push({ d: s, e: "🏠", nome: "Feriado", casa: true }); });
    it.sort((a, b) => a.d.localeCompare(b.d));
    const semDia = cal.semDia.filter(x => x.mes === `${y}-${calPad(m + 1)}`).map(x => `<li class="conf${x.tipo === "apaef" ? " apaef" : ""}"><b>?</b><span>${e_(x.e)}</span><span>${e_(x.curto || x.nome)}</span></li>`);
    return it.map(x => `<li class="${x.casa ? "casa" : ""}${x.apaef ? " apaef" : ""}${x.conf ? " conf" : ""}${x.d < HOJE_S ? " passou" : ""}"><b>${diaDe(x.d).getDate()}</b><span>${e_(x.e)}</span><span>${e_(x.nome)}</span></li>`).concat(semDia).join("");
  }

  function htmlAno() {
    let meses = "";
    // setembro a junho (os meses com aulas)
    for (let k = 0, d0 = MES_MIN; d0 <= new Date(FIM.getFullYear(), FIM.getMonth(), 1); k++, d0 = new Date(MES_MIN.getFullYear(), MES_MIN.getMonth() + k, 1)) {
      const y = d0.getFullYear(), m = d0.getMonth();
      const first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
      let g = "";
      for (let i = 0; i < lead; i++) g += `<span class="v"></span>`;
      const emojis = [];
      for (let d = 1; d <= n; d++) {
        const dt = new Date(y, m, d), s = calIso(dt), t = cal.tipoDia(dt), ev = cal.eventosDia(s);
        ev.forEach(e => { if (!emojis.includes(e.e) && e.e !== "🎒" && e.e !== "☀️") emojis.push(e.e); });
        const ap = ev.some(e => e.tipo === "apaef");
        g += `<span class="${t}${ev.length ? " ev" : ""}${ap ? " apaef" : ""}${s === HOJE_S ? " hj" : ""}${s < HOJE_S ? " passou" : ""}">${d}</span>`;
      }
      const nAulas = cal.diasEscola(calIso(first), calIso(new Date(y, m, n)));
      const atual = y === HOJE.getFullYear() && m === HOJE.getMonth();
      meses += `<button type="button" class="mini${atual ? " atual" : ""}" data-ir="${y}-${m}" aria-label="Ver ${CAL_MESES[m]} de ${y}">
        <h3>${maiuscula(CAL_MESES[m])} <em aria-hidden="true">${e_(emojis.slice(0, 3).join(""))}</em></h3>
        <div class="mg" aria-hidden="true">${["S", "T", "Q", "Q", "S", "S", "D"].map(x => `<span class="v l">${x}</span>`).join("")}${g}</div>
        <div class="resumo">${nAulas} dias de escola</div>
        <ul class="mini-lista">${listaMes(y, m)}</ul></button>`;
    }
    return `<div class="meses">${meses}</div>${legendaHTML()}`;
  }

  function desenhar() {
    el.innerHTML = `
      <h1 class="titulo-pagina cal-titulo">Calendário do ano</h1>
      <p class="intro cal-sub">Ano letivo ${anoLetivo} · EB de Fão</p>
      <div class="tabs" role="tablist" aria-label="Vista">
        <button type="button" role="tab" data-vista="mes" aria-selected="${st.vista === "mes"}">📅 Mês</button>
        <button type="button" role="tab" data-vista="ano" aria-selected="${st.vista === "ano"}">🗓️ Ano todo</button>
      </div>
      ${st.vista === "mes" ? htmlMes() : htmlAno()}`;
  }

  el.addEventListener("click", ev => {
    const b = ev.target.closest("button");
    if (!b || b.disabled) return;
    let foco = null;
    if (b.dataset.vista) { st.vista = b.dataset.vista; foco = `[data-vista="${st.vista}"]`; }
    else if (b.dataset.nav !== undefined) {
      const k = Number(b.dataset.nav);
      if (k === 0) { st.y = HOJE.getFullYear(); st.m = HOJE.getMonth(); st.sel = HOJE_S; }
      else {
        const d = new Date(st.y, st.m + k, 1);
        if (d >= MES_MIN && d <= MES_MAX) { st.y = d.getFullYear(); st.m = d.getMonth(); }
      }
      foco = `[data-nav="${k}"]`;
    }
    else if (b.dataset.d) { st.sel = b.dataset.d; foco = `[data-d="${st.sel}"]`; }
    else if (b.dataset.ir) { const [y, m] = b.dataset.ir.split("-").map(Number); st.y = y; st.m = m; st.vista = "mes"; }
    else return;
    desenhar();
    if (foco) { const f = el.querySelector(foco); if (f && !f.disabled) f.focus({ preventScroll: true }); }
    if (b.dataset.ir) el.scrollIntoView({ behavior: MOVIMENTO ? "smooth" : "auto" });
  });
  desenhar();

  // Dados novos (datas da escola ou agenda): redesenha no mesmo mês, dia e vista, sem animação.
  aoMudar(["calendario", "agenda"], d => {
    const novo = calendarioDe(d);
    if (!novo) return;
    cal = novo; limitesAno();
    const foco = document.activeElement && el.contains(document.activeElement) ? document.activeElement : null;
    const sel = foco && (foco.dataset.d ? `[data-d="${foco.dataset.d}"]` : foco.dataset.nav !== undefined ? `[data-nav="${foco.dataset.nav}"]` : foco.dataset.vista ? `[data-vista="${foco.dataset.vista}"]` : null);
    semAnimar(el, desenhar);
    if (sel) { const f = el.querySelector(sel); if (f) f.focus({ preventScroll: true }); }
  });
})();
