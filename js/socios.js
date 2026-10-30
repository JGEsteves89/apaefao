// Ser sócio: ficha online (igual à ficha em papel), IBAN e descritivo prontos a copiar.
(function () {
  avisoTeste();
  aoAparecer();

  const form = document.getElementById("form-socio");
  const ok = document.getElementById("socio-ok");
  const erro = form.querySelector(".erro-form");
  const ref = document.getElementById("referencia");
  const mail = document.getElementById("mail-comprovativo");
  const seRecibo = form.querySelector(".se-recibo");

  // O descritivo e o assunto do email completam-se com o que está na ficha.
  function atualizar() {
    const aluno = form.aluno.value.trim() || "Nome do aluno";
    const turma = form.turma.value || "Turma";
    ref.textContent = "QUOTA " + aluno + " " + turma;
    mail.href = "mailto:apaefao@gmail.com?subject=" + encodeURIComponent("Comprovativo quota " + aluno + " " + turma);

    // NIF do encarregado de educação e recibo por email: só para quem quer recibo.
    const querRecibo = form.recibo.value === "sim";
    seRecibo.hidden = !querRecibo;
    form.nif.required = querRecibo;
    form.reciboEmail.forEach(r => { r.required = querRecibo; });
  }
  form.addEventListener("input", atualizar);
  form.addEventListener("change", atualizar);
  document.querySelectorAll("[data-copiar]").forEach(b => b.addEventListener("click", () =>
    copiar(document.getElementById(b.dataset.copiar).textContent, b)));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    erro.textContent = "";
    if (!form.checkValidity()) {
      erro.textContent = form.rgpd.checked
        ? "Falta preencher alguma coisa. O NIF do encarregado de educação tem 9 números."
        : "Falta preencher alguma coisa, e aceitar a última caixa.";
      form.reportValidity();
      return;
    }
    const dados = Object.fromEntries(new FormData(form));
    dados.rgpd = form.rgpd.checked;

    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true; botao.textContent = "A enviar…";
    const enviado = await enviar("socio", dados);
    botao.disabled = false; botao.textContent = "Enviar a ficha";

    if (!enviado) {
      erro.textContent = "Não conseguimos enviar. Tenta outra vez, ou escreve para apaefao@gmail.com.";
      return;
    }
    form.hidden = true;
    ok.hidden = false;
    ok.focus();
    confetti();
  });
})();
