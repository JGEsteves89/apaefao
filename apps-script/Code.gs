// Google Apps Script — recebe as respostas dos formulários do site e guarda numa Google Sheet.
// Como instalar (por agora numa conta Google pessoal do Jose; depois mudar para apaefao@gmail.com):
// 1. A Google Sheet chama-se "Votacoes APAEF" (é lá que está este código).
// 2. Extensões → Apps Script → colar este código.
// 3. Implementar → Nova implementação → Tipo "Aplicação Web"
//    Executar como: Eu · Quem tem acesso: Qualquer pessoa.
// 4. Copiar o URL e colar em ENDPOINT no halloween.html e em js/config.js (votação).
// Depois de mudar este código: Implementar → Gerir implementações → editar → "Nova versão".
// Para esconder uma ideia nova: folha "ideias" → escrever "sim" na coluna "ocultar".

// A votação fecha no fim de 25/10/2026 (hora de Lisboa; nessa data Lisboa já está em UTC+0).
const VOTACAO_FECHA = new Date("2026-10-26T00:00:00Z");

function doPost(e) {
  const dados = JSON.parse(e.postData.contents);
  if (dados.evento === "votacao") return guardarVoto(dados);
  if (dados.evento === "responsavel") return guardarResponsavel(dados);
  if (dados.evento === "foto") return mudarFoto(dados);
  if (dados.evento === "doacao_meta") return guardarDoacaoMeta(dados);
  if (CAMPOS_FORMULARIO[dados.evento]) return guardarFormulario(dados);

  const folha = SpreadsheetApp.getActiveSpreadsheet();
  const nome = dados.evento || "Respostas";
  const aba = folha.getSheetByName(nome) || folha.insertSheet(nome);
  const campos = ["data", "nome", "telemovel", "criancas", "turma", "recebe", "rua", "ajuda"];
  if (aba.getLastRow() === 0) aba.appendRow(campos);
  aba.appendRow(campos.map(c => dados[c] || ""));
  return ContentService.createTextOutput("ok");
}

// Ficha de sócio e sugestões: uma linha por envio, cada um na sua folha, e um email de aviso.
// Por agora o aviso vai para o Jose (testes). Depois: apaefao@gmail.com.
const EMAIL_AVISOS = "ijimiguel@gmail.com";
const CAMPOS_FORMULARIO = {
  socio: { folha: "socios", campos: ["aluno", "turma", "encarregado", "telefone", "email", "recibo", "nif", "reciboEmail", "imagem", "rgpd"] },
  sugestao: { folha: "sugestoes", campos: ["tema", "mensagem", "nome", "email", "resposta"] },
  // Quero ajudar (ajudar.html): cada oferta é uma linha na folha "apoiantes" (ver novoApoiante).
  donativo: { folha: "apoiantes", campos: ["quem", "tipo", "oferta", "validade", "voucher", "para", "valor", "nif", "empresaOuParticular", "nome", "onde", "contacto", "angariadoPor", "mostrar"] },
};

function guardarFormulario(dados) {
  if (dados.evento === "socio" && dados.rgpd !== true) return json({ ok: false, erro: "sem rgpd" });
  const f = CAMPOS_FORMULARIO[dados.evento];
  const valores = f.campos.map(c => limpar(dados[c], c === "mensagem" ? 1500 : c === "oferta" ? 500 : 120));
  if (dados.evento === "donativo") novoApoiante(dados);
  else {
    const folha = SpreadsheetApp.getActiveSpreadsheet();
    const aba = folha.getSheetByName(f.folha) || folha.insertSheet(f.folha);
    if (aba.getLastRow() === 0) aba.appendRow(["timestamp"].concat(f.campos));
    aba.appendRow([new Date()].concat(valores));
  }
  const assunto = dados.evento === "socio" ? "Nova ficha de sócio: " + valores[0] + " (" + valores[1] + ")"
    : dados.evento === "donativo" ? "Nova oferta: " + valores[9] + " — " + valores[1]
    : "Nova sugestão: " + valores[0];
  let texto = f.campos.map((c, i) => c + ": " + valores[i]).join("\n");
  if (dados.evento === "donativo" && dados.mostrar === true) texto += "\n\nPara aparecer no site: folha \"apoiantes\" → marcar \"publicar\".";
  MailApp.sendEmail(EMAIL_AVISOS, "[APAEF site] " + assunto, texto);
  return json({ ok: true });
}

