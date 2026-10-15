// Votação das atividades 2026/27 — uma página com o ano todo.
// Cada data abre e fecha. Cada 👍 grava sozinho (máximo 3 por data).
(function () {
  const MAX = 3;
  const ESPERA_ENVIO = 1500;
  const CHAVE_ID = "apaef_voter_id";
  const CHAVE_RASCUNHO = "apaef_votacao_rascunho";   // o meu boletim atual
  const CHAVE_ENVIADO = "apaef_votacao_enviado";     // o último boletim que o servidor recebeu
  const CHAVE_TESTE = "apaef_votacao_teste";
  // Mudar este valor apaga em todos os telemóveis os votos e ideias guardados antes (recomeçar do zero).
  const RECOMECO = "2026-10-15-zero";
  const CHAVE_RECOMECO = "apaef_votacao_recomeco";
  const TURMAS = ["Pré A", "Pré B", "Pré C", "Pré D", "1.º ano", "2.º ano", "3.º ano", "4.º ano", "Prefiro não dizer"];
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  // Modo teste (números falsos + faixa de aviso) só no computador (localhost) e sem ENDPOINT.
  // No site publicado começa sempre a zero, sem números falsos.
  const TESTE = !ENDPOINT && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const lista = document.getElementById("lista");
  let datas = [], ativ = {}, res = null;
  let estado, enviado, naBase, voterId, temporizador = null, aEnviar = false;
  const abertas = new Set(), detalhes = new Set();
  let porTeclado = false;

  // localStorage pode falhar (modo privado, etc.) — a página funciona na mesma.
  function ler(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } }
  function gravar(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) { /* sem memória, segue */ } }
  function lerJSON(chave, vazio) { try { return Object.assign(vazio, JSON.parse(ler(chave) || "{}")); } catch (e) { return vazio; } }

  function novoId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  const fechado = () => new Date() >= VOTACAO_FECHA;
  const MAX_IDEIAS = 5;
  const votoDe = id => estado.votos[id] = estado.votos[id] || { atividades: [], ajudo: false, ideias: [] };
  const ideiasDe = id => (estado.votos[id] && estado.votos[id].ideias) || [];
  const meus = id => (estado.votos[id] && estado.votos[id].atividades) || [];
  // naBase = o meu boletim que já estava contado nos números que vieram do servidor.
  const enviadosDe = id => (naBase.votos && naBase.votos[id]) || [];

  function toast(texto) {
    const t = document.getElementById("toast");
    t.textContent = texto; t.classList.add("ver");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("ver"), 2200);
  }

  // Números no ecrã = servidor − o meu último envio + o meu boletim atual (otimista).
  function contagem(dataId, atId) {
    const base = (res && res.porData && res.porData[dataId] && res.porData[dataId][atId]) || 0;
    const tirar = enviadosDe(dataId).includes(atId) ? 1 : 0;
    const por = meus(dataId).includes(atId) ? 1 : 0;
    return Math.max(0, base - tirar + por);
  }

  // Opções de uma data = as do plano + as ideias dos pais (todos as podem votar).
  // As minhas ideias vêm do meu boletim; as dos outros vêm do servidor ("novas").
  function opcoesDe(d) {
    const ops = d.atividades.map(id => ativ[id]).filter(Boolean);
    const minhas = ideiasDe(d.id).map(i => ({ id: i.id, nome: i.texto, emoji: "💡", nova: true, minha: true, criadaEm: i.criadaEm }));
    const criadas = new Set(estado.criadas || []);   // as que eu criei (mesmo as que já apaguei)
    const outras = ((res && res.novas && res.novas[d.id]) || []).filter(i => i.id && !criadas.has(i.id))
      .map(i => ({ id: i.id, nome: i.texto, emoji: "💡", nova: true, minha: false, criadaEm: i.criadaEm }));
    return ops.concat(minhas, outras);
  }

  function opcoesOrdenadas(d) {
    return opcoesDe(d).map(a => ({ a, n: contagem(d.id, a.id) })).sort((x, y) => y.n - x.n);
  }

  // Notas: ícones curtos sempre visíveis (🎈 diversão · 💰 dinheiro · 🛠️ trabalho); o ⓘ explica em palavras.
  const DIVERSAO = ["Para os adultos", "Pouco divertido", "Divertido", "Muito divertido"];
  const DINHEIRO = ["Não dá dinheiro", "Dá pouco dinheiro", "Dá algum dinheiro", "Dá muito dinheiro"];
  const TRABALHO = ["", "Pouco trabalho", "Algum trabalho", "Muito trabalho"];
  // "Nova": ideia adicionada nos últimos 2 dias (teve menos tempo para receber votos).
  const recente = a => a.nova && a.criadaEm && Date.now() - Date.parse(a.criadaEm) < 2 * 24 * 3600 * 1000;
  const icones = (ic, n) => n > 0 ? ic.repeat(n) : `<span class="zero">${ic}</span>`;
  const notas = a => a.nova ? "💡 Ideia de um membro"
    : `<span aria-hidden="true">${icones("🎈", a.diversao || 0)} · ${icones("💰", a.dinheiro || 0)} · ${icones("🛠️", a.esforco || 1)}</span>`;
  const TIPO_LONGO = { angariacao: "💰 Serve para angariar dinheiro", ludica: "🎈 Só para diversão", ambas: "💰🎈 Diverte e angaria dinheiro" };
  const maiuscula = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
  const notasPalavras = a => [DIVERSAO[a.diversao || 0], DINHEIRO[a.dinheiro || 0], TRABALHO[a.esforco || 1]].join(" · ");

  function htmlDetalhe(a, d) {
    if (a.nova) {
      let apagar = "";
      if (a.minha && !fechado()) {
        apagar = detalhes.has("apagar|" + a.id)
          ? `<p class="confirmar"><b>Tens a certeza?</b>
               <button class="b-peq perigo" type="button" data-confirmar-apagar="${a.id}">Sim, apagar</button>
               <button class="b-peq" type="button" data-cancelar-apagar="${a.id}">Não</button></p>`
          : `<button class="b-peq" type="button" data-apagar="${a.id}">✕ Apagar a minha ideia</button>`;
      }
      return `<div class="o-detalhe"><p>💡 Ideia nova, sugerida por um membro.</p>${a.minha ? "<p>Esta ideia é tua. Só tu a podes apagar.</p>" : ""}${apagar}</div>`;
    }
    // Mais contexto: o que é, para que serve, e noutras datas onde também aparece.
    const outras = datas.filter(x => x.id !== d.id && x.atividades.includes(a.id)).map(x => x.nome);
    return `<div class="o-detalhe">
      <p>${escapar(maiuscula(a.texto))}.</p>
      <p class="o-palavras">${notasPalavras(a)}</p>
      <p>${TIPO_LONGO[a.tipo] || ""}</p>
      ${outras.length ? `<p>📅 Também proposta para: ${outras.map(escapar).join(", ")}.</p>` : ""}
      ${a.atencao ? `<p class="atencao">⚠️ ${escapar(a.atencao)}</p>` : ""}
    </div>`;
  }

  function temVotos(e) { return Object.values(e.votos || {}).some(v => v.atividades.length || (v.ideias || []).length); }

  function mostrarTotal() {
    let total = (res && res.total) || 0;
    if (temVotos(estado) && !naBase.enviadoEm) total += 1;   // eu ainda não contado pelo servidor
    document.getElementById("total").textContent = total === 1 ? "1 membro já votou" : `${total} membros já votaram`;
  }

  function topLinha(d) {
    const o = opcoesOrdenadas(d).find(x => x.n > 0);
    if (!o) return "Ainda sem votos";
    return `🥇 ${escapar(o.a.nome)} <b>${o.n}</b>`;
  }

  function htmlOpcoes(d) {
    const ops = opcoesOrdenadas(d);
    const max = Math.max(1, ...ops.map(o => o.n));
    const sel = meus(d.id);
    return '<ul class="opcoes">' + ops.map(({ a, n }) => {
      const chave = d.id + "|" + a.id, aberto = detalhes.has(chave);
      return `<li class="op">
        <button class="o-voto" type="button" data-voto="${a.id}" aria-pressed="${sel.includes(a.id)}" aria-label="Votar em ${escapar(a.nome)} (${n} votos)${a.nova ? "" : ". " + notasPalavras(a)}"${fechado() ? " disabled" : ""}>
          <span class="o-barra" style="width:${Math.round(n / max * 100)}%" aria-hidden="true"></span>
          <span class="o-polegar" aria-hidden="true">👍</span>
          <span class="o-emoji" aria-hidden="true">${a.emoji}</span>
          <span class="o-txt">${escapar(a.nome)}${recente(a) ? ' <span class="o-nova">Nova</span>' : ""}${a.minha ? ' <span class="o-tua">a tua ideia</span>' : ""}<small class="o-notas">${notas(a)}</small></span>
          <span class="o-n">${n}</span>
        </button>
        <button class="o-info" type="button" data-detalhe="${a.id}" aria-expanded="${aberto}" aria-label="Detalhes de ${escapar(a.nome)}">ⓘ</button>
      </li>${aberto ? `<li class="op-detalhe">${htmlDetalhe(a, d)}</li>` : ""}`;
    }).join("") + "</ul>";
  }

  function htmlDentro(d) {
    const ideias = ideiasDe(d.id);
    const mostrarCampo = detalhes.has(d.id + "|ideia") && ideias.length < MAX_IDEIAS;
    return `<div class="d-dentro">
      <p class="d-nota">${quandoCurto(d) !== d.quando ? escapar(d.quando) + " · " : ""}Podes votar em até 3.</p>
      <div class="d-opcoes">${htmlOpcoes(d)}</div>
      ${mostrarCampo ? `<form class="nova-ideia" data-form-ideia="${d.id}">
        <input class="campo-ideia" type="text" maxlength="200" enterkeyhint="done" placeholder="A minha ideia para esta data" aria-label="Outra ideia para ${escapar(d.nome)}">
        <button class="botao" type="submit">Adicionar</button>
      </form>` : ""}
      ${mostrarCampo || ideias.length >= MAX_IDEIAS || fechado() ? "" : `<button class="link-ideia" type="button" data-abrir-ideia="${d.id}">${ideias.length ? "+ Mais uma ideia" : "+ Outra ideia"}</button>`}
    </div>`;
  }

  function htmlData(d) {
    const aberta = abertas.has(d.id);
    return `<div class="data-item" id="${d.id}">
      <button class="d-linha" type="button" aria-expanded="${aberta}" aria-controls="p-${d.id}" data-abrir="${d.id}">
        <span class="d-titulo">${d.emoji} ${escapar(d.nome)}${d.anoPassado ? '<span class="ponto-plano" title="Já fizemos no ano passado" aria-label="Já fizemos no ano passado"></span>' : ""}</span>
        <span class="d-quando">${escapar(quandoCurto(d))}</span>
        <span class="d-top">${topLinha(d)}</span>
        <span class="d-lado">${meus(d.id).length ? '<span class="d-meu">✓ votaste</span>' : ""}<span class="d-seta" aria-hidden="true">⌄</span></span>
      </button>
      <div class="d-painel${aberta ? " aberto" : ""}" id="p-${d.id}"${aberta ? "" : " inert"}><div>${aberta ? htmlDentro(d) : ""}</div></div>
    </div>`;
  }

  const quandoCurto = d => d.quando.replace(/\s*\(.*\)\s*$/, "");

  function mesDe(d) { return d.data ? MESES[+d.data.slice(5, 7) - 1] : "Em qualquer altura"; }

  function render() {
    let html = "", mes = null;
    datas.forEach(d => {
      const m = mesDe(d);
      if (m !== mes) {
        if (mes !== null) html += "</div>";
        html += mes === null
          ? `<div class="mes-linha"><h2 class="mes">${m}</h2><button class="fechar-todas" type="button" data-fechar-todas="1">Fechar todas</button></div><div class="datas">`
          : `<h2 class="mes">${m}</h2><div class="datas">`;
        mes = m;
      }
      html += htmlData(d);
    });
    lista.innerHTML = html + (mes !== null ? "</div>" : "");
    mostrarTotal();
  }

  // Volta a desenhar só uma data (mantém o foco no botão tocado).
  function redesenhar(id, focar) {
    const d = datas.find(x => x.id === id), el = document.getElementById(id);
    if (!d || !el) return;
    el.outerHTML = htmlData(d);
    if (focar && porTeclado) { const f = document.getElementById(id).querySelector(focar); if (f) f.focus({ preventScroll: true }); }
    mostrarTotal();
  }

  function abrirFechar(id) {
    const abrir = !abertas.has(id);
    if (abrir) abertas.add(id); else abertas.delete(id);
    const el = document.getElementById(id), painel = el.querySelector(".d-painel");
    const d = datas.find(x => x.id === id);
    el.querySelector(".d-linha").setAttribute("aria-expanded", abrir);
    if (abrir) { painel.firstElementChild.innerHTML = htmlDentro(d); painel.removeAttribute("inert"); requestAnimationFrame(() => painel.classList.add("aberto")); }
    else { painel.classList.remove("aberto"); painel.setAttribute("inert", ""); }
    // Guardar no endereço a data aberta (para partilhar o link de uma data).
    try { history.replaceState(null, "", abrir ? "#" + id : location.pathname + location.search); } catch (e) { /* ignora */ }
  }

  function votar(dataId, atId) {
    if (fechado()) return;
    const v = votoDe(dataId), pos = v.atividades.indexOf(atId);
    if (pos >= 0) v.atividades.splice(pos, 1);
    else if (v.atividades.length >= MAX) { toast("Máximo 3 — tira um primeiro"); return; }
    else v.atividades.push(atId);
    guardar();
    redesenhar(dataId, `[data-voto="${atId}"]`);
  }

  function guardar() {
    estado.pendente = true;
    gravar(CHAVE_RASCUNHO, JSON.stringify(estado));
    mostrarEnvio("");
    clearTimeout(temporizador);
    temporizador = setTimeout(enviar, ESPERA_ENVIO);
  }

  function mostrarEnvio(t, falhou) {
    const e = document.getElementById("envio");
    e.textContent = t; e.classList.toggle("falhou", !!falhou);
  }

  function payload() {
    const votos = [], ideias = [];
    datas.forEach(d => {
      const v = estado.votos[d.id]; if (!v) return;
      if (v.atividades.length) votos.push({ data: d.id, atividades: v.atividades.slice(0, MAX), ajudo: false });
      (v.ideias || []).forEach(i => ideias.push({ data: d.id, id: i.id, texto: i.texto.slice(0, 200), criadaEm: i.criadaEm }));
    });
    return { evento: "votacao", voterId, nome: estado.nome || "", turma: estado.turma || "", votos, ideias, comentario: "", versao: "2026-10-15" };
  }

  // Envia o boletim completo; o servidor substitui o anterior deste voterId.
  async function enviar() {
    if (aEnviar) { clearTimeout(temporizador); temporizador = setTimeout(enviar, ESPERA_ENVIO); return; }
    if (fechado()) { mostrarEnvio(""); return; }
    aEnviar = true;
    const dados = payload();
    try {
      if (ENDPOINT) {
        // text/plain evita o pedido prévio de CORS do Apps Script.
        const r = await fetch(ENDPOINT, { method: "POST", body: JSON.stringify(dados) });
        const resp = await r.json();
        if (resp.fechado) { aEnviar = false; mostrarEnvio("Votação fechada", true); return; }
        if (!resp.ok) throw new Error("resposta");
      } else {
        const todos = lerJSON(CHAVE_TESTE, {}); todos[voterId] = dados; gravar(CHAVE_TESTE, JSON.stringify(todos));
      }
      // Lembrar o que o servidor já conta: na próxima visita os números não contam o meu voto duas vezes.
      const porData = {};
      dados.votos.forEach(v => { porData[v.data] = v.atividades; });
      enviado = { enviadoEm: new Date().toISOString(), votos: porData };
      gravar(CHAVE_ENVIADO, JSON.stringify(enviado));
      estado.pendente = false; gravar(CHAVE_RASCUNHO, JSON.stringify(estado));
      mostrarEnvio("✓ guardado");
      setTimeout(() => { if (!estado.pendente) mostrarEnvio(""); }, 2000);
    } catch (e) {
      mostrarEnvio("⟳ por enviar", true);
    }
    aEnviar = false;
  }

  // Modo teste (sem ENDPOINT): números falsos, sempre iguais, só para ver o aspeto.
  function resultadosFalsos() {
    const r = { total: 23, porData: {}, ajudo: {}, ideias: [] };
    datas.forEach((d, i) => {
      r.porData[d.id] = {};
      d.atividades.forEach((a, j) => { r.porData[d.id][a] = (i * 7 + j * 5 + 3) % 13; });
    });
    return r;
  }

  async function carregarResultados() {
    if (!ENDPOINT) { res = TESTE ? resultadosFalsos() : { total: 0, porData: {}, ajudo: {}, novas: {} }; return; }
    try {
      const r = await fetch(ENDPOINT + "?acao=resultados&t=" + Date.now());
      res = await r.json();
      // Votos meus em ideias que o autor já apagou: tira-os, para não ocuparem lugar nos 3.
      let mudou = false;
      datas.forEach(d => {
        const v = estado.votos[d.id]; if (!v) return;
        const existem = new Set(opcoesDe(d).map(a => a.id));
        const antes = v.atividades.length;
        v.atividades = v.atividades.filter(a => existem.has(a));
        if (v.atividades.length !== antes) mudou = true;
      });
      if (mudou) guardar();
    } catch (e) {
      res = { total: 0, porData: {}, ajudo: {} };
      mostrarEnvio("Sem ligação — os números podem estar desatualizados", true);
    }
  }

  // Eventos (um só ouvinte para a lista toda).
  lista.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    porTeclado = e.detail === 0;
    const item = b.closest(".data-item"); const id = item && item.id;
    if (b.dataset.abrir) return abrirFechar(b.dataset.abrir);
    if (b.dataset.voto) return votar(id, b.dataset.voto);
    if (b.dataset.detalhe) {
      const k = id + "|" + b.dataset.detalhe;
      if (detalhes.has(k)) detalhes.delete(k); else detalhes.add(k);
      return redesenhar(id, `[data-detalhe="${b.dataset.detalhe}"]`);
    }
    if (b.dataset.abrirIdeia) { detalhes.add(id + "|ideia"); redesenhar(id, ".campo-ideia"); }
    if (b.dataset.fecharTodas) {
      abertas.clear(); render();
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignora */ }
      return;
    }
    if (b.dataset.apagar) { detalhes.add("apagar|" + b.dataset.apagar); return redesenhar(id, "[data-confirmar-apagar]"); }
    if (b.dataset.cancelarApagar) { detalhes.delete("apagar|" + b.dataset.cancelarApagar); return redesenhar(id, `[data-apagar="${b.dataset.cancelarApagar}"]`); }
    if (b.dataset.confirmarApagar) {
      // Apagar a minha ideia: sai do meu boletim e os votos nela deixam de contar.
      const v = votoDe(id), ideiaId = b.dataset.confirmarApagar;
      v.ideias = v.ideias.filter(i => i.id !== ideiaId);
      v.atividades = v.atividades.filter(a => a !== ideiaId);
      guardar(); redesenhar(id, "[data-abrir-ideia]");
      toast("Ideia apagada");
    }
  });
  // Adicionar uma ideia: botão "Adicionar" ou Enter.
  lista.addEventListener("submit", e => {
    const form = e.target.closest("[data-form-ideia]"); if (!form) return;
    e.preventDefault();
    const id = form.dataset.formIdeia, texto = form.querySelector("input").value.trim().slice(0, 200);
    if (!texto) { form.querySelector("input").focus(); return; }
    const v = votoDe(id);
    if (v.ideias.length >= MAX_IDEIAS) { toast("Máximo 5 ideias por data"); return; }
    const ideiaId = "i-" + novoId();
    v.ideias.push({ id: ideiaId, texto, criadaEm: new Date().toISOString() });
    estado.criadas = (estado.criadas || []).concat(ideiaId);
    detalhes.delete(id + "|ideia");
    guardar(); redesenhar(id, "[data-abrir-ideia]");
    toast("Ideia adicionada 💡");
  });


  async function iniciar() {
    if (ler(CHAVE_RECOMECO) !== RECOMECO) {
      try { [CHAVE_RASCUNHO, CHAVE_ENVIADO, CHAVE_TESTE].forEach(k => localStorage.removeItem(k)); } catch (e) { /* ignora */ }
      gravar(CHAVE_RECOMECO, RECOMECO);
    }
    voterId = ler(CHAVE_ID);
    if (!voterId) { voterId = novoId(); gravar(CHAVE_ID, voterId); }
    estado = lerJSON(CHAVE_RASCUNHO, { nome: "", turma: "", votos: {} });
    if (!estado.votos) estado.votos = {};
    // Rascunhos antigos: ideia em texto ("ideia") ou lista de textos; passa para [{ id, texto }].
    if (!Array.isArray(estado.criadas)) estado.criadas = [];
    Object.values(estado.votos).forEach(v => {
      if (!Array.isArray(v.ideias)) v.ideias = v.ideia && v.ideia.trim() ? [v.ideia.trim()] : [];
      delete v.ideia;
      v.ideias = v.ideias.map(i => typeof i === "string" ? { id: "i-" + novoId(), texto: i } : i);
      v.ideias.forEach(i => { if (!i.criadaEm) i.criadaEm = new Date().toISOString(); });
      v.ideias.forEach(i => { if (!estado.criadas.includes(i.id)) estado.criadas.push(i.id); });
    });
    enviado = lerJSON(CHAVE_ENVIADO, { enviadoEm: null, votos: {} });
    if (TESTE) document.getElementById("faixa-teste").hidden = false;
    if (fechado()) document.getElementById("fechada").hidden = false;

    const nome = document.getElementById("nome"), turma = document.getElementById("turma");
    turma.insertAdjacentHTML("beforeend", TURMAS.map(t => `<option>${t}</option>`).join(""));
    nome.value = estado.nome || ""; turma.value = estado.turma || "";
    const quem = () => { estado.nome = nome.value.trim(); estado.turma = turma.value; if (temVotos(estado)) guardar(); else gravar(CHAVE_RASCUNHO, JSON.stringify(estado)); };
    nome.addEventListener("change", quem); turma.addEventListener("change", quem);

    try {
      const r = await fetch("data/atividades.json", { cache: "no-cache" });
      const dados = await r.json();
      datas = ordenarDatas(dados.datas);
      dados.atividades.forEach(a => { ativ[a.id] = a; });
    } catch (e) {
      lista.innerHTML = "<p>Não foi possível carregar as atividades. Tenta outra vez daqui a pouco.</p>"; return;
    }
    Object.values(estado.votos).forEach(v => { v.atividades = (v.atividades || []).filter(a => ativ[a] || a.startsWith("i-")); });
    await carregarResultados();
    // Em modo teste os números são falsos e nunca incluem o meu voto.
    naBase = ENDPOINT ? enviado : { enviadoEm: null, votos: {} };

    const alvo = decodeURIComponent(location.hash.slice(1));
    if (alvo && datas.some(d => d.id === alvo)) abertas.add(alvo);
    render();
    if (alvo && abertas.has(alvo)) document.getElementById(alvo).scrollIntoView({ block: "start" });

    // Se ficou algo por enviar da última vez, tenta outra vez.
    if (estado.pendente && !fechado()) enviar();
  }

  iniciar();
})();
