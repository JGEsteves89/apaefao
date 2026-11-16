// Notícias: linha do tempo, a mais recente em cima. Dados na Google Sheet, folha noticias.json.
// Imagens: só decorações, espaços ou mãos. Nunca caras de crianças.
// "imagem" = foto principal; "imagens" (opcional) = galeria com setas (a 1.ª é a principal).
(async function () {
  const el = document.getElementById("noticias");
  const lista = await carregarDados("noticias", el);
  if (!lista) return;

  el.innerHTML = lista.filter(n => n.data <= hojeISO()).sort((a, b) => a.data < b.data ? 1 : -1).map(n => `
    <li class="noticia anima">
      <span class="ponto" aria-hidden="true"></span>
      <article class="cartao">
        <time datetime="${escapar(n.data)}">${escapar(new Date(n.data + "T00:00:00").toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" }))}</time>
        <h2>${escapar(n.titulo)}</h2>
        <p>${escapar(n.texto)}</p>
        ${galeriaHTML(n.imagens && n.imagens.length ? n.imagens : [n.imagem], n.alt)}
        ${n.link ? `<p><a class="botao" href="${escapar(n.link)}" target="_blank" rel="noopener">${escapar(n.link_texto || "Ver mais")}</a></p>` : ""}
      </article>
    </li>`).join("");

  ativarGalerias(el);
  aoAparecer();
})();