// ---------- Apoiantes e ofertas: uma só lista (folha "apoiantes") ----------
// Uma linha por apoiante ou oferta. Os apoiantes antigos e cada envio do "Quero ajudar" ficam na mesma folha.
// O site só mostra as linhas com "publicar" marcado (e nunca quem disse que não quer aparecer),
// e só nome, tipo de negócio (ícone), foto e link. O resto (oferta, valor, contacto, NIF…) fica só na folha.
// O tamanho do cartão vem do "valor estimado €": grande ≥ 50 €, alto 35–49 €, largo 25–34 €, pequeno < 25 €.
// "foto": caminho no site (img/apoiantes/x.jpg) ou link https. Sem foto → ícone do tipo de negócio.
const COLUNAS_APOIANTES = ["publicar", "nome", "tipo de negócio", "foto", "link", "oferta", "tipo de oferta",
  "valor estimado €", "para", "validade", "quem faz o voucher", "empresa ou particular", "onde",
  "contacto", "nif", "quem preencheu", "quem conseguiu", "aceita aparecer", "data", "prémio usado"];

function abaApoiantes() {
  const folha = SpreadsheetApp.getActiveSpreadsheet();
  let aba = folha.getSheetByName("apoiantes");
  if (!aba) aba = folha.insertSheet("apoiantes");
  if (aba.getLastRow() === 0) { aba.appendRow(COLUNAS_APOIANTES); aba.setFrozenRows(1); }
  return aba;
}

function cabecalho(aba) {
  return aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(c => String(c).trim().toLowerCase());
}

// Escreve uma linha pelos nomes das colunas (a ordem das colunas na folha pode mudar).
function juntarLinha(aba, linha) {
  const cab = cabecalho(aba);
  aba.appendRow(cab.map(c => c in linha ? linha[c] : ""));
  const col = cab.indexOf("publicar") + 1;
  if (col) aba.getRange(aba.getLastRow(), col).insertCheckboxes();
}

// Uma oferta do "Quero ajudar" → uma linha nova, sem visto em "publicar".
function linhaDoFormulario(d, data) {
  return {
    publicar: false, nome: limpar(d.nome, 80), "tipo de negócio": d.empresaOuParticular === "Particular" ? "particular" : "",
    oferta: limpar(d.oferta, 500), "tipo de oferta": limpar(d.tipo, 60), "valor estimado €": limpar(d.valor, 20),
    para: limpar(d.para, 60), validade: limpar(d.validade, 120), "quem faz o voucher": limpar(d.voucher, 60),
    "empresa ou particular": limpar(d.empresaOuParticular, 20), onde: limpar(d.onde, 120), contacto: limpar(d.contacto, 120),
    nif: limpar(d.nif, 20), "quem preencheu": limpar(d.quem, 40), "quem conseguiu": limpar(d.angariadoPor, 80),
    "aceita aparecer": d.mostrar === true || /^(true|sim)$/i.test(String(d.mostrar)) ? "sim" : "não", data: data || new Date(),
  };
}

function novoApoiante(d) {
  juntarLinha(abaApoiantes(), linhaDoFormulario(d));
  CacheService.getScriptCache().remove("apoiantes");
}

// Correr UMA vez no editor do Apps Script (escolher "juntarDonativos" → Executar):
// passa as linhas da folha antiga "donativos" para a lista "apoiantes", põe as caixas em "publicar" e apaga "donativos".
function juntarDonativos() {
  const folha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = abaApoiantes();
  const antiga = folha.getSheetByName("donativos");
  let n = 0;
  if (antiga && antiga.getLastRow() > 1) {
    const linhas = antiga.getDataRange().getValues();
    const cab = linhas.shift().map(c => String(c).trim());
    linhas.forEach(l => {
      const d = Object.fromEntries(cab.map((c, i) => [c, l[i]]));
      if (!String(d.nome || d.oferta || "").trim()) return;
      juntarLinha(aba, linhaDoFormulario(d, d.timestamp));
      n++;
    });
  }
  const col = cabecalho(aba).indexOf("publicar") + 1;
  if (col && aba.getLastRow() > 1) aba.getRange(2, col, aba.getLastRow() - 1, 1).insertCheckboxes();
  if (antiga && n === Math.max(0, antiga.getLastRow() - 1)) folha.deleteSheet(antiga);
  CacheService.getScriptCache().remove("apoiantes");
  Logger.log(n + " ofertas passadas para a folha apoiantes.");
}

