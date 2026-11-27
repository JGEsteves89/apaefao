// Perdidos e achados (perdidos.html). Duas listas: "Encontrados" (procuram dono) e "Procuram-se" (alguém perdeu).
// Qualquer pai publica e responde; as respostas vão por email (Apps Script). Nome e email nunca aparecem no site.
// Teste com ?perdidos-teste na morada (dados inventados).
(function () {
  const $ = id => document.getElementById(id);
  const el = $("perdidos"), resumo = $("pa-resumo"), filtros = $("pa-filtros");
  const CONTACTO_LS = "apaef-perdidos-contacto";
  let lista = [], aba = "encontrei", filtro = "";

  // ---------- Lista ----------
  carregarDados("perdidos", el, paLista).then(d => { if (d) { lista = d.lista || []; desenhar(); } });

  function desenhar() {
    const deAba = lista.filter(o => o.pedido === aba);
    ["encontrei", "perdi"].forEach(a => { $("pa-n-" + a).textContent = "(" + lista.filter(o => o.pedido === a).length + ")"; });
    document.querySelectorAll(".pa-aba").forEach(b => b.setAttribute("aria-selected", b.dataset.aba === aba));
    const naEscola = deAba.filter(o => o.onde === "escola");
    const proxima = naEscola.map(o => o.sai_a).sort()[0];
    resumo.hidden = !(aba === "encontrei" && proxima);
    if (proxima) resumo.innerHTML = `<b>${naEscola.length} na escola</b> · os próximos saem para doação a <b>${paDia(proxima)}</b>`;
    const conta = {};
    deAba.forEach(o => { conta[o.tipo] = (conta[o.tipo] || 0) + 1; });
    const tipos = PERDIDOS_TIPOS.filter(t => conta[t]);
    if (filtro && !conta[filtro]) filtro = "";
    filtros.hidden = tipos.length < 2;
    filtros.innerHTML = [["", "Todos"]].concat(tipos.map(t => [t, paMaiuscula(PA_PLURAL[t] || t) + " (" + conta[t] + ")"]))
      .map(([v, txt]) => `<button type="button" class="pa-filtro" data-tipo="${escapar(v)}" aria-pressed="${v === filtro}">${escapar(txt)}</button>`).join("");
    const mostrar = deAba.filter(o => !filtro || o.tipo === filtro);
    if (!mostrar.length) {
      el.innerHTML = `<p class="vazio">${aba === "encontrei" ? "Não há nada encontrado por agora." : "Ninguém está à procura de nada por agora."}</p>`;
      return;
    }
    el.innerHTML = mostrar.map(o => {
      const perdi = o.pedido === "perdi";
      const etiqueta = perdi
        ? (o.na_escola ? '<span class="pa-etiqueta escola">A escola diz que está lá</span>' : `<span>Desde ${paCurto(o.data)}</span>`)
        : o.onde === "escola" ? `<span class="pa-etiqueta escola">Na escola · sai a ${paCurto(o.sai_a)}</span>` : '<span class="pa-etiqueta">Com quem encontrou</span>';
      return `
      <article class="pa-cartao${!perdi && o.onde === "escola" && o.sai_a === proxima ? " pa-sai" : ""}">
        ${paFotoHTML(o, 600, true)}
        <div class="pa-info">
          <b>${perdi ? "Procura-se: " : ""}${escapar(paNome(o))}</b>
          ${o.descricao ? `<span class="pa-desc">${escapar(o.descricao)}</span>` : ""}
          ${etiqueta}
          <button type="button" class="botao pa-responder" data-numero="${o.numero}">${perdi ? "Está aqui!" : "É meu!"}</button>
        </div>
      </article>`;
    }).join("");
  }

  document.querySelector(".pa-abas").addEventListener("click", e => {
    const b = e.target.closest(".pa-aba");
    if (b) { aba = b.dataset.aba; filtro = ""; desenhar(); }
  });
  filtros.addEventListener("click", e => {
    const b = e.target.closest(".pa-filtro");
    if (b) { filtro = b.dataset.tipo; desenhar(); }
  });

  // Lembra o nome e email neste telemóvel (só para não escrever outra vez).
  const contacto = () => { try { return JSON.parse(localStorage.getItem(CONTACTO_LS)) || {}; } catch (e) { return {}; } };
  const guardarContacto = (nome, email) => { try { localStorage.setItem(CONTACTO_LS, JSON.stringify({ nome, email })); } catch (e) { /* sem armazenamento */ } };

  // ---------- Publicar ----------
  const form = $("pa-form"), estado = $("pa-estado"), previa = $("pa-previa");
  let pedido = "encontrei", foto = "";
  paOpcoes($("pa-tipos"), "tipo", PERDIDOS_TIPOS);
  paOpcoes($("pa-cores"), "cor", PA_CORES);

  document.querySelectorAll("[data-novo]").forEach(b => b.addEventListener("click", () => {
    pedido = b.dataset.novo;
    const enc = pedido === "encontrei";
    $("pa-form-titulo").textContent = enc ? "Encontrei uma coisa" : "Perdi uma coisa";
    $("pa-foto-txt").textContent = foto ? "Trocar foto" : enc ? "Tirar foto" : "Pôr uma foto (opcional)";
    $("pa-onde-campo").hidden = !enc;
    $("pa-enviar").textContent = "Publicar";
    const c = contacto();
    if (c.nome && !$("pa-nome").value) $("pa-nome").value = c.nome;
    if (c.email && !$("pa-email").value) $("pa-email").value = c.email;
    form.hidden = false; estado.textContent = "";
    form.scrollIntoView({ behavior: MOVIMENTO ? "smooth" : "auto", block: "start" });
  }));

  $("pa-ficheiro").addEventListener("change", async e => {
    const f = e.target.files[0];
    if (!f) return;
    estado.textContent = "A preparar a foto…";
    try {
      const url = await paReduzir(f);
      foto = url.split(",")[1]; previa.src = url; previa.hidden = false;
      $("pa-foto-txt").textContent = "Trocar foto"; estado.textContent = "";
    } catch (err) { foto = ""; estado.textContent = "Não consegui abrir a foto. Tenta outra."; }
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const tipo = (form.querySelector("[name=tipo]:checked") || {}).value;
    const onde = (form.querySelector("[name=onde]:checked") || {}).value;
    const nome = $("pa-nome").value.trim(), email = $("pa-email").value.trim();
    const falta = pedido === "encontrei" && !foto ? "Falta a foto." : !tipo ? "Escolhe o que é."
      : pedido === "encontrei" && !onde ? "Diz onde está agora." : !nome || !email ? "Escreve o teu nome e email."
      : !$("pa-rgpd").checked ? paErro("rgpd") : "";
    if (falta) { estado.textContent = falta; return; }
    guardarContacto(nome, email);
    const botao = $("pa-enviar");
    botao.disabled = true; estado.textContent = "A publicar…";
    try {
      const r = await paPost({ evento: "perdido_novo", pedido, tipo, onde, nome, email, rgpd: true, foto,
        cor: (form.querySelector("[name=cor]:checked") || {}).value || "", descricao: $("pa-descricao").value.trim(),
        site_web: form.querySelector("[name=site_web]").value });
      if (!r.ok) { estado.textContent = paErro(r.erro); return; }
      estado.innerHTML = `Publicado! <b>#${r.numero}</b>. Enviámos-te um email com um link para tirares do site quando estiver resolvido.`;
      foto = ""; previa.hidden = true; previa.removeAttribute("src"); $("pa-ficheiro").value = "";
      $("pa-descricao").value = ""; form.querySelectorAll("[type=radio]").forEach(i => { i.checked = false; });
      aba = pedido; recarregar();
    } catch (err) { estado.textContent = paErro(); }
    finally { botao.disabled = false; }
  });

  async function recarregar() {
    try { const d = await paLista(); lista = d.lista || []; desenhar(); } catch (e) { /* fica a lista antiga */ }
  }

  // ---------- Responder: "É meu!" / "Está aqui!" ----------
  const dialogo = $("pa-dialogo"), resp = $("pa-resp"), rEstado = $("pa-r-estado");
  let atual = null;
  el.addEventListener("click", e => {
    const b = e.target.closest(".pa-responder");
    if (!b) return;
    atual = lista.find(o => o.numero === Number(b.dataset.numero));
    if (!atual) return;
    const perdi = atual.pedido === "perdi";
    $("pa-resp-titulo").textContent = perdi ? "Tens isto?" : "É teu?";
    $("pa-resp-texto").textContent = perdi
      ? `Vamos avisar quem perdeu "${paNome(atual)}" (#${atual.numero}). Recebem os dois um email para combinar.`
      : atual.onde === "escola" ? `"${paNome(atual)}" (#${atual.numero}) está na escola. Enviamos-te um email com o que fazer.`
      : `Vamos avisar quem encontrou "${paNome(atual)}" (#${atual.numero}). Recebem os dois um email para combinar.`;
    const c = contacto();
    $("pa-r-nome").value = c.nome || ""; $("pa-r-email").value = c.email || ""; $("pa-r-msg").value = "";
    $("pa-r-rgpd").checked = false; rEstado.textContent = ""; $("pa-r-enviar").disabled = false; $("pa-r-enviar").hidden = false;
    if (dialogo.showModal) dialogo.showModal(); else dialogo.setAttribute("open", "");
  });
  $("pa-r-fechar").addEventListener("click", () => dialogo.close ? dialogo.close() : dialogo.removeAttribute("open"));
  resp.addEventListener("submit", async e => {
    e.preventDefault();
    const nome = $("pa-r-nome").value.trim(), email = $("pa-r-email").value.trim();
    if (!nome || !email) { rEstado.textContent = "Escreve o teu nome e email."; return; }
    if (!$("pa-r-rgpd").checked) { rEstado.textContent = paErro("rgpd"); return; }
    guardarContacto(nome, email);
    const botao = $("pa-r-enviar");
    botao.disabled = true; rEstado.textContent = "A enviar…";
    try {
      const r = await paPost({ evento: "perdido_resposta", numero: atual.numero, nome, email, rgpd: true,
        mensagem: $("pa-r-msg").value.trim(), site_web: resp.querySelector("[name=site_web]").value });
      if (!r.ok) { rEstado.textContent = paErro(r.erro); botao.disabled = false; return; }
      rEstado.textContent = r.escola ? `Está na escola: pede-o pelo número #${atual.numero}. Enviámos-te um email.` : "Feito! Enviámos um email aos dois. Vê a tua caixa de correio.";
      botao.hidden = true;
    } catch (err) { rEstado.textContent = paErro(); botao.disabled = false; }
  });

  // ---------- Resolvido (link do email: #resolver=NUMERO-CODIGO) ----------
  const m = location.hash.match(/resolver=(\d+)-([A-Za-z0-9]+)/);
  if (m) {
    const caixa = $("pa-resolver");
    caixa.innerHTML = `<h3>O pedido #${m[1]} já está resolvido?</h3><p>Sai do site e ninguém mais te escreve sobre ele.</p><button class="botao" type="button" id="pa-resolvido">Sim, está resolvido</button> <span class="pn-estado" id="pa-resolver-estado" role="status"></span>`;
    caixa.hidden = false;
    $("pa-resolvido").addEventListener("click", async () => {
      $("pa-resolvido").disabled = true;
      const r = await paPost({ evento: "perdido_estado", numero: Number(m[1]), token: m[2] }).catch(() => ({}));
      if (!r.ok) { $("pa-resolver-estado").textContent = paErro(r.erro); $("pa-resolvido").disabled = false; return; }
      caixa.innerHTML = "<h3>Obrigado! Já saiu do site.</h3>";
      history.replaceState(null, "", location.pathname);
      recarregar();
    });
  }
})();
