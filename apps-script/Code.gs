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
// Folha "doacoes_metas": uma linha por movimento. Só contam as linhas com confirmado = sim.
//   tipo "entrada" + meta "geral"   → dinheiro para o fundo geral (Halloween, quotas…).
//   tipo "entrada" + meta = id       → donativo para essa meta (ex.: 100 € da DFB para os presentes).
//   tipo "do fundo geral" + meta = id → a APAEF usa dinheiro do fundo geral nessa meta (sai do fundo).
// O que sobra no fundo geral divide-se pelas metas "a angariar", proporcional ao custo, sem passar o que falta a cada uma.
// Quando uma meta fica feita: juntar uma linha "do fundo geral" com o valor que a APAEF lá pôs, e mudar o estado.
const META_COLS = ["id", "publicar", "prioridade", "estado", "emoji", "titulo", "frase", "grupo", "custo", "data_limite", "feito_em", "nota", "unidade", "preco_unidade", "imagens", "custos_detalhe", "fatura"];
const DOACAO_COLS = ["data", "meta", "tipo", "valor", "origem", "nota", "confirmado"];

function numero(v) { return parseFloat(String(v).replace(/\s/g, "").replace(",", ".")) || 0; }
function dataISO(v) {
  if (v instanceof Date) return Utilities.formatDate(v, "Europe/Lisbon", "yyyy-MM-dd");
  return String(v || "").trim();
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
  const resultado = calcularMetas(lista, linhasDe("doacoes_metas"));
  cache.put("metas", JSON.stringify(resultado), 60);
  return resultado;
}

// Soma as doações de cada meta e divide o fundo geral pelas metas ativas.
function calcularMetas(lista, doacoes) {
  const conf = doacoes.filter(d => sim(d.confirmado) && numero(d.valor) > 0);
  let fundo = 0;
  const porMeta = {}, origens = {};
  conf.forEach(d => {
    const meta = String(d.meta || "").trim().toLowerCase(), tipo = String(d.tipo || "").trim().toLowerCase(), v = numero(d.valor);
    if (!meta || meta === "geral") { fundo += v; return; }
    porMeta[meta] = (porMeta[meta] || 0) + v;
    if (/fundo/.test(tipo)) fundo -= v;
    else (origens[meta] = origens[meta] || new Set()).add(String(d.origem || "anónimo").trim().toLowerCase() + "|" + dataISO(d.data));
  });
  lista.forEach(m => {
    m.angariado = Math.round((porMeta[m.id.toLowerCase()] || 0) * 100) / 100;
    m.apoiantes = origens[m.id.toLowerCase()] ? origens[m.id.toLowerCase()].size : 0;
    m.do_fundo = 0;
  });
  // Divisão proporcional ao custo, sem passar o que falta; o que não cabe numa meta vai para as outras.
  let resto = Math.max(0, fundo);
  for (let volta = 0; volta < 10 && resto > 0.01; volta++) {
    const abertas = lista.filter(m => m.estado === "a angariar" && m.angariado + m.do_fundo < m.custo - 0.01);
    const soma = abertas.reduce((s, m) => s + m.custo, 0);
    if (!soma) break;
    let usado = 0;
    abertas.forEach(m => {
      const falta = m.custo - m.angariado - m.do_fundo;
      const parte = Math.min(falta, resto * m.custo / soma);
      m.do_fundo += parte; usado += parte;
    });
    resto -= usado;
  }
  lista.forEach(m => {
    m.do_fundo = Math.round(m.do_fundo * 100) / 100;
    m.angariado = Math.round((m.angariado + m.do_fundo) * 100) / 100;
  });
  return { metas: lista, fundo_livre: Math.round(resto * 100) / 100 };
}

// Donativo para uma meta vindo do site (MB WAY / Multibanco). Entra sempre por confirmar: só conta na barra
// depois de a tesoureira marcar "confirmado". Não guarda o telemóvel de quem paga.
function guardarDoacaoMeta(d) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("doacoes_metas");
  const valor = Math.round(numero(d.valor) * 100) / 100;
  if (!aba || !(valor > 0 && valor <= 5000)) return ContentService.createTextOutput("erro");
  const ab = aba.getRange(2, 1, Math.max(1, aba.getLastRow() - 1), 2).getValues();
  let livre = ab.findIndex(r => !String(r[0]).trim() && !String(r[1]).trim());
  livre = livre === -1 ? aba.getLastRow() + 1 : livre + 2;
  const origem = "Site · " + ({ ref: "Multibanco", transf: "Transferência" }[d.metodo] || "MB WAY") + (d.demo ? " · DEMONSTRAÇÃO" : "");
  aba.getRange(livre, 1, 1, 6).setValues([[new Date(), limpar(d.meta, 60), "entrada", valor, origem, limpar(d.nota, 200)]]);
  aba.getRange(livre, 7).setValue(false);
  return ContentService.createTextOutput("ok");
}