// Muda a "foto" e/ou o "link" de um apoiante (usado pelo assistente do Jose quando junta uma imagem ou um link ao site).
// Só funciona com a chave secreta: Apps Script → Definições do projeto → Propriedades do script → CHAVE_ADMIN.
// A chave nunca está neste ficheiro.
function mudarFoto(d) {
  const chave = PropertiesService.getScriptProperties().getProperty("CHAVE_ADMIN");
  if (!chave || d.chave !== chave) return json({ ok: false, erro: "sem autorização" });
  const foto = String(d.foto || "").trim(), link = String(d.link || "").trim();
  if (foto && !/^(img\/apoiantes\/[a-z0-9-]+\.(jpg|png)|https:\/\/\S+)$/.test(foto)) return json({ ok: false, erro: "foto inválida" });
  if (link && !/^https:\/\/\S+$/.test(link)) return json({ ok: false, erro: "link inválido" });
  if (!foto && !link) return json({ ok: false, erro: "nada para mudar" });
  const aba = abaApoiantes(), cab = cabecalho(aba);
  const cNome = cab.indexOf("nome"), cFoto = cab.indexOf("foto"), cLink = cab.indexOf("link");
  const nomes = aba.getRange(1, cNome + 1, aba.getLastRow(), 1).getValues().map(l => String(l[0]).trim().toLowerCase());
  const alvo = String(d.nome || "").trim().toLowerCase();
  const linhas = nomes.map((n, i) => n === alvo ? i + 1 : 0).filter(i => i > 1);
  if (!linhas.length) return json({ ok: false, erro: "não encontrei " + d.nome });
  linhas.forEach(l => {
    if (foto) aba.getRange(l, cFoto + 1).setValue(foto);
    if (link) aba.getRange(l, cLink + 1).setValue(link);
  });
  CacheService.getScriptCache().remove("apoiantes");
  return json({ ok: true, linhas: linhas.length });
}

function sim(v) { return v === true || /^(sim|s|x|true|verdadeiro)$/i.test(String(v).trim()); }

function tamanhoApoiante(valor) {
  const v = parseFloat(String(valor).replace(",", "."));
  return v >= 50 ? "grande" : v >= 35 ? "alto" : v >= 25 ? "largo" : "pequeno";
}

function apoiantes() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get("apoiantes");
  if (guardado) return JSON.parse(guardado);
  const linhas = abaApoiantes().getDataRange().getValues();
  const cab = linhas.shift().map(c => String(c).trim().toLowerCase());
  // Várias linhas com o mesmo nome (ex.: "Pais e amigos", ou uma loja que ajuda duas vezes) → um só cartão; os valores somam.
  const porNome = {};
  linhas.map(l => Object.fromEntries(cab.map((c, i) => [c, l[i]])))
    .filter(a => sim(a.publicar) && String(a.nome).trim() && !/^(não|nao|n|false)$/i.test(String(a["aceita aparecer"]).trim()))
    .forEach(a => {
      const nome = limpar(a.nome, 80), chave = nome.toLowerCase();
      const foto = String(a.foto || "").trim(), link = String(a.link || "").trim();
      const c = porNome[chave] = porNome[chave] || { nome, tipo: "", valor: 0, logo: "", maps_url: "" };
      c.tipo = c.tipo || limpar(a["tipo de negócio"], 30).toLowerCase();
      c.valor += parseFloat(String(a["valor estimado €"]).replace(",", ".")) || 0;
      c.logo = c.logo || (/^(img\/|https:\/\/)/.test(foto) ? foto : "");
      c.maps_url = c.maps_url || (/^https:\/\//.test(link) ? link : "");
    });
  const lista = Object.values(porNome).map(c => ({
    nome: c.nome, tipo: c.tipo, tamanho: tamanhoApoiante(c.valor), logo: c.logo, maps_url: c.maps_url, publicar: true,
  }));
  cache.put("apoiantes", JSON.stringify(lista), 60);
  return lista;
}

