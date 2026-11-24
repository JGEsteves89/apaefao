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
  const total = document.getElementById("total");
  const ref = document.getElementById("referencia");
  const mail = document.getElementById("mail-comprovativo");
  const seBebe = form.querySelector(".se-bebe");

  if (new Date() >= JANTAR_FECHA) {
    form.hidden = true;
    document.getElementById("jantar-fechado").hidden = false;
  }

  const n = nome => Math.max(0, parseInt(form[nome].value, 10) || 0);
  const valor = () => n("adultos") * PRECO_ADULTO + n("criancas") * PRECO_CRIANCA;

  function atualizar() {
    total.textContent = valor() + " €";
    const quem = form.nome.value.trim() || "O teu nome";
    ref.textContent = "JANTAR " + quem;
    mail.href = "mailto:apaefao@gmail.com?subject=" + encodeURIComponent("Comprovativo jantar de Natal " + quem);
    const temBebe = n("bebes") > 0;
    seBebe.hidden = !temBebe;
    form.cadeirinha.forEach(r => { r.required = temBebe; });
  }
  form.addEventListener("input", atualizar);
  form.addEventListener("change", atualizar);
  atualizar();
  document.querySelectorAll("[data-copiar]").forEach(b => b.addEventListener("click", () =>
    copiar(document.getElementById(b.dataset.copiar).textContent, b)));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    erro.textContent = "";
    if (n("adultos") + n("criancas") === 0) {
      erro.textContent = "Indica pelo menos 1 adulto ou 1 criança.";
      return;
    }
    if (!form.checkValidity()) {
      erro.textContent = form.rgpd.checked
        ? "Falta preencher alguma coisa."
        : "Falta preencher alguma coisa, e aceitar a última caixa.";
      form.reportValidity();
      return;
    }
    const dados = Object.fromEntries(new FormData(form));
    dados.rgpd = form.rgpd.checked;
    dados.total = valor();
    if (!n("bebes")) dados.cadeirinha = "";

    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true; botao.textContent = "A enviar…";
    const enviado = await enviar("jantar", dados);
    botao.disabled = false; botao.textContent = "Reservar";

    if (!enviado) {
      erro.textContent = "Não conseguimos enviar. Tenta outra vez, ou escreve para apaefao@gmail.com.";
      return;
    }
    document.getElementById("total-ok").textContent = valor() + " €";
    form.hidden = true;
    ok.hidden = false;
    ok.focus();
    confetti();
  });
})();
