// Perdidos: escola (perdidos-novo.html). Página interna para a escola: ver o que os pais procuram ("Está na escola"),
// pôr objetos encontrados na escola e marcar o que já saiu da caixa.
// A chave vem no link (#chave=…) e fica guardada neste telemóvel. Sem chave, o Apps Script recusa.
(function () {
  const $ = id => document.getElementById(id);
  const CHAVE_LS = "apaef-perdidos-chave";
  const ler = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const daMorada = (location.hash.match(/chave=([A-Za-z0-9]+)/) || [])[1];
  if (daMorada) { try { localStorage.setItem(CHAVE_LS, daMorada); } catch (e) { /* sem armazenamento */ } history.replaceState(null, "", location.pathname); }
  const chave = daMorada || ler(CHAVE_LS);
  if (!chave) { $("pn-sem-chave").hidden = false; return; }
  $("pn-tudo").hidden = false;
  const post = d => paPost(Object.assign({ chave }, d));

  // Separadores
  document.querySelector(".pa-abas").addEventListener("click", e => {
    const b = e.target.closest(".pa-aba");
    if (!b) return;
    document.querySelectorAll(".pa-aba").forEach(x => x.setAttribute("aria-selected", x === b));
    document.querySelectorAll(".pn-sec").forEach(s => { s.hidden = s.id !== b.dataset.sec; });
  });

  // ---------- Listas ----------
  const pedidos = $("pn-pedidos"), caixa = $("pn-lista");
  async function carregar() {
    let d;
    try { d = MODO_TESTE ? { lista: [] } : await paLista(); } catch (e) { return; }
    const lista = d.lista || [];
    const pp = lista.filter(o => o.pedido === "perdi"), cx = lista.filter(o => o.pedido === "encontrei" && o.onde === "escola");
    $("pn-n-pedidos").textContent = "(" + pp.length + ")"; $("pn-n-caixa").textContent = "(" + cx.length + ")";
    pedidos.innerHTML = pp.length ? pp.map(o => `
      <article class="pa-cartao" data-numero="${o.numero}">
        ${paFotoHTML(o, 400)}
        <div class="pa-info"><b>${escapar(paNome(o))}</b>
          ${o.descricao ? `<span class="pa-desc">${escapar(o.descricao)}</span>` : ""}
          <span>Desde ${paCurto(o.data)}</span>
          ${o.na_escola ? '<span class="pa-etiqueta escola">Pai já avisado</span>'
            : '<button type="button" class="botao pn-acao" data-acao="escola">Está na escola</button>'}
        </div>
      </article>`).join("") : '<p class="vazio">Nenhum pai está à procura de nada.</p>';
    caixa.innerHTML = cx.length ? cx.map(o => `
      <article class="pa-cartao" data-numero="${o.numero}">
        ${paFotoHTML(o, 400)}
        <div class="pa-info"><b>${escapar(paNome(o))}</b><span>Sai a ${paCurto(o.sai_a)}</span>
          <button type="button" class="botao pn-acao" data-acao="entregue">Já não está</button></div>
      </article>`).join("") : '<p class="vazio">A caixa está vazia.</p>';
  }

  // Botões das listas: dois toques para confirmar.
  document.addEventListener("click", async e => {
    const b = e.target.closest(".pn-acao");
    if (!b) return;
    if (!b.dataset.confirmar) { b.dataset.confirmar = "1"; b.textContent = "Tocar outra vez para confirmar"; return; }
    b.disabled = true;
    const numero = Number(b.closest(".pa-cartao").dataset.numero);
    const r = await (b.dataset.acao === "escola" ? post({ evento: "perdido_escola", numero }) : post({ evento: "perdido_estado", numero, estado: "entregue" })).catch(() => ({}));
    if (!r.ok) { b.textContent = paErro(r.erro); b.disabled = false; delete b.dataset.confirmar; return; }
    b.outerHTML = b.dataset.acao === "escola" ? '<span class="pa-etiqueta escola">Pai avisado</span>' : '<span class="pa-etiqueta">Saiu da caixa</span>';
  });

  // ---------- Pôr objeto encontrado na escola ----------
  const form = $("pn-form"), estado = $("pn-estado"), previa = $("pn-previa");
  let foto = "", ultimo = 0;
  paOpcoes($("pn-tipos"), "tipo", PERDIDOS_TIPOS);
  paOpcoes($("pn-cores"), "cor", PA_CORES);

  $("pn-ficheiro").addEventListener("change", async e => {
    const f = e.target.files[0];
    if (!f) return;
    estado.textContent = "A preparar a foto…";
    try {
      const url = await paReduzir(f);
      foto = url.split(",")[1]; previa.src = url; previa.hidden = false;
      $("pn-foto-txt").textContent = "Trocar foto"; estado.textContent = "";
    } catch (err) { foto = ""; estado.textContent = "Não consegui abrir a foto. Tenta outra vez."; }
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const tipo = (form.querySelector("[name=tipo]:checked") || {}).value;
    if (!foto) { estado.textContent = "Falta a foto."; return; }
    if (!tipo) { estado.textContent = "Escolhe o que é."; return; }
    const botao = $("pn-enviar");
    botao.disabled = true; estado.textContent = "A enviar…";
    try {
      const r = await post({ evento: "perdido", tipo, foto, cor: (form.querySelector("[name=cor]:checked") || {}).value || "", descricao: $("pn-descricao").value.trim() });
      if (!r.ok) { estado.textContent = paErro(r.erro); return; }
      ultimo = r.numero;
      estado.innerHTML = `Feito! <b>#${r.numero}</b> · sai a ${escapar(r.sai_a.split("-").reverse().slice(0, 2).join("/"))}. <button type="button" class="pn-link" id="pn-desfazer">Apagar este envio</button>`;
      foto = ""; previa.hidden = true; previa.removeAttribute("src"); $("pn-ficheiro").value = "";
      $("pn-foto-txt").textContent = "Tirar foto do próximo"; $("pn-descricao").value = "";
      form.querySelectorAll("[type=radio]").forEach(i => { i.checked = false; });
      carregar();
    } catch (err) { estado.textContent = paErro(); }
    finally { botao.disabled = false; }
  });

  estado.addEventListener("click", async e => {
    if (e.target.id !== "pn-desfazer" || !ultimo) return;
    e.target.disabled = true;
    const r = await post({ evento: "perdido_estado", numero: ultimo, estado: "apagado" }).catch(() => ({}));
    if (r.ok) { estado.textContent = "#" + ultimo + " apagado."; ultimo = 0; carregar(); }
    else { estado.textContent = paErro(r.erro); }
  });

  carregar();
})();