function doGet(e) {
  if (e && e.parameter && e.parameter.acao === "resultados") return json(resultados());
  if (e && e.parameter && e.parameter.acao === "responsaveis") return json(responsaveis());
  if (e && e.parameter && e.parameter.acao === "apoiantes") return json(apoiantes());
  if (e && e.parameter && e.parameter.acao === "metas") return json(metas());
  return json({ ok: true });
}

// Um voto por voterId: se já existe, a linha é substituída.
function guardarVoto(dados) {
  if (new Date() >= VOTACAO_FECHA) return json({ ok: false, fechado: true });
  if (!dados.voterId) return json({ ok: false, erro: "sem voterId" });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const aba = abaVotacao();
    const linha = [new Date(), dados.voterId, limpar(dados.nome, 80), limpar(dados.turma, 40), JSON.stringify(dados)];
    const ids = aba.getLastRow() > 1 ? aba.getRange(2, 2, aba.getLastRow() - 1, 1).getValues() : [];
    const i = ids.findIndex(r => r[0] === dados.voterId);
    if (i >= 0) aba.getRange(i + 2, 1, 1, linha.length).setValues([linha]);
    else aba.appendRow(linha);
    registarIdeias(dados);
  } finally {
    lock.releaseLock();
  }
  CacheService.getScriptCache().remove("resultados");
  return json({ ok: true });
}

// Só totais, sem nomes. "novas" = ideias dos pais, que todos podem votar.
// Uma ideia só existe no boletim de quem a escreveu: só essa pessoa a pode apagar.
function resultados() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get("resultados");
  if (guardado) return JSON.parse(guardado);

  const aba = abaVotacao();
  const linhas = aba.getLastRow() > 1 ? aba.getRange(2, 5, aba.getLastRow() - 1, 1).getValues() : [];
  const r = { total: 0, porData: {}, ajudo: {}, ideias: [], novas: {}, fecha: VOTACAO_FECHA.toISOString() };
  const vistas = {}, escondidas = ideiasOcultas();
  linhas.forEach(([texto]) => {
    let v;
    try { v = JSON.parse(texto); } catch (err) { return; }
    r.total++;
    (v.votos || []).forEach(voto => {
      const porAtiv = r.porData[voto.data] = r.porData[voto.data] || {};
      (voto.atividades || []).slice(0, 3).forEach(a => { porAtiv[a] = (porAtiv[a] || 0) + 1; });
      if (voto.ajudo) r.ajudo[voto.data] = (r.ajudo[voto.data] || 0) + 1;
    });
    (v.ideias || []).forEach(i => {
      if (!i.texto) return;
      r.ideias.push(limpar(i.texto, 200));
      if (i.id && i.data && !vistas[i.id] && !escondidas[i.id]) {
        vistas[i.id] = true;
        (r.novas[i.data] = r.novas[i.data] || []).push({ id: limpar(i.id, 40), texto: limpar(i.texto, 200), criadaEm: limpar(i.criadaEm, 30) });
      }
    });
    if (v.comentario) r.ideias.push(limpar(v.comentario, 500));
  });
  cache.put("resultados", JSON.stringify(r), 60);
  return r;
}

// Folha "ideias": cada ideia nova fica numa linha. Para esconder uma ideia (ex.: texto ofensivo),
// a Direção escreve "sim" na coluna "ocultar". Deixa de aparecer a todos, no máximo 1 minuto depois.
function abaIdeias() {
  const folha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = folha.getSheetByName("ideias") || folha.insertSheet("ideias");
  if (aba.getLastRow() === 0) aba.appendRow(["id", "data", "ideia", "ocultar (escrever sim)"]);
  return aba;
}

function registarIdeias(dados) {
  const novas = (dados.ideias || []).filter(i => i.id && i.texto);
  if (!novas.length) return;
  const aba = abaIdeias();
  const ids = aba.getLastRow() > 1 ? aba.getRange(2, 1, aba.getLastRow() - 1, 1).getValues().map(r => r[0]) : [];
  novas.forEach(i => { if (!ids.includes(i.id)) aba.appendRow([limpar(i.id, 40), limpar(i.data, 40), limpar(i.texto, 200), ""]); });
}

function ideiasOcultas() {
  const aba = abaIdeias(), r = {};
  if (aba.getLastRow() < 2) return r;
  aba.getRange(2, 1, aba.getLastRow() - 1, 4).getValues().forEach(([id, , , ocultar]) => {
    if (id && /^(sim|s|x|true)$/i.test(String(ocultar).trim())) r[id] = true;
  });
  return r;
}

