// Página inicial: próxima convocatória e últimas notícias.
(async function () {
  // Convocatória futura em destaque (dados em data/documentos.json).
  const docs = await carregarJSON("data/documentos.json");
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const conv = (docs || [])
    .filter(d => !d.rascunho && d.tipo === "convocatoria" && d.destaque && d.data && new Date(d.data + "T00:00:00") >= hoje)
    .sort((a, b) => a.data < b.data ? -1 : 1)[0];
  if (conv) {
    const dia = new Date(conv.data + "T00:00:00");
    const dias = Math.round((dia - hoje) / 864e5);
    const quando = dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : "Daqui a " + dias + " dias";
    const longa = dia.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
    document.getElementById("destaque-inicio").innerHTML = `
      <a class="convoca convoca-mini" href="documentos.html">
        <span class="selo">📣 Convocatória</span>
        <b>${escapar(conv.titulo)}</b>
        <span><strong>${quando}</strong> · ${escapar(longa)} · ${escapar(conv.hora)}</span>
        <span>${escapar(conv.local.split(",")[0])}</span>
        <span class="link-forte">Ver a ordem de trabalhos ›</span>
      </a>`;
  }

  // As 2 notícias mais recentes.
  const el = document.getElementById("ultimas-noticias");
  const noticias = await carregarJSON("data/noticias.json", el);
  if (!noticias) return;
  el.innerHTML = noticias.slice().sort((a, b) => a.data < b.data ? 1 : -1).slice(0, 2).map(n => `
    <article class="cartao noticia-mini">
      <time datetime="${escapar(n.data)}">${escapar(new Date(n.data + "T00:00:00").toLocaleDateString("pt-PT", { day: "numeric", month: "long" }))}</time>
      <h3>${escapar(n.titulo)}</h3>
      <p>${escapar(n.texto)}</p>
    </article>`).join("");
})();
