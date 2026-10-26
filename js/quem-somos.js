// Quem somos: cada órgão é uma flor, cada cargo uma pétala. O nome só aparece com "publicar": true.
(async function () {
  const flores = document.getElementById("flores");
  const turmas = document.getElementById("turmas");
  const d = await carregarJSON("data/orgaos.json", flores);
  if (!d) return;

  const nomeDe = p => p.publicar && p.nome ? p.nome : "";

  d.orgaos.forEach(o => {
    const n = o.membros.length;
    const flor = document.createElement("div");
    flor.className = "flor anima";
    flor.innerHTML = `
      <h3>${escapar(o.nome)}</h3>
      <div class="flor-corpo">
        <div class="miolo" aria-live="polite"><span class="pequeno">Toca numa pétala</span></div>
        ${o.membros.map((m, i) => `<button type="button" class="petala" style="--a:${i * 360 / n}deg; --i:${i}" aria-pressed="false">${escapar(m.cargo)}</button>`).join("")}
      </div>
      <ul class="flor-lista">${o.membros.map(m => `<li><b>${escapar(m.cargo)}</b> ${escapar(nomeDe(m) || "—")}</li>`).join("")}</ul>`;
    const miolo = flor.querySelector(".miolo");
    flor.querySelectorAll(".petala").forEach((b, i) => b.addEventListener("click", () => {
      flor.querySelectorAll(".petala").forEach(x => x.setAttribute("aria-pressed", x === b));
      const m = o.membros[i];
      miolo.innerHTML = `<b>${escapar(m.cargo)}</b>${nomeDe(m) ? `<span>${escapar(nomeDe(m))}</span>` : ""}`;
    }));
    flores.appendChild(flor);
  });

  turmas.innerHTML = d.representantes.map(r => `
    <div class="cacifo">
      <span class="cacifo-turma">${escapar(r.turma)}</span>
      ${nomeDe(r) ? `<span class="cacifo-nome">${escapar(nomeDe(r))}</span>` : '<span class="cacifo-nome em-breve">Em breve</span>'}
    </div>`).join("");

  aoAparecer();
})();
