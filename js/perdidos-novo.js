// Pôr nos perdidos (perdidos-novo.html): página interna para quem fotografa os objetos na escola.
// A chave vem no link (#chave=…) e fica guardada neste telemóvel. Sem chave, o Apps Script recusa.
// A foto é reduzida aqui (lado maior 1000 px, JPEG 0,7): envio rápido e sem dados escondidos (ex.: GPS).
(function () {
  const $ = id => document.getElementById(id);
  const CHAVE_LS = "apaef-perdidos-chave", ONDE_LS = "apaef-perdidos-onde";
  const CORES = ["azul", "vermelho", "rosa", "verde", "amarelo", "preto", "branco", "cinzento", "outra"];
  const ler = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: pede o link outra vez */ } };

  const daMorada = (location.hash.match(/chave=([A-Za-z0-9]+)/) || [])[1];
  if (daMorada) { gravar(CHAVE_LS, daMorada); history.replaceState(null, "", location.pathname); }
  const chave = daMorada || ler(CHAVE_LS);
  if (!chave) { $("pn-sem-chave").hidden = false; return; }

  const form = $("pn-form"), estado = $("pn-estado"), previa = $("pn-previa");
  let foto = "", ultimo = 0;
  form.hidden = false;
  $("pn-onde").value = ler(ONDE_LS) || "Caixa dos perdidos";
  const opcoes = (el, nome, lista) => {
    el.innerHTML = lista.map(v => `<label class="pa-opcao"><input type="radio" name="${nome}" value="${escapar(v === "outra" ? "" : v)}"><span>${escapar(v.charAt(0).toUpperCase() + v.slice(1))}</span></label>`).join("");
  };
  opcoes($("pn-tipos"), "tipo", PERDIDOS_TIPOS);
  opcoes($("pn-cores"), "cor", CORES);

  async function post(dados) {
    if (MODO_TESTE) { await espera(500); return { ok: true, numero: 99, sai_a: "2026-12-11" }; }
    const r = await fetch(ENDPOINT, { method: "POST", body: JSON.stringify(Object.assign({ chave }, dados)), signal: AbortSignal.timeout(60000) });
    return r.json();
  }
  const erroTxt = e => e === "chave" ? "A chave não é válida. Pede o link novo à APAEF." : e === "foto" ? "A foto não chegou bem. Tira outra." : e === "tipo" ? "Escolhe o que é." : "Não foi possível enviar. Tenta daqui a pouco.";

  async function reduzir(ficheiro) {
    let img;
    try { img = await createImageBitmap(ficheiro, { imageOrientation: "from-image" }); }
    catch (e) {
      img = new Image();
      img.src = URL.createObjectURL(ficheiro);
      await img.decode();
    }
    const escala = Math.min(1, 1000 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  }

  $("pn-ficheiro").addEventListener("change", async e => {
    const f = e.target.files[0];
    if (!f) return;
    estado.textContent = "A preparar a foto…";
    try {
      const url = await reduzir(f);
      foto = url.split(",")[1];
      previa.src = url; previa.hidden = false;
      $("pn-foto-txt").textContent = "Trocar foto";
      estado.textContent = "";
    } catch (err) {
      foto = ""; estado.textContent = "Não consegui abrir a foto. Tenta outra vez.";
    }
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const tipo = (form.querySelector("[name=tipo]:checked") || {}).value;
    if (!foto) { estado.textContent = "Falta a foto."; return; }
    if (!tipo) { estado.textContent = "Escolhe o que é."; return; }
    const onde = $("pn-onde").value.trim();
    gravar(ONDE_LS, onde);
    const botao = $("pn-enviar");
    botao.disabled = true; estado.textContent = "A enviar…";
    try {
      const r = await post({ evento: "perdido", tipo, cor: (form.querySelector("[name=cor]:checked") || {}).value || "", onde, foto });
      if (!r.ok) { estado.textContent = erroTxt(r.erro); return; }
      ultimo = r.numero;
      estado.innerHTML = `Feito! <b>#${r.numero}</b> · sai a ${escapar(r.sai_a.split("-").reverse().slice(0, 2).join("/"))}. <button type="button" class="pn-link" id="pn-desfazer">Apagar este envio</button>`;
      foto = ""; previa.hidden = true; previa.removeAttribute("src");
      $("pn-ficheiro").value = ""; $("pn-foto-txt").textContent = "Tirar foto do próximo";
      form.querySelectorAll("[type=radio]").forEach(i => { i.checked = false; });
      carregarLista();
    } catch (err) {
      estado.textContent = erroTxt();
    } finally {
      botao.disabled = false;
    }
  });

  async function mudar(numero, novo) {
    const r = await post({ evento: "perdido_estado", numero, estado: novo }).catch(() => ({}));
    if (!r.ok) { alert(erroTxt(r.erro)); return false; }
    return true;
  }

  estado.addEventListener("click", async e => {
    if (e.target.id !== "pn-desfazer" || !ultimo) return;
    e.target.disabled = true;
    if (await mudar(ultimo, "apagado")) { estado.textContent = "#" + ultimo + " apagado."; ultimo = 0; carregarLista(); }
  });

  const lista = $("pn-lista");
  async function carregarLista() {
    let d;
    try { d = MODO_TESTE ? { lista: [] } : await fetch(ENDPOINT + "?acao=perdidos&t=" + Date.now(), { signal: AbortSignal.timeout(15000) }).then(r => r.json()); }
    catch (e) { return; }
    $("pn-lista-sec").hidden = false;
    const itens = d.lista || [];
    lista.innerHTML = itens.length ? itens.map(o => `
      <article class="pa-cartao" data-numero="${o.numero}">
        <div class="pa-foto"><img src="${escapar(fotoPerdido(o.foto, 400))}" alt="" loading="lazy" onerror="this.parentNode.classList.add('sem-foto');this.remove()"><span class="pa-num">#${o.numero}</span></div>
        <div class="pa-info"><b>${escapar(o.tipo.charAt(0).toUpperCase() + o.tipo.slice(1))}${o.cor ? " " + escapar(o.cor) : ""}</b>
          <button type="button" class="botao pn-saiu">Já não está</button></div>
      </article>`).join("") : '<p class="vazio">A caixa está vazia.</p>';
  }
  lista.addEventListener("click", async e => {
    const b = e.target.closest(".pn-saiu");
    if (!b) return;
    if (!b.dataset.confirmar) { b.dataset.confirmar = "1"; b.textContent = "Tocar outra vez para confirmar"; return; }
    b.disabled = true;
    const cartao = b.closest(".pa-cartao");
    if (await mudar(Number(cartao.dataset.numero), "entregue")) cartao.remove();
    else b.disabled = false;
  });
  carregarLista();
})();
