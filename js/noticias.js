// Notícias: linha do tempo, a mais recente em cima. Dados em data/noticias.json.
// Imagens: só decorações, espaços ou mãos. Nunca caras.
(async function () {
  const el = document.getElementById("noticias");
  const lista = await carregarJSON("data/noticias.json", el);
  if (!lista) return;

  el.innerHTML = lista.slice().sort((a, b) => a.data < b.data ? 1 : -1).map(n => `
    <li class="noticia anima">
      <span class="ponto" aria-hidden="true"></span>
      <article class="cartao">
        <time datetime="${escapar(n.data)}">${escapar(new Date(n.data + "T00:00:00").toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" }))}</time>
        <h2>${escapar(n.titulo)}</h2>
        <p>${escapar(n.texto)}</p>
        ${n.imagem ? `<img src="${escapar(n.imagem)}" alt="${escapar(n.alt || "")}" loading="lazy">` : ""}
      </article>
    </li>`).join("");

  aoAparecer();
})();