// Correr UMA vez no editor (▶ criarFolhasMetas) para criar as folhas "metas" e "doacoes_metas" com os dados iniciais.
function criarFolhasMetas() {
  const folha = SpreadsheetApp.getActiveSpreadsheet();
  if (!folha.getSheetByName("metas")) {
    const aba = folha.insertSheet("metas");
    const dados = [["castanhas-2026", true, 0, "garantido", "🌰", "Castanhas assadas no Magusto", "A senhora das castanhas assa para todas as crianças no Magusto da escola.", "Atividades", 50, "", "", "Obrigado a todos! 💛", "", "", "img/magusto-castanhas.jpg", "Serviço da assadora ≈ 50 € ; Carvão: oferta do Supermercado Ramalhão", ""], ["cinema-2026", true, 0, "feito", "🎬", "Um bilhete de cinema para cada criança", "206 crianças ganharam um bilhete para ver um filme de animação à escolha.", "Atividades", 200, "", "2026-11-05", "Obrigado a todos! 💛", "", "", "img/cinema-vouchers.jpg", "206 bilhetes com desconto (Esposende 2000) ≈ 200 €", ""], ["passeio-4ano", true, 1, "a angariar", "🚌", "Passeio dos finalistas", "Um dia especial para os finalistas do 4.º ano, que se despedem da escola.", "Atividades", 800, "", "", "", "lugar no passeio|lugares no passeio", 20, "img/metas/passeio-2.jpg | Ilustração ; img/metas/passeio-1.jpg | Ilustração", "Autocarro 1 dia ≈ 400 € ; Entradas ≈ 10 € × 40 alunos", ""], ["presentes-natal-2026", true, 2, "a angariar", "🎁", "Um presente de Natal para cada criança", "Cada criança da escola recebe um ioiô da Lumi, a nossa mascote, na festa de Natal.", "Natal", 210, "2026-12-04", "", "", "ioiô|ioiôs", 0.7, "img/metas/presentes-entrega.jpg | Ilustração ; img/metas/presentes-ioio.jpg | Ilustração do ioiô da Lumi ; img/metas/presentes-2.jpg | Ilustração", "300 ioiôs personalizados com a Lumi × 0,70 € = 210 € ; Os que sobrarem vendem-se na Feirinha", ""], ["baloico-pre", true, 3, "a angariar", "🛝", "Baloiço de dois lugares para a pré", "O primeiro passo do projeto do recreio: um baloiço novo na caixa de areia da pré. O dinheiro das rifas de S. Martinho vai para aqui.", "Recreio", 3248, "", "", "", "", "", "img/metas/baloico-pre-simulacao.jpg | Simulação ; img/metas/baloico-pre.jpg | O baloiço (Greenplay)", "Baloiço Greenplay PO732 (2 assentos) 2 798 € ; Transporte 450 € ; Montagem: oferta da Greenplay", ""], ["areia-2026", true, 4, "a seguir", "🏖️", "Areia nova para a caixa do parque", "Repor a areia da caixa onde vai ficar o baloiço da pré.", "Recreio", 350, "", "", "", "", "", "img/metas/areia-1.jpg | Ilustração", "≈ 5 m³ de areia lavada + transporte ≈ 350 € (vamos pedir à Junta)", ""], ["estrutura-1ciclo", true, 5, "a seguir", "🧗", "Escorrega e parede de escalada para o 1.º ciclo", "Uma estrutura com escorrega, escalada e barras para o recreio do 1.º ciclo.", "Recreio", 4744, "", "", "", "", "", "img/metas/estrutura-simulacao.jpg | Simulação ; img/metas/estrutura-1ciclo.jpg | A estrutura (Greenplay)", "Estrutura Greenplay ≈ 4 744 €", ""], ["arvores-2027", true, 6, "a seguir", "🌳", "10 árvores para dar sombra ao recreio", "Uma árvore por turma, plantada no Dia da Árvore (19 de março).", "Recreio", 600, "", "", "", "árvore|árvores", 60, "img/metas/arvores-simulacao.jpg | Simulação ; img/metas/arvores-plantacao.jpg | Ilustração", "10 árvores de 2–3 m × ≈ 60 € (com tutor e terra)", ""], ["insuflaveis-2027", true, 7, "a seguir", "🎈", "Insufláveis no Dia da Criança", "Dois insufláveis no recreio a 1 de junho.", "Atividades", 350, "", "", "", "", "", "", "2 insufláveis, 1 dia, com montagem ≈ 350 €", ""]];
    aba.getRange(1, 1, 1, META_COLS.length).setValues([META_COLS]).setFontWeight("bold");
    aba.getRange(2, 1, dados.length, META_COLS.length).setValues(dados);
    aba.getRange(2, 2, dados.length, 1).insertCheckboxes();
    aba.setFrozenRows(1);
  }
  if (!folha.getSheetByName("doacoes_metas")) {
    const aba = folha.insertSheet("doacoes_metas");
    const dados = [
      ["2026-10-31", "geral", "entrada", 487.33, "Halloween (mealheiros)", "Valor anunciado pela Daniela a 1/11", true],
      ["", "geral", "entrada", "", "Quotas 2026/27", "Falta o valor (Liliana)", false],
      ["2026-11-09", "presentes-natal-2026", "entrada", 100, "DFB Construções (via Catarina)", "Paga a fatura diretamente ao fornecedor", true],
      ["2026-11-05", "cinema-2026", "do fundo geral", 200, "APAEF", "Valor estimado: confirmar com a fatura", true],
      ["2026-11-11", "castanhas-2026", "do fundo geral", 50, "APAEF", "Valor estimado: confirmar com a fatura", true],
    ];
    aba.getRange(1, 1, 1, DOACAO_COLS.length).setValues([DOACAO_COLS]).setFontWeight("bold");
    aba.getRange(2, 1, dados.length, DOACAO_COLS.length).setValues(dados);
    aba.getRange(2, 7, 200, 1).insertCheckboxes();
    aba.setFrozenRows(1);
  }
}
