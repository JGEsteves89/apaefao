// Sugestões e reclamações: a carta dobra-se, entra no envelope e o envelope voa.
(function () {
  avisoTeste();

  const form = document.getElementById("form-sugestao");
  const ok = document.getElementById("sugestao-ok");
  const envelope = document.querySelector(".envelope");
  const erro = form.querySelector(".erro-form");

  async function animarEnvio() {
    if (!MOVIMENTO) return;
    envelope.hidden = false;
    await form.animate([
      { transform: "none", opacity: 1 },
      { transform: "translateY(60px) scale(.3, .15)", opacity: 0 },
    ], { duration: 300, easing: "ease-in", fill: "forwards" }).finished;
    await envelope.animate([
      { transform: "none", opacity: 1 },
      { transform: "translate(70vw, -50vh) rotate(-20deg) scale(.6)", opacity: 0 },
    ], { duration: 400, easing: "ease-in" }).finished;
    envelope.hidden = true;
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    erro.textContent = "";
    if (form.resposta.checked && !form.email.value.trim()) {
      erro.textContent = "Para te respondermos, deixa o teu email.";
      form.email.focus();
      return;
    }
    if (!form.checkValidity()) {
      erro.textContent = "Escolhe o tema e escreve a mensagem.";
      form.reportValidity();
      return;
    }
    const dados = Object.fromEntries(new FormData(form));
    dados.resposta = form.resposta.checked;

    // O envio demora uns segundos (Google): a carta voa logo e a caixa diz "A enviar…" até chegar a resposta.
    const botao = form.querySelector("button[type=submit]");
    const titulo = ok.querySelector("h3");
    botao.disabled = true;
    const envio = enviar("sugestao", dados);
    await animarEnvio();
    form.hidden = true;
    titulo.textContent = "A enviar… ✉️";
    ok.classList.add("a-enviar");
    ok.hidden = false;
    const enviado = await envio;
    botao.disabled = false;
    ok.classList.remove("a-enviar");
    if (!enviado) {
      ok.hidden = true;
      form.getAnimations().forEach(a => a.cancel());
      form.hidden = false;
      erro.textContent = "Não conseguimos enviar. Tenta outra vez, ou escreve para apaefao@gmail.com.";
      return;
    }
    titulo.textContent = "Recebido! ✉️";
    ok.focus();
  });

  document.getElementById("outra").addEventListener("click", () => {
    form.reset();
    form.getAnimations().forEach(a => a.cancel());
    ok.hidden = true;
    form.hidden = false;
    form.mensagem.focus();
  });
})();