function abaVotacao() {
  const folha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = folha.getSheetByName("votacao") || folha.insertSheet("votacao");
  if (aba.getLastRow() === 0) aba.appendRow(["timestamp", "voterId", "nome", "turma", "json"]);
  return aba;
}

function limpar(texto, max) {
  return String(texto || "").trim().slice(0, max);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Halloween: responsáveis de cada percurso (página percursos-halloween) ----------
// Folha "responsaveis": uma linha por inscrição. O telemóvel só fica na folha (nunca aparece no site).
// Para tirar um nome da página: escrever "sim" na coluna "ocultar".
function abaResponsaveis() {
  const folha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = folha.getSheetByName("responsaveis") || folha.insertSheet("responsaveis");
  if (aba.getLastRow() === 0) aba.appendRow(["timestamp", "percurso", "nome", "telemovel", "ocultar (escrever sim)"]);
  return aba;
}

function guardarResponsavel(dados) {
  const percurso = parseInt(dados.percurso, 10);
  const nome = limpar(dados.nome, 60);
  if (!percurso || percurso < 1 || percurso > 20 || !nome || dados.autoriza !== true) return json({ ok: false });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    abaResponsaveis().appendRow([new Date(), percurso, nome, limpar(dados.telemovel, 20), ""]);
  } finally {
    lock.releaseLock();
  }
  CacheService.getScriptCache().remove("responsaveis");
  MailApp.sendEmail(EMAIL_AVISOS, "[APAEF site] Responsável Halloween: percurso " + percurso, nome + (dados.telemovel ? " · " + limpar(dados.telemovel, 20) : ""));
  return json({ ok: true });
}

// Só nomes por percurso (sem telemóvel).
function responsaveis() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get("responsaveis");
  if (guardado) return JSON.parse(guardado);
  const aba = abaResponsaveis(), r = {};
  if (aba.getLastRow() > 1) {
    aba.getRange(2, 1, aba.getLastRow() - 1, 5).getValues().forEach(([, percurso, nome, , ocultar]) => {
      if (!percurso || !nome || /^(sim|s|x|true)$/i.test(String(ocultar).trim())) return;
      (r[percurso] = r[percurso] || []).push(limpar(nome, 60));
    });
  }
  cache.put("responsaveis", JSON.stringify(r), 30);
  return r;
}


// ---------- Metas (página metas.html) ----------
// Folha "metas": uma linha por meta (o que aparece no site).
//   estado: "a angariar" (barra), "a seguir" (fechada), "garantido" (já há dinheiro), "feito" (com foto e fatura).
//   prioridade: só interna (ordem e para onde vai o que sobra). imagens: "caminho | legenda ; caminho | legenda".
//   custos_detalhe: linhas separadas por ";". unidade ("ioiô|ioiôs": singular|plural) + preco_unidade: para o impacto ("10 € = 14 ioiôs").
// Folha "movimentos": o ÚNICO sítio com valores. Uma linha por movimento de dinheiro. Só contam as linhas com confirmado = sim.
//   tipo "entrada"  → entra dinheiro. destino "geral" (Halloween, quotas…) ou o id de uma meta (donativo com destino).
//   tipo "saída"    → sai dinheiro. destino = a meta onde foi gasto (ex.: bilhetes do cinema) ou "geral" (outras despesas).
//   tipo "passagem" → não mexe no banco: a Direção decide pôr dinheiro do fundo geral numa meta.
// Contas (sem divisões automáticas):
//   barra de uma meta = entradas + passagens dessa meta.   custo real de uma meta feita = saídas dessa meta.
//   fundo geral livre = (todas as entradas − todas as saídas) − o que está guardado nas metas ainda não feitas.
//   O que uma meta não juntou sozinha sai do fundo geral. O que sobra de uma meta feita volta ao fundo geral.
const META_COLS = ["id", "publicar", "prioridade", "estado", "emoji", "titulo", "frase", "grupo", "custo", "data_limite", "feito_em", "nota", "unidade", "preco_unidade", "imagens", "custos_detalhe", "fatura"];
const MOV_COLS = ["data", "tipo", "valor", "destino", "descrição", "como", "quem tratou", "comprovativo", "confirmado", "doador", "contacto", "agradecer em público", "nota"];

