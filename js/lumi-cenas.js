// Lumi 2D: cenas animadas RARAS (a Lumi 3D nunca mexe). Ficheiros em img/mascote/cenas/.
// Olá, Espreitar e Obrigada: na 1.ª vez que a pessoa lá passa e, depois, ao acaso, 1 vez em cada 10.
//   Início:     "Olá" ao abrir · ou "a espreitar" ao chegar às Novidades (nunca as duas na mesma visita)
//   Apoiantes:  "Obrigada a todos"
// Donativo: SEMPRE que alguém faz um donativo nas Metas ou envia a ficha de sócio.
// No máximo 1 cena por página aberta.
// Para testar: ?lumi=ola | espreitar | obrigado | donativo (mostra sempre) · ?lumi=limpar (esquece o que já viu)
(function () {
  const CENAS = ["ola", "espreitar", "obrigado", "donativo"];
  const CHAVE = "lumi-cenas-vistas";
  const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE) || "{}"); } catch (e) { return {}; } };
  const visto = nome => !!ler()[nome];
  const marcar = nome => { try { const v = ler(); v[nome] = hojeISO(); localStorage.setItem(CHAVE, JSON.stringify(v)); } catch (e) {} };
  const ACASO = 0.1;                                   // 1 em cada 10
  const calha = nome => !visto(nome) || Math.random() < ACASO;
  let aTocar = false, jaMostrou = false;

  // modo: "normal" (1.ª vez ou 1 em 10), "sempre" (cada donativo), "teste" (ignora tudo)
  async function mostrar(nome, modo, texto) {
    modo = modo || "normal";
    if (aTocar || !CENAS.includes(nome)) return;
    if (modo !== "teste" && !MOVIMENTO) return;
    if (modo === "normal" && (jaMostrou || !calha(nome))) return;
    if (modo === "decidido" && jaMostrou) return;
    aTocar = true; jaMostrou = true;
    try {
      const r = await fetch("img/mascote/cenas/" + nome + ".html");
      if (!r.ok) throw new Error(r.status);
      const caixa = document.createElement("div");
      caixa.className = "lumi-cena cena-" + nome;
      caixa.innerHTML = await r.text();
      if (texto) caixa.querySelector(".globo").innerHTML = texto;
      caixa.style.setProperty("--k", Math.min(1, (innerWidth - 24) / 540).toFixed(3));
      document.body.appendChild(caixa);
      document.body.classList.add("lumi-a-tocar");   // só 1 Lumi de cada vez: a 3D esconde-se
      marcar(nome);
      let fechada = false;
      const fechar = () => {
        if (fechada) return;
        fechada = true;
        caixa.classList.add("sai");
        setTimeout(() => { caixa.remove(); document.body.classList.remove("lumi-a-tocar"); aTocar = false; }, 450);
      };
      setTimeout(fechar, Number(caixa.querySelector(".palco").dataset.duracao) || 6000);
      caixa.addEventListener("click", fechar);
      document.addEventListener("keydown", e => { if (e.key === "Escape") fechar(); });
    } catch (e) {
      aTocar = false;
    }
  }
  window.lumiCena = mostrar;

  const pedido = new URLSearchParams(location.search).get("lumi");
  if (pedido === "limpar") {
    try { localStorage.removeItem(CHAVE); } catch (e) {}
  } else if (pedido) {
    setTimeout(() => mostrar(pedido, "teste"), 600);
    return;
  }

  const pagina = location.pathname.split("/").pop() || "index.html";
  if (pagina === "index.html") {
    if (calha("ola")) {
      setTimeout(() => mostrar("ola", "decidido"), 1200);
    } else if (calha("espreitar") && "IntersectionObserver" in window) {
      const alvo = document.getElementById("novidades");
      if (alvo) {
        const io = new IntersectionObserver(es => {
          if (!es.some(e => e.isIntersecting)) return;
          io.disconnect();
          setTimeout(() => mostrar("espreitar", "decidido"), 400);
        }, { threshold: 0.3 });
        io.observe(alvo);
      }
    }
  }
  if (pagina === "apoiantes.html") setTimeout(() => mostrar("obrigado"), 1500);
  if (pagina === "metas.html") {
    // js/metas.js junta a classe "m-festa" ao cartão da meta quando alguém faz um donativo.
    new MutationObserver(ms => {
      if (ms.some(m => m.target.classList && m.target.classList.contains("m-festa") && !/\bm-festa\b/.test(m.oldValue || "")))
        setTimeout(() => mostrar("donativo", "sempre"), 700);
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  }
  if (pagina === "socios.html") {
    // js/socios.js mostra #socio-ok quando a ficha é enviada.
    const ok = document.getElementById("socio-ok");
    if (ok) new MutationObserver(() => {
      if (!ok.hidden) setTimeout(() => mostrar("donativo", "sempre", "Uau! Obrigada<br>por ajudares a escola!"), 500);
    }).observe(ok, { attributes: true, attributeFilter: ["hidden"] });
  }
})();
