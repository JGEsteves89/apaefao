// Agenda do ano: dados na Google Sheet, folha agenda.
// "fim" = último dia da atividade. Depois desse dia fica esbatida (e sai da página inicial).
// Na página inicial, data-limite="3" mostra só as próximas 3.
// Sem "imagem", aparece o "emoji" num quadrado.
// Atividades que já passaram com "imagens" (2 ou mais): foto pequena; ao clicar, abre a galeria de fotos com setas.

function cartaoEvento(e, classe) {
  const fotos = classe.includes("passou") && e.imagens && e.imagens.length > 1;
  const etiqueta = e.etiqueta ? ` <span class="etiqueta${e.confirmar ? " confirmar" : ""}">${escapar(e.etiqueta)}</span>` : "";
  return `
    <li class="evento${classe}">
      <div class="evento-cartao${fotos ? " com-fotos" : ""}">
        ${fotos ? `<button type="button" class="evento-mini" aria-label="Ver as ${e.imagens.length} fotos"><img src="${escapar(e.imagens[0].src || e.imagens[0])}" alt="${escapar(e.alt)}" loading="lazy"><span class="mais">${e.imagens.length} fotos</span></button>
        <div class="evento-galeria">${galeriaHTML(e.imagens, e.alt)}</div>` : e.imagem ? `<img src="${escapar(e.imagem)}" alt="${escapar(e.alt)}" loading="lazy">` : `<span class="evento-emoji" aria-hidden="true">${escapar(e.emoji || "⭐")}</span>`}
        <div class="evento-texto">
          <span class="selo-proxima">⭐ Próxima atividade</span><br>
          <span class="quando">${escapar(e.quando)}${etiqueta}</span>
          <h3>${escapar(e.titulo)}</h3>
          <p>${escapar(e.texto)}</p>
        </div>
      </div>
    </li>`;
}

document.querySelectorAll("[data-agenda]").forEach(async el => {
  const lista = await carregarDados("agenda", el);
  if (!lista) return;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const limite = Number(el.dataset.limite) || 0;
  let destaque = false, mostrados = 0;
  el.innerHTML = lista.map(e => {
    const passou = new Date(e.fim + "T23:59:59") < hoje;
    if (limite && (passou || mostrados >= limite)) return "";
    mostrados++;
    let classe = "";
    if (passou) classe = " passou";
    else if (!destaque) { classe = " proxima"; destaque = true; }
    return cartaoEvento(e, classe);
  }).join("");
  el.querySelectorAll(".evento-mini").forEach(b => b.addEventListener("click", () => {
    b.closest(".evento-cartao").classList.add("aberto");
  }));
  ativarGalerias(el);
});