function numero(v) { return parseFloat(String(v).replace(/\s/g, "").replace(",", ".")) || 0; }
function dataISO(v) {
  if (v instanceof Date) return Utilities.formatDate(v, "Europe/Lisbon", "yyyy-MM-dd");
  return String(v || "").trim();
}
const r2 = v => Math.round(v * 100) / 100;
function tipoMov(t) {
  t = String(t || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return /^sai/.test(t) ? "saida" : /^pass/.test(t) ? "passagem" : "entrada";
}

function linhasDe(nome) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!aba) return [];
  const linhas = aba.getDataRange().getValues();
  const cab = linhas.shift().map(c => String(c).trim().toLowerCase());
  return linhas.map(l => Object.fromEntries(cab.map((c, i) => [c, l[i]])));
}

function metas() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get("metas");
  if (guardado) return JSON.parse(guardado);
  const lista = linhasDe("metas").filter(m => String(m.id).trim() && sim(m.publicar)).map(m => ({
    id: limpar(m.id, 60), estado: limpar(m.estado, 20).toLowerCase(), prioridade: numero(m.prioridade) || 99,
    emoji: limpar(m.emoji, 8), titulo: limpar(m.titulo, 120), frase: limpar(m.frase, 300), grupo: limpar(m.grupo, 30),
    custo: numero(m.custo), data_limite: dataISO(m.data_limite), feito_em: dataISO(m.feito_em), nota: limpar(m.nota, 200),
    unidade: limpar(m.unidade, 40), preco_unidade: numero(m.preco_unidade),
    imagens: String(m.imagens || "").split(";").map(s => s.trim()).filter(Boolean).map(s => {
      const [src, legenda] = s.split("|").map(x => x.trim());
      return { src, legenda: legenda || "" };
    }).filter(i => /^(img\/|https:\/\/)/.test(i.src)),
    custos_detalhe: String(m.custos_detalhe || "").split(";").map(s => s.trim()).filter(Boolean),
    fatura: /^https:\/\//.test(String(m.fatura || "")) ? String(m.fatura).trim() : "",
    publicar: true,
  }));
  const resultado = calcularMetas(lista, linhasDe("movimentos"));
  cache.put("metas", JSON.stringify(resultado), 60);
  return resultado;
}

// Lê os movimentos confirmados e diz, para cada meta, quanto juntou e quanto custou. Não divide nada sozinho.
function calcularMetas(lista, movimentos) {
  const ent = {}, pas = {}, sai = {}, doadores = {};
  let saldo = 0;
  movimentos.filter(d => sim(d.confirmado) && numero(d.valor) > 0).forEach(d => {
    const t = tipoMov(d.tipo), v = numero(d.valor);
    const dest = String(d.destino || "").trim().toLowerCase() || "geral";
    if (t === "entrada") {
      saldo += v; ent[dest] = (ent[dest] || 0) + v;
      if (dest !== "geral") (doadores[dest] = doadores[dest] || new Set()).add((String(d.doador || d["descrição"] || "anónimo").trim() + "|" + dataISO(d.data)).toLowerCase());
    } else if (t === "saida") { saldo -= v; sai[dest] = (sai[dest] || 0) + v; }
    else pas[dest] = (pas[dest] || 0) + v;
  });
  let guardado = 0;
  lista.forEach(m => {
    const id = m.id.toLowerCase();
    m.angariado = r2((ent[id] || 0) + (pas[id] || 0));
    m.gasto = r2(sai[id] || 0);
    m.apoiantes = doadores[id] ? doadores[id].size : 0;
    if (m.estado !== "feito") guardado += Math.max(0, m.angariado - m.gasto);
  });
  return { metas: lista, fundo_livre: r2(Math.max(0, saldo - guardado)) };
}

