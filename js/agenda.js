// Agenda do ano: dados em data/agenda.json.
// "fim" = último dia da atividade. Depois desse dia fica esbatida (e sai da página inicial).
// Na página inicial, data-limite="3" mostra só as próximas 3.
// Sem "imagem", aparece o "emoji" num quadrado.

function cartaoEvento(e, classe) {
  const etiqueta = e.etiqueta ? ` <span class="etiqueta${e.confirmar ? " confirmar" : ""}">${escapar(e.etiqueta)}</span>` : "";
  return `
    <li class="evento${classe}">
      <div class="evento-cartao">
        ${e.imagem ? `<img src="${escapar(e.imagem)}" alt="${escapar(e.alt)}" loading="lazy">` : `<span class="evento-emoji" aria-hidden="true">${escapar(e.emoji || "⭐")}</span>`}
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
  const lista = await carregarJSON("data/agenda.json", el);
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
});
