// Quero ajudar: formulário em 4 passos curtos (um ecrã de cada vez).
// 1 Quem oferece · 2 O quê (um toque) · 3 Detalhes · 4 Contacto.
// No fim, o presente entra num girassol que abre, e aparece o obrigado.
// Atalhos por link: ajudar.html?quem=angariei  ·  ajudar.html?tipo=rifas  (pode juntar os dois)
(function () {
  avisoTeste();

  const form = document.getElementById("form-ajuda");
  const passos = [...form.querySelectorAll(".passo")];
  const pontos = [...document.querySelectorAll(".progresso li")];
  const obrigado = document.getElementById("obrigado");
  const presente = document.querySelector(".presente");
  const $ = s => form.querySelector(s);
  const estado = { quem: "", tipo: "" };
  let atual = 1, tipoDoLink = false;

  const TIPOS = {
    rifas:    { nome: "Prémio para rifas ou cabaz", ico: "🎟️", para: "Rifas de S. Martinho",
                exemplo: "ex.: jantar para 2, voucher de corte de cabelo, cabaz de produtos…",
                impacto: "O teu prémio vai fazer alguém feliz no sorteio, e o dinheiro das rifas vai para o recreio da escola." },
    feira:    { nome: "Comida para a feira", ico: "🍪", para: "Feirinha (27/11)",
                exemplo: "ex.: 2 bolos de laranja, 1 frasco de compota, castanhas…",
                impacto: "Cada bolo vendido na Feirinha ajuda a pagar as atividades das crianças." },
    objetos:  { nome: "Roupa ou objetos para a feira", ico: "👕", para: "Feirinha (27/11)",
                exemplo: "ex.: 1 saco de roupa de criança (4–6 anos), livros, brinquedos…",
                impacto: "Vai ter uma segunda vida na Feirinha, e o dinheiro fica para as atividades." },
    dinheiro: { nome: "Dinheiro", ico: "💶", para: "Quando fizer falta",
                exemplo: "Uma nota para nós (opcional)",
                impacto: "Vai direto para as atividades das crianças de Fão." },
    outro:    { nome: "Outra coisa", ico: "✨", para: "Quando fizer falta",
                exemplo: "Conta-nos a tua ideia",
                impacto: "Adoramos ideias novas. Vamos ver como a usar da melhor forma." },
  };

  // Lembra o nome de quem angaria (só neste browser), para não escrever sempre.
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const ler = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };

  // ---------- Mudar de passo ----------
  function irPara(n, recuar) {
    const de = passos[atual - 1], para = passos[n - 1];
    atual = n;
    pontos.forEach((li, i) => { li.classList.toggle("feito", i < n); li.classList.toggle("atual", i === n - 1); });
    if (de !== para) de.hidden = true;
    para.hidden = false;
    if (MOVIMENTO) para.animate([
      { opacity: 0, transform: `translateX(${recuar ? -24 : 24}px)` },
      { opacity: 1, transform: "none" },
    ], { duration: 220, easing: "ease-out" });
    const alvo = para.querySelector("h2");
    alvo.setAttribute("tabindex", "-1");
    alvo.focus({ preventScroll: true });
    if (para.getBoundingClientRect().top < 0) document.querySelector(".progresso").scrollIntoView({ behavior: MOVIMENTO ? "smooth" : "auto" });
  }
  form.querySelectorAll(".voltar").forEach(b => b.addEventListener("click", () => irPara(atual - 1, true)));

  // ---------- Passo 1: quem ----------
  function escolherQuem(v) {
    estado.quem = v;
    const ang = v === "angariei";
    form.querySelectorAll('[data-campo="quem"]').forEach(b => b.setAttribute("aria-pressed", b.dataset.valor === v));
    form.querySelector('[data-txt="queres"]').textContent = ang ? "vão" : "queres";
    form.querySelector(".so-angariei").hidden = !ang;
    $("[name=angariadoPor]").required = ang;
    if (ang && !$("[name=angariadoPor]").value) $("[name=angariadoPor]").value = ler("apaef-angariador");
    atualizarQuemE();
  }

  // ---------- Passo 2: o quê ----------
  function escolherTipo(v) {
    estado.tipo = v;
    const t = TIPOS[v];
    form.querySelectorAll('[data-campo="tipo"]').forEach(b => b.setAttribute("aria-pressed", b.dataset.valor === v));
    const din = v === "dinheiro";
    $("#l-oferta").firstChild.textContent = din ? "Uma nota " : "O que é? ";
    $("[name=oferta]").placeholder = t.exemplo;
    $("[name=oferta]").required = !din;
    form.querySelector(".so-dinheiro").hidden = !din;
    form.querySelector(".so-rifas").hidden = v !== "rifas";
    const r = form.querySelector(`[name=para][value="${t.para}"]`);
    if (r) r.checked = true;
  }

  form.querySelectorAll("[data-campo]").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.campo === "quem") { escolherQuem(b.dataset.valor); irPara(tipoDoLink ? 3 : 2); tipoDoLink = false; }
    else { escolherTipo(b.dataset.valor); irPara(3); }
  }));

  // ---------- Passo 3: detalhes ----------
  form.querySelector(".seguinte").addEventListener("click", () => {
    const erro = passos[2].querySelector(".erro-form");
    erro.textContent = "";
    const oferta = $("[name=oferta]");
    if (oferta.required && !oferta.value.trim()) { erro.textContent = "Escreve o que é, em poucas palavras."; oferta.focus(); return; }
    const nif = $("[name=nif]");
    if (estado.tipo === "dinheiro" && nif.value && !/^\d{9}$/.test(nif.value.trim())) { erro.textContent = "O NIF tem 9 números."; nif.focus(); return; }
    resumo();
    irPara(4);
  });

  // ---------- Passo 4: contacto ----------
  function atualizarQuemE() {
    const empresa = $("[name=quemE]:checked").value === "Empresa";
    const ang = estado.quem === "angariei";
    $("#l-nome").textContent = empresa ? "Nome da empresa ou loja" : (ang ? "Nome de quem oferece" : "O teu nome");
    $("[name=nome]").autocomplete = empresa ? "organization" : "name";
    form.querySelector(".so-empresa").hidden = !empresa;
    $("#l-contacto").innerHTML = ang ? "Contacto de quem oferece <small>(opcional)</small>" : "Telefone ou email <small>(para combinarmos)</small>";
    $("#l-mostrar").textContent = ang
      ? "Autorizaram mostrar o nome na página dos apoiantes 💛"
      : (empresa ? "Podem mostrar o nome da empresa na página dos apoiantes 💛" : "Podem mostrar o meu nome na página dos apoiantes 💛");
  }
  form.querySelectorAll("[name=quemE]").forEach(r => r.addEventListener("change", atualizarQuemE));

  function resumo() {
    const t = TIPOS[estado.tipo];
    const o = $("[name=oferta]").value.trim();
    $(".resumo").textContent = `${t.ico} ${o || t.nome} · ${$("[name=para]:checked").value}`;
  }

  // ---------- Enviar ----------
  async function animarPresente() {
    if (!MOVIMENTO) return;
    presente.hidden = false;
    await presente.animate([
      { transform: "translate(-50%, -50%) scale(.2) rotate(-20deg)", opacity: 0 },
      { transform: "translate(-50%, -50%) scale(1.1) rotate(6deg)", opacity: 1, offset: .5 },
      { transform: "translate(-50%, -50%) scale(1) rotate(-4deg)", opacity: 1, offset: .7 },
      { transform: "translate(-50%, -50%) scale(1) rotate(0)", opacity: 1 },
    ], { duration: 500, easing: "ease-out" }).finished;
    presente.classList.add("atado");
    await espera(350);
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const erro = passos[3].querySelector(".erro-form");
    erro.textContent = "";
    const nome = $("[name=nome]"), contacto = $("[name=contacto]"), ang = $("[name=angariadoPor]");
    if (!nome.value.trim()) { erro.textContent = "Falta o nome."; nome.focus(); return; }
    if (estado.quem === "eu" && !contacto.value.trim()) { erro.textContent = "Deixa um telefone ou email para combinarmos a entrega."; contacto.focus(); return; }
    if (estado.quem === "angariei" && !ang.value.trim()) { erro.textContent = "Escreve o teu nome, para sabermos quem conseguiu."; ang.focus(); return; }

    const f = new FormData(form);
    const dados = {
      quem: estado.quem === "angariei" ? "Angariado por membro" : "O próprio",
      tipo: TIPOS[estado.tipo].nome,
      oferta: f.get("oferta"), validade: f.get("validade"), para: f.get("para"),
      valor: f.get("valor"), nif: f.get("nif"),
      empresaOuParticular: f.get("quemE"), nome: f.get("nome"), onde: f.get("quemE") === "Empresa" ? f.get("onde") : "",
      contacto: f.get("contacto"), angariadoPor: estado.quem === "angariei" ? f.get("angariadoPor") : "",
      mostrar: $("[name=mostrar]").checked,
    };
    if (dados.angariadoPor) guardar("apaef-angariador", dados.angariadoPor.trim());

    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "A enviar…";
    const envio = enviar("donativo", dados);
    const [enviado] = await Promise.all([envio, animarPresente()]);
    botao.disabled = false;
    botao.textContent = "Enviar a minha ajuda 🎁";
    if (!enviado) {
      presente.hidden = true; presente.classList.remove("atado");
      erro.textContent = "Não conseguimos enviar. Tenta outra vez, ou escreve para apaefao@gmail.com.";
      return;
    }
    mostrarObrigado(dados);
  });

  async function mostrarObrigado(d) {
    const t = TIPOS[estado.tipo];
    const primeiro = (estado.quem === "eu" && d.empresaOuParticular === "Particular") ? d.nome.trim().split(/\s+/)[0] : "";
    obrigado.querySelector(".ob-titulo").textContent = estado.quem === "angariei"
      ? `Boa, ${d.angariadoPor.trim().split(/\s+/)[0]}! 💛`
      : `Obrigado${primeiro ? ", " + primeiro : ""}! 💛`;
    obrigado.querySelector(".ob-impacto").textContent = t.impacto;
    obrigado.querySelector(".ob-proximo").textContent = estado.quem === "angariei"
      ? "Já ficou registado para a equipa. Não precisas de mandar nada no WhatsApp."
      : (estado.tipo === "dinheiro" ? "Se deixaste o NIF, enviamos o recibo de donativo." : "Alguém da APAEF vai contactar-te para combinar a entrega.");

    // Pré-visualização do cartão na página dos apoiantes
    const prev = obrigado.querySelector(".ob-preview");
    prev.hidden = !d.mostrar;
    if (d.mostrar) {
      const caixa = obrigado.querySelector(".ob-cartao");
      caixa.innerHTML = "";
      caixa.appendChild(cartaoApoiante({ nome: d.nome.trim(), tipo: d.empresaOuParticular === "Particular" ? "particular" : "" }, new Date().getSeconds()));
      const lista = await carregarJSON("data/apoiantes.json");
      if (lista) prev.querySelector("p").textContent =
        `Vais juntar-te a ${lista.filter(a => a.publicar).length} empresas e amigos na página dos apoiantes (depois de confirmarmos):`;
    }

    const msg = "Ajudei a Associação de Pais de Fão 💛 Também podes ajudar em 1 minuto: https://apaefao.pt/ajudar.html";
    document.getElementById("partilhar").href = "https://wa.me/?text=" + encodeURIComponent(msg);

    form.hidden = true;
    document.querySelector(".progresso").hidden = true;
    if (MOVIMENTO) {
      await presente.animate([
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
        { transform: "translate(-50%, -10%) scale(.15)", opacity: 0 },
      ], { duration: 350, easing: "ease-in" }).finished;
    }
    presente.hidden = true; presente.classList.remove("atado");
    obrigado.hidden = false;
    obrigado.classList.remove("abre");
    void obrigado.offsetWidth;
    obrigado.classList.add("abre");
    obrigado.focus({ preventScroll: true });
    obrigado.scrollIntoView({ behavior: MOVIMENTO ? "smooth" : "auto", block: "start" });
    setTimeout(confetti, MOVIMENTO ? 650 : 0);
  }

  // Oferecer mais uma coisa: mantém quem é e o nome de quem angariou.
  document.getElementById("mais-uma").addEventListener("click", () => {
    const quem = estado.quem, ang = $("[name=angariadoPor]").value;
    form.reset();
    $("[name=angariadoPor]").value = ang;
    escolherQuem(quem);
    obrigado.hidden = true;
    form.hidden = false;
    document.querySelector(".progresso").hidden = false;
    irPara(2, true);
  });

  document.querySelectorAll("[data-copiar]").forEach(b => b.addEventListener("click", () =>
    copiar(document.getElementById(b.dataset.copiar).textContent, b)));

  // ---------- Início (com atalhos pelo link) ----------
  const q = new URLSearchParams(location.search);
  if (TIPOS[q.get("tipo")]) { escolherTipo(q.get("tipo")); tipoDoLink = true; }
  if (q.get("quem") === "angariei" || q.get("quem") === "eu") {
    escolherQuem(q.get("quem"));
    irPara(tipoDoLink ? 3 : 2);
    tipoDoLink = false;
  } else {
    atualizarQuemE();
    pontos[0].classList.add("atual");
  }
})();