// Donativo para uma meta vindo do site. Entra sempre por confirmar: só conta para todos
// depois de a tesoureira marcar "confirmado" (quem pagou já vê a sua parte no próprio browser).
function guardarDoacaoMeta(d) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("movimentos");
  const valor = r2(numero(d.valor));
  if (!aba || !(valor > 0 && valor <= 5000)) return ContentService.createTextOutput("erro");
  const abc = aba.getRange(2, 1, Math.max(1, aba.getLastRow() - 1), 3).getValues();
  let livre = abc.findIndex(r => r.every(c => !String(c).trim()));
  livre = livre === -1 ? aba.getLastRow() + 1 : livre + 2;
  const como = ({ ref: "Multibanco", transf: "Transferência" }[d.metodo] || "MB WAY") + " (site)" + (d.demo ? " · DEMONSTRAÇÃO" : "");
  aba.getRange(livre, 1, 1, MOV_COLS.length).setValues([[new Date(), "entrada", valor, limpar(d.meta, 60), "Donativo pelo site", como, "", "", false,
    limpar(d.nome, 80) || "Anónimo", limpar(d.contacto, 80), d.publico ? "sim" : "não", limpar(d.nota, 200)]]);
  return ContentService.createTextOutput("ok");
}

// Correr UMA vez no editor (▶ criarMovimentos): cria a folha "movimentos" com o que estava em "doacoes_metas"
// e muda o nome da folha antiga para "antigo_doacoes_metas" (pode ser apagada depois).
function criarMovimentos() {
  const folha = SpreadsheetApp.getActiveSpreadsheet();
  if (folha.getSheetByName("movimentos")) return;
  const aba = folha.insertSheet("movimentos", 1);
  const dados = [
    ["2026-09-01", "entrada", "", "geral", "Saldo da conta no fim de 2025/26", "conta", "Liliana", "extrato de 1/9", false, "", "", "", "Falta o valor (relatório de contas da AG)"],
    ["2026-09-01", "entrada", 1200, "geral", "Quotas 2026/27", "transferência / numerário", "Liliana", "", true, "", "", "", "ESTIMATIVA — trocar pelo valor certo"],
    ["2026-09-01", "saída", 430, "geral", "Outras despesas (rifas, roll-up, …)", "", "", "", true, "", "", "", "ESTIMATIVA — separar em linhas, uma por fatura"],
    ["2026-10-31", "entrada", 487.33, "geral", "Halloween: mealheiros dos 7 grupos", "numerário", "Daniela", "", true, "", "", "", "Valor anunciado no grupo a 1/11"],
    ["2026-11-05", "saída", 310, "cinema-2026", "Bilhetes de cinema para as crianças (Esposende 2000)", "", "Daniela", "", true, "", "", "", "ESTIMATIVA — confirmar com a fatura"],
    ["2026-11-09", "entrada", 100, "presentes-natal-2026", "DFB Construções paga parte dos presentes", "paga a fatura ao fornecedor", "Catarina", "", true, "DFB Construções", "", "sim", "Não passa pela conta. Quando houver fatura, juntar também a saída de 100 €"],
    ["2026-11-11", "passagem", 120, "castanhas-2026", "A Direção guarda dinheiro do fundo geral para a assadora", "", "Direção", "", true, "", "", "", "ESTIMATIVA. Quando pagar: juntar a saída com a fatura"],
  ];
  aba.getRange(1, 1, 1, MOV_COLS.length).setValues([MOV_COLS]).setFontWeight("bold").setBackground("#ebce58");
  aba.getRange(2, 1, dados.length, MOV_COLS.length).setValues(dados);
  aba.getRange(2, 9, 300, 1).insertCheckboxes();
  aba.getRange(2, 9, dados.length, 1).setValues(dados.map(d => [d[8]]));
  aba.getRange(2, 2, 300, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["entrada", "saída", "passagem"], true).setAllowInvalid(false).build());
  const ids = linhasDe("metas").map(m => String(m.id).trim()).filter(Boolean);
  aba.getRange(2, 4, 300, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["geral"].concat(ids), true).setAllowInvalid(true).build());
  aba.getRange(2, 3, 300, 1).setNumberFormat("#,##0.00 €");
  aba.getRange(1, 2).setNote("entrada: entra dinheiro\nsaída: sai dinheiro\npassagem: a Direção põe dinheiro do fundo geral numa meta (não mexe no banco)");
  aba.getRange(1, 4).setNote("geral, ou o id de uma meta (folha metas)");
  aba.getRange(1, 9).setNote("Só as linhas confirmadas contam no site");
  aba.setFrozenRows(1);
  const antiga = folha.getSheetByName("doacoes_metas");
  if (antiga) antiga.setName("antigo_doacoes_metas");
  CacheService.getScriptCache().remove("metas");
}
