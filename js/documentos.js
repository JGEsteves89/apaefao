// Documentos: a próxima convocatória em destaque (dia, hora e local em texto) e o arquivo por tipo.
// Dados em data/documentos.json. "rascunho": true esconde um documento.

const TIPOS = {
  convocatoria: "Convocatórias",
  plano: "Planos de atividades",
  contas: "Contas",
  ata: "Atas",
  estatutos: "Estatutos",
  outro: "Outros",
};

function hojeMeiaNoite() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}

function dataDe(iso) {
  return new Date(iso + "T00:00:00");
}

function dataLonga(iso) {
  const t = dataDe(iso).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
  return t[0].toUpperCase() + t.slice(1);
}

function dataCurta(iso) {
  return iso ? dataDe(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" }) : "";
}

// Ficheiro .ics para o calendário do telemóvel (hora local de Portugal).
function ficheiroICS(d) {
  const [h, m] = d.hora.split(":").map(Number);
  const dia = d.data.replace(/-/g, "");
  const hhmm = min => String(Math.floor(min / 60)).padStart(2, "0") + String(min % 60).padStart(2, "0") + "00";
  const esc = t => String(t).replace(/[\\;,]/g, c => "\\" + c);
  const dobrar = linha => linha.match(/.{1,60}/g).join("\r\n ");
  const agora = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const descricao = "Ordem de trabalhos: " + (d.ordem || []).map((o, i) => (i + 1) + ") " + o).join(" ") +
    " Mais em https://apaefao.pt/documentos.html";
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//APAEF//apaefao.pt//PT", "BEGIN:VEVENT",
    "UID:" + d.id + "@apaefao.pt", "DTSTAMP:" + agora,
    "DTSTART:" + dia + "T" + hhmm(h * 60 + m), "DTEND:" + dia + "T" + hhmm(h * 60 + m + (d.duracao || 90)),
    dobrar("SUMMARY:" + esc("APAEF: " + d.titulo)), dobrar("LOCATION:" + esc(d.local)),
    dobrar("DESCRIPTION:" + esc(descricao)), "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

function mostrarDestaque(el, d) {
  const dias = Math.round((dataDe(d.data) - hojeMeiaNoite()) / 864e5);
  const faltam = dias === 0 ? "É hoje! 🎉" : dias === 1 ? "É amanhã!" : "Faltam <b>" + dias + "</b> dias";
  const mes = dataDe(d.data).toLocaleDateString("pt-PT", { month: "short" }).replace(".", "").toUpperCase();
  const wa = "*" + d.titulo + " da APAEF*\n" + dataLonga(d.data) + ", às " + d.hora + "\n" + d.local +
    "\n\nTudo aqui: https://apaefao.pt/documentos.html";

  el.innerHTML = `
    <article class="convoca anima">
      <span class="selo">📣 Convocatória</span>
      <h2>${escapar(d.titulo)}</h2>
      <div class="convoca-topo">
        <div class="calendario" aria-hidden="true">
          <div class="cal-folha"><span class="cal-mes">${escapar(mes)}</span><span class="cal-dia">${dataDe(d.data).getDate()}</span></div>
        </div>
        <dl class="convoca-dados">
          <div><dt>Dia</dt><dd>${escapar(dataLonga(d.data))}</dd></div>
          <div><dt>Hora</dt><dd>${escapar(d.hora)}</dd></div>
          <div><dt>Local</dt><dd>${escapar(d.local)}</dd></div>
        </dl>
      </div>
      <p class="faltam">${faltam}</p>
      ${d.ordem ? `<h3>Ordem de trabalhos</h3><ol>${d.ordem.map(o => `<li>${escapar(o)}</li>`).join("")}</ol>` : ""}
      ${d.nota ? `<p class="pequeno">${escapar(d.nota)}</p>` : ""}
      <div class="botoes">
        <button class="botao" type="button" id="ics">📅 Adicionar ao calendário</button>
        <a class="botao botao-wa" href="https://wa.me/?text=${encodeURIComponent(wa)}" target="_blank" rel="noopener">Partilhar no WhatsApp</a>
        ${d.ficheiro ? `<a class="link-forte" href="${escapar(d.ficheiro)}" target="_blank" rel="noopener">Ver a convocatória original</a>` : ""}
      </div>
    </article>`;

  el.querySelector("#ics").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([ficheiroICS(d)], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url; a.download = d.id + ".ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function cartaoDoc(d) {
  const tag = d.ficheiro ? "a" : "div";
  const link = d.ficheiro ? ` href="${escapar(d.ficheiro)}" target="_blank" rel="noopener"` : "";
  const quando = dataCurta(d.data);
  return `
    <${tag} class="doc${d.ficheiro ? "" : " sem-ficheiro"}"${link}>
      <span class="doc-pasta" aria-hidden="true"><span class="folha"></span></span>
      <span class="doc-texto">
        <b>${escapar(d.titulo)}</b>
        <small>${quando ? escapar(quando) + " · " : ""}${escapar(d.resumo || "")}</small>
      </span>
      ${d.ficheiro ? '<span class="doc-acao">Abrir ›</span>' : '<span class="etiqueta confirmar">em breve</span>'}
    </${tag}>`;
}

(async function () {
  const destaque = document.getElementById("destaque");
  const arquivo = document.getElementById("arquivo");
  const lista = await carregarJSON("data/documentos.json", arquivo);
  if (!lista) return;
  const visiveis = lista.filter(d => !d.rascunho);

  const hoje = hojeMeiaNoite();
  const proxima = visiveis
    .filter(d => d.tipo === "convocatoria" && d.destaque && d.data && dataDe(d.data) >= hoje)
    .sort((a, b) => a.data < b.data ? -1 : 1)[0];
  if (proxima) mostrarDestaque(destaque, proxima);

  arquivo.innerHTML = Object.keys(TIPOS).map(tipo => {
    const docs = visiveis.filter(d => (TIPOS[d.tipo] ? d.tipo : "outro") === tipo)
      .sort((a, b) => (a.data || "") < (b.data || "") ? 1 : -1);
    if (!docs.length) return "";
    return `<section class="tipo-docs anima"><h2>${TIPOS[tipo]}</h2>${docs.map(cartaoDoc).join("")}</section>`;
  }).join("");

  aoAparecer();
})();
