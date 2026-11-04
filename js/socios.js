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
  const alunos = document.getElementById("alunos");
  const valor = document.getElementById("valor-quota");
  const modelo = alunos.querySelector(".aluno-linha").cloneNode(true);

  // Quota por aluno: cada filho tem o seu nome e a sua turma (uma linha por aluno na folha).
  function lista() {
    return [...alunos.querySelectorAll(".aluno-linha")].map(l => ({
      aluno: l.querySelector(".f-aluno").value.trim(),
      turma: l.querySelector(".f-turma").value,
    }));
  }
  document.getElementById("mais-aluno").addEventListener("click", () => {
    const l = modelo.cloneNode(true);
    const tirar = document.createElement("button");
    tirar.type = "button"; tirar.className = "tirar-aluno"; tirar.textContent = "Tirar este aluno";
    tirar.addEventListener("click", () => { l.remove(); atualizar(); });
    l.append(tirar);
    alunos.append(l);
    l.querySelector(".f-aluno").focus();
    atualizar();
  });

  // O descritivo e o assunto do email completam-se com o que está na ficha.
  function atualizar() {
    const todos = lista().map(a => (a.aluno || "Nome do aluno") + " " + (a.turma || "Turma")).join(" + ");
    ref.textContent = "QUOTA " + todos;
    valor.textContent = (12 * lista().length) + " €";
    mail.href = "mailto:apaefao@gmail.com?subject=" + encodeURIComponent("Comprovativo quota " + todos);

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
    let enviado = true;
    for (const a of lista()) {
      enviado = (await enviar("socio", Object.assign({}, dados, a))) && enviado;
    }
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
