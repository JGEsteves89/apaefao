// Perdidos e achados (perdidos.html): fotos dos objetos na caixa da escola. Dados: aba "perdidos" da Sheet (?acao=perdidos).
// Só aparecem objetos "achado" que ainda não saíram para doação. Teste com ?perdidos-teste na morada (dados inventados).
(function () {
  const el = document.getElementById("perdidos");
  const resumo = document.getElementById("pa-resumo");
  const filtros = document.getElementById("pa-filtros");
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const PLURAL = { casaco: "casacos", camisola: "camisolas", garrafa: "garrafas", lancheira: "lancheiras", mochila: "mochilas", "chapéu": "chapéus", "calçado": "calçado", outro: "outros" };
  const dia = iso => { const [, m, d] = iso.split("-").map(Number); return d + " de " + MESES[m - 1]; };
  const curto = iso => { const [, m, d] = iso.split("-").map(Number); return d + " " + MESES[m - 1].slice(0, 3); };
  let lista = [], filtro = "";

  const buscar = () => /[?&]perdidos-teste/.test(location.search) ? Promise.resolve(teste())
    : fetch(ENDPOINT + "?acao=perdidos", { signal: AbortSignal.timeout(15000) }).then(r => r.json());

  carregarDados("perdidos", el, buscar).then(d => {
    if (!d) return;
    lista = d.lista || [];
    desenhar();
  });

  function desenhar() {
    if (!lista.length) {
      el.innerHTML = '<p class="vazio">Não há nada nos perdidos esta semana.</p>';
      return;
    }
    const proxima = lista.map(o => o.sai_a).sort()[0];
    const conta = {};
    lista.forEach(o => { conta[o.tipo] = (conta[o.tipo] || 0) + 1; });
    resumo.innerHTML = `<b>${lista.length} ${lista.length === 1 ? "objeto" : "objetos"}</b> na caixa · os próximos saem para doação a <b>${dia(proxima)}</b>`;
    resumo.hidden = false;
    const tipos = PERDIDOS_TIPOS.filter(t => conta[t]);
    if (tipos.length > 1) {
      filtros.innerHTML = [["", "Todos"]].concat(tipos.map(t => [t, (PLURAL[t] || t) + " (" + conta[t] + ")"]))
        .map(([v, txt]) => `<button type="button" class="pa-filtro" data-tipo="${escapar(v)}" aria-pressed="${v === filtro}">${escapar(txt.charAt(0).toUpperCase() + txt.slice(1))}</button>`).join("");
      filtros.hidden = false;
    }
    const mostrar = lista.filter(o => !filtro || o.tipo === filtro);
    el.innerHTML = mostrar.map(o => {
      const nome = (o.tipo || "objeto") + (o.cor ? " " + o.cor : "");
      return `
      <article class="pa-cartao${o.sai_a === proxima ? " pa-sai" : ""}">
        <a class="pa-foto" href="${escapar(fotoPerdido(o.foto, 1600))}" target="_blank" rel="noopener">
          <img src="${escapar(fotoPerdido(o.foto, 600))}" alt="${escapar(nome)}" loading="lazy" onerror="this.parentNode.classList.add('sem-foto');this.remove()">
          <span class="pa-num">#${o.numero}</span>
        </a>
        <div class="pa-info">
          <b>${escapar(nome.charAt(0).toUpperCase() + nome.slice(1))}</b>
          <span>Sai a ${curto(o.sai_a)}</span>
        </div>
      </article>`;
    }).join("");
  }

  filtros.addEventListener("click", e => {
    const b = e.target.closest(".pa-filtro");
    if (!b) return;
    filtro = b.dataset.tipo;
    desenhar();
  });

  function teste() {
    const f = "1p6H6BNwufh7svA2RxnHBz1bqZPaZ4BMJ";
    return { lista: [
      { numero: 14, tipo: "casaco", cor: "azul", foto: f, sai_a: "2026-12-11" },
      { numero: 13, tipo: "garrafa", cor: "rosa", foto: f, sai_a: "2026-12-11" },
      { numero: 12, tipo: "lancheira", cor: "", foto: "x", sai_a: "2026-11-27" },
      { numero: 11, tipo: "casaco", cor: "verde", foto: f, sai_a: "2026-11-27" }
    ] };
  }
})();
