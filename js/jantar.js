// Jantar de Natal 12/12: reserva online (folha "jantar" da Sheet), total calculado e dados para pagar.
// Para fechar as reservas mais cedo (ex.: lugares esgotados): mudar JANTAR_FECHA para a data de hoje.
const JANTAR_FECHA = new Date("2026-12-10T00:00:00Z"); // fecha no fim de quarta 9/12 (Lisboa = UTC+0 em dezembro)
const PRECO_ADULTO = 15, PRECO_CRIANCA = 5;

(function () {
  avisoTeste();
  aoAparecer();

  const form = document.getElementById("form-jantar");
  const ok = document.getElementById("jantar-ok");
  const erro = form.querySelector(".erro-form");
  const ref = document.getElementById("referencia");
  const mail = document.getElementById("mail-comprovativo");

  if (new Date() >= JANTAR_FECHA) {
    form.hidden = true;
    document.getElementById("jantar-fechado").hidden = false;
  }

  // Contadores − / +: um por tipo de pessoa e prato (sem texto livre).
  const conta = {};
  form.querySelectorAll(".conta-pessoas").forEach(c => {
    const out = c.querySelector("output");
    conta[out.dataset.campo] = 0;
    const mudar = d => { conta[out.dataset.campo] = Math.min(20, Math.max(0, conta[out.dataset.campo] + d)); out.textContent = conta[out.dataset.campo]; atualizar(); };
    c.querySelector(".menos").addEventListener("click", () => mudar(-1));
    c.querySelector(".mais").addEventListener("click", () => mudar(1));
  });
  const adultos = () => conta.adultosPato + conta.adultosBacalhau;
  const criancas = () => conta.criancasPato + conta.criancasBacalhau;
  const valor = () => adultos() * PRECO_ADULTO + criancas() * PRECO_CRIANCA;
  const pessoasQuePagam = () => adultos() + criancas(); // = lugares (os bebés vão ao colo)

  // Lugares: 300, menos os já reservados (Apps Script ?acao=jantar, conta a folha "jantar").
  let livres = null;
  async function verLugares() {
    try {
      const r = await fetch(ENDPOINT + "?acao=jantar", { signal: AbortSignal.timeout(15000) }).then(r => r.json());
      if (typeof r.disponiveis !== "number") return;
      livres = r.disponiveis;
      const caixa = document.querySelector(".lugares");
      caixa.querySelector(".lugares-livres").textContent = livres;
      caixa.querySelector(".lugares-barra span").style.width = Math.round(100 * r.reservados / r.limite) + "%";
      caixa.hidden = false;
      if (livres <= 0) {
        form.hidden = true;
        const f = document.getElementById("jantar-fechado");
        f.textContent = "Esgotado! Já não há lugares. Obrigado a todos.";
        f.hidden = false;
      }
    } catch (e) { /* sem ligação: o formulário continua a funcionar */ }
  }
  if (!form.hidden && !MODO_TESTE) verLugares();

  // Alergénios: tocar num ícone mostra e esconde o nome (funciona no telemóvel).
  form.querySelectorAll(".alergenos-botao").forEach(b => b.addEventListener("click", () => {
    const t = b.nextElementSibling, abrir = t.hidden;
    form.querySelectorAll(".alergenos-texto").forEach(x => { x.hidden = true; });
    form.querySelectorAll(".alergenos-botao").forEach(x => x.setAttribute("aria-expanded", "false"));
    t.hidden = !abrir; b.setAttribute("aria-expanded", String(abrir));
  }));
  document.addEventListener("click", e => {
    if (!e.target.closest(".alergenos")) form.querySelectorAll(".alergenos-texto").forEach(x => { x.hidden = true; });
  });

  function atualizar() {
    const v = valor() + " €";
    document.getElementById("total").textContent = v;
    form.querySelectorAll(".pagar-info .valor").forEach(b => { b.textContent = v; });
    const quem = form.nome.value.trim() || "O teu nome";
    ref.textContent = "JANTAR " + quem;
    mail.href = "mailto:apaefao@gmail.com?subject=" + encodeURIComponent("Comprovativo jantar de Natal " + quem);
    // A ajuda do pagamento aparece logo a seguir à escolha, só a do método escolhido.
    form.querySelectorAll(".pagar-info").forEach(d => { d.hidden = d.dataset.para !== form.pagamento.value; });
  }
  form.addEventListener("input", atualizar);
  form.addEventListener("change", atualizar);
  atualizar();
  document.querySelectorAll("[data-copiar]").forEach(b => b.addEventListener("click", () =>
    copiar(document.getElementById(b.dataset.copiar).textContent, b)));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    erro.textContent = "";
    if (pessoasQuePagam() === 0) {
      erro.textContent = "Escolhe pelo menos 1 adulto ou 1 criança, com o prato.";
      return;
    }
    if (livres !== null && pessoasQuePagam() > livres) {
      erro.textContent = "Só há " + livres + " lugares livres. Tira algumas pessoas, por favor.";
      return;
    }
    if (!form.checkValidity()) {
      erro.textContent = form.rgpd.checked
        ? "Falta preencher alguma coisa."
        : "Falta preencher alguma coisa, e aceitar a última caixa.";
      form.reportValidity();
      return;
    }
    const dados = Object.assign(Object.fromEntries(new FormData(form)), conta);
    dados.rgpd = form.rgpd.checked;
    dados.total = valor();

    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true; botao.textContent = "A enviar…";
    const enviado = await enviar("jantar", dados);
    botao.disabled = false; botao.textContent = "Reservar";

    if (!enviado) {
      erro.textContent = "Não conseguimos enviar. Tenta outra vez, ou escreve para apaefao@gmail.com.";
      return;
    }
    document.getElementById("total-ok").textContent = valor() + " €";
    // O mesmo bloco de pagamento fica visível depois de enviar.
    const info = form.querySelector('.pagar-info[data-para="' + form.pagamento.value + '"]');
    ok.after(info);
    form.hidden = true;
    ok.hidden = false;
    ok.focus();
    confetti();
    if (!MODO_TESTE) setTimeout(verLugares, 3000);
  });
})();
