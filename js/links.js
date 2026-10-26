// Ajuda e links úteis: um mosaico por link, agrupados por categoria. Dados em data/links.json.
// Com "linhas" ou "largo": true, o mosaico ocupa a largura toda.
(async function () {
  const el = document.getElementById("links");
  const lista = await carregarJSON("data/links.json", el);
  if (!lista) return;

  const categorias = [...new Set(lista.map(l => l.categoria || "Outros"))];
  el.innerHTML = categorias.map(cat => `
    <h2 class="categoria">${escapar(cat)}</h2>
    <div class="tiles">
      ${lista.filter(l => (l.categoria || "Outros") === cat).map(l => {
        const tag = l.url ? "a" : "div";
        const link = l.url ? ` href="${escapar(l.url)}"${l.url.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}` : "";
        return `
          <${tag} class="tile${l.linhas || l.largo ? " largo" : ""}"${link}>
            <span class="tile-icone" aria-hidden="true">${escapar(l.icone || "🔗")}</span>
            <b>${escapar(l.titulo)}${l.emBreve ? ' <span class="etiqueta confirmar">em breve</span>' : ""}</b>
            <span class="desc">${escapar(l.descricao || "")}</span>
            ${l.linhas ? `<ul>${l.linhas.map(x => `<li>${escapar(x)}</li>`).join("")}</ul>` : ""}
          </${tag}>`;
      }).join("")}
    </div>`).join("");
})();
