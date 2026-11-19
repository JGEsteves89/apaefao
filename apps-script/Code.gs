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
  if (dados.evento === "ementa_voto") return guardarVotoEmenta(dados);
  limparCache();
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
  "contacto", "nif", "quem preencheu", "quem conseguiu", "aceita aparecer", "data"];

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

// Donativo para uma meta vindo do site (MB WAY / Multibanco). Entra sempre por confirmar: só conta na barra
// depois de a tesoureira marcar "confirmado". Não guarda o telemóvel de quem paga.
function guardarDoacaoMeta(d) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("doacoes_metas");
  const valor = Math.round(numero(d.valor) * 100) / 100;
  if (!aba || !(valor > 0 && valor <= 5000)) return ContentService.createTextOutput("erro");
  const ab = aba.getRange(2, 1, Math.max(1, aba.getLastRow() - 1), 2).getValues();
  let livre = ab.findIndex(r => !String(r[0]).trim() && !String(r[1]).trim());
  livre = livre === -1 ? aba.getLastRow() + 1 : livre + 2;
  const via = "Site · " + ({ ref: "Multibanco", transf: "Transferência" }[d.metodo] || "MB WAY") + (d.demo ? " · DEMONSTRAÇÃO" : "");
  const nome = limpar(d.nome, 80);
  const origem = (nome || "Anónimo") + " (" + via + ")";
  if (!String(aba.getRange(1, 8).getValue()).trim()) aba.getRange(1, 8, 1, 2).setValues([["contacto", "agradecer em público"]]).setFontWeight("bold");
  aba.getRange(livre, 1, 1, 6).setValues([[new Date(), limpar(d.meta, 60), "entrada", valor, origem, limpar(d.nota, 200)]]);
  aba.getRange(livre, 7).setValue(false);
  aba.getRange(livre, 8, 1, 2).setValues([[limpar(d.contacto, 80), d.publico ? "sim" : "não"]]);
  return ContentService.createTextOutput("ok");
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

// Nível no jardim (jardim.html): pelo total do ano. O valor nunca sai da Sheet.
function nivelApoiante(valor) {
  const v = parseFloat(String(valor).replace(",", ".")) || 0;
  return v >= 250 ? "sol" : v >= 100 ? "girassol" : v >= 25 ? "flor" : "botao";
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
    nome: c.nome, tipo: c.tipo, tamanho: tamanhoApoiante(c.valor), nivel: nivelApoiante(c.valor), logo: c.logo, maps_url: c.maps_url, publicar: true,
  }));
  cache.put("apoiantes", JSON.stringify(lista), 21600);
  return lista;
}

function doGet(e) {
  if (e && e.parameter && e.parameter.acao === "resultados") return json(resultados());
  if (e && e.parameter && e.parameter.acao === "responsaveis") return json(responsaveis());
  if (e && e.parameter && e.parameter.acao === "apoiantes") return json(apoiantes());
  if (e && e.parameter && e.parameter.acao === "metas") return json(metas());
  if (e && e.parameter && e.parameter.acao === "site") return json(site());
  if (e && e.parameter && e.parameter.acao === "avisos") return json(avisos());
  if (e && e.parameter && e.parameter.acao === "ementa_votos") return json(votosEmenta(e.parameter.semana));
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
  cache.put("metas", JSON.stringify(resultado), 21600);
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

// ===== Site: todos os dados do site vêm desta Google Sheet (16/11/2026). =====
// O site pede ?acao=site e recebe: agenda, calendario, noticias, documentos, links, orgaos, recreio.
// Cada parte é uma folha: uma linha por item, a 1.ª linha tem os nomes das colunas.
// Regras para quem edita a Sheet:
//  - sim/não: escrever "sim" (ou deixar vazio).
//  - Listas (fotos, ordem de trabalhos, projetos): um item por linha dentro da célula (Alt+Enter);
//    partes de cada item separadas por " | ". Ex. fotos: img/foto.jpg | Legenda da foto
//  - Linha com "publicar" = não → não aparece.

const SITE_FOLHAS = {
  agenda: "agenda", calendario: "calendario", noticias: "noticias", documentos: "documentos", links: "links",
  orgaos: "orgaos", representantes: "representantes",
  recreio_areas: "recreio_areas", recreio_fases: "recreio_fases", recreio_zonas: "recreio_zonas"
};
const SITE_LISTAS = { imagens: ["src", "legenda"], ordem: null, linhas: null, projetos: ["id", "emoji", "titulo", "custo", "peca", "pecas", "imagem"] };
const SITE_SIM_NAO = ["confirmar", "destaque", "publicar", "rascunho", "largo"];
const SITE_NUMEROS = ["duracao", "num", "x", "y", "custo", "pecas"];

function site() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get("site");
  if (guardado) return JSON.parse(guardado);
  const ler = nome => siteLinhas(SITE_FOLHAS[nome]);
  const orgaos = [];
  ler("orgaos").forEach(l => {
    let o = orgaos.find(x => x.nome === l.orgao);
    if (!o) orgaos.push(o = { nome: l.orgao, membros: [] });
    o.membros.push({ cargo: l.cargo || "", nome: l.nome || "", publicar: l.publicar !== false });
  });
  const dados = {
    agenda: ler("agenda"),
    calendario: ler("calendario"),
    noticias: ler("noticias"),
    documentos: ler("documentos"),
    links: ler("links"),
    orgaos: { orgaos: orgaos, representantes: ler("representantes").map(l => ({ turma: l.turma || "", nome: l.nome || "", publicar: l.publicar !== false })) },
    recreio: { areas: ler("recreio_areas"), fases: ler("recreio_fases"), zonas: ler("recreio_zonas") }
  };
  dados.metas = metas();
  dados.apoiantes = apoiantes();
  cache.put("site", JSON.stringify(dados), 21600);
  return dados;
}

function siteLinhas(nome) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!aba || aba.getLastRow() < 2) return [];
  const valores = aba.getDataRange().getValues();
  const cab = valores[0].map(c => String(c).trim());
  return valores.slice(1).filter(l => l.some(v => v !== "")).map(l => {
    const o = {};
    cab.forEach((c, i) => {
      if (!c) return;
      let v = l[i];
      if (v instanceof Date) v = Utilities.formatDate(v, "Europe/Lisbon", "yyyy-MM-dd");
      if (SITE_SIM_NAO.indexOf(c) >= 0) { if (v !== "") o[c] = sim(v); return; }
      if (v === "" || v === null) return;
      if (SITE_NUMEROS.indexOf(c) >= 0) { o[c] = numero(v); return; }
      if (c in SITE_LISTAS) {
        const partes = SITE_LISTAS[c];
        o[c] = String(v).split("\n").map(s => s.trim()).filter(Boolean).map(s => {
          if (!partes) return s;
          const p = s.split("|").map(x => x.trim()), item = {};
          partes.forEach((k, n) => { if (p[n]) item[k] = SITE_NUMEROS.indexOf(k) >= 0 ? numero(p[n]) : p[n]; });
          return item;
        });
        return;
      }
      o[c] = String(v);
    });
    if (o.publicar === false) return null;
    return o;
  }).filter(Boolean);
}

// Só uma vez: copiar os dados que estavam no site (data/*.json) para folhas novas. Não apaga nada.
function importarSite() {
  const url = n => JSON.parse(UrlFetchApp.fetch("https://apaefao.pt/data/" + n + ".json?x=" + Date.now()).getContentText());
  const rec = url("recreio"), org = url("orgaos");
  const orgLinhas = [];
  org.orgaos.forEach(o => o.membros.forEach(m => orgLinhas.push({ orgao: o.nome, cargo: m.cargo, nome: m.nome, publicar: m.publicar })));
  const partes = {
    agenda: url("agenda"), noticias: url("noticias"), documentos: url("documentos"), links: url("links"),
    orgaos: orgLinhas, representantes: org.representantes,
    recreio_areas: rec.areas, recreio_fases: rec.fases, recreio_zonas: rec.zonas
  };
  const livro = SpreadsheetApp.getActiveSpreadsheet(), feito = [];
  Object.keys(partes).forEach(nome => {
    if (livro.getSheetByName(nome)) { feito.push(nome + ": já existia, saltei"); return; }
    const lista = partes[nome], cab = [];
    lista.forEach(o => Object.keys(o).forEach(k => { if (cab.indexOf(k) < 0) cab.push(k); }));
    const linhas = lista.map(o => cab.map(k => siteCelula(k, o[k])));
    const aba = livro.insertSheet(nome);
    aba.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight("bold");
    if (linhas.length) aba.getRange(2, 1, linhas.length, cab.length).setNumberFormat("@").setValues(linhas);
    aba.setFrozenRows(1);
    feito.push(nome + ": " + linhas.length + " linhas");
  });
  CacheService.getScriptCache().remove("site");
  Logger.log(feito.join("\n"));
}

function siteCelula(k, v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (Array.isArray(v)) {
    const partes = SITE_LISTAS[k];
    return v.map(i => typeof i === "object" ? (partes || Object.keys(i)).map(p => i[p] === undefined ? "" : i[p]).join(" | ") : String(i)).join("\n");
  }
  return String(v);
}

// Ajuda: lista as folhas (nome, linhas, colunas e cabeçalho).
function listarFolhas() {
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(a => {
    const c = a.getLastColumn();
    const cab = c ? a.getRange(1, 1, 1, c).getValues()[0].join(", ") : "";
    const ult = a.getLastRow() > 1 ? a.getRange(a.getLastRow(), 1, 1, Math.min(c, 4)).getDisplayValues()[0].join(" ; ") : "";
    Logger.log(a.getName() + " [" + (a.getLastRow() - 1) + " linhas" + (a.isSheetHidden() ? ", escondida" : "") + "] " + cab + "  ||  última: " + ult.slice(0, 120));
  });
}


// ===== Arrumar a Sheet (16/11/2026): página "Início", estilo das tabelas e notas em cada coluna. =====
// Correr "arrumarSheet" sempre que se junta uma folha ou coluna nova (não mexe nos dados).
// As notas aparecem ao passar o rato pelo cabeçalho (triângulo preto no canto da célula).

const FOLHAS_INFO = [
  ["agenda", "Site", "Atividades do ano. Página Agenda e 'A seguir' na página inicial.", "Direção (à mão)"],
  ["calendario", "Site", "Datas da escola: períodos, férias, feriados e dias temáticos. Página Calendário.", "Direção (à mão)"],
  ["noticias", "Site", "Notícias do site, com fotos.", "Direção (à mão)"],
  ["documentos", "Site", "Convocatórias, atas, estatutos e documentos do Agrupamento.", "Direção (à mão)"],
  ["links", "Site", "Página 'Links úteis' (portais da escola, contactos).", "Direção (à mão)"],
  ["avisos", "Site", "Avisos urgentes: barra no topo de todas as páginas + cartão na página inicial. Uma linha = uma atualização.", "Direção (à mão)"],
  ["orgaos", "Site", "Órgãos sociais (Direção, AG, Conselho Fiscal). Página Quem somos.", "Direção (à mão)"],
  ["representantes", "Site", "Representantes de cada turma. Página Quem somos.", "Direção (à mão)"],
  ["recreio_areas", "Recreio", "Comparação 'Hoje / O projeto' no topo da página do recreio.", "Direção (à mão)"],
  ["recreio_zonas", "Recreio", "Os números do mapa do recreio (uma linha por zona).", "Direção (à mão)"],
  ["recreio_fases", "Recreio", "As fases do projeto do recreio e o que entra em cada uma.", "Direção (à mão)"],
  ["metas", "Dinheiro", "Metas de angariação (página Metas). O valor angariado vem de 'movimentos'.", "Direção (à mão)"],
  ["movimentos", "Dinheiro", "Todo o dinheiro que entra e sai. É a base das metas e da transparência.", "Tesoureira + site (donativos)"],
  ["apoiantes", "Pessoas", "Empresas e amigos que apoiam. Página Apoiantes e formulário 'Quero oferecer algo'.", "Direção + formulário do site"],
  ["socios", "Pessoas", "Fichas de sócio enviadas pelo site. DADOS PESSOAIS: não partilhar.", "Formulário do site"],
  ["sugestoes", "Pessoas", "Sugestões e reclamações enviadas pelo site.", "Formulário do site"]
];

const NOTAS = {
  agenda: {
    fim: "Último dia da atividade (AAAA-MM-DD). Depois deste dia fica esbatida no site.",
    quando: "Texto da data como aparece no site. Ex.: Sábado, 14 nov · 15h",
    etiqueta: "Pequena etiqueta ao lado da data. Ex.: novo!, adiado",
    confirmar: "sim = a etiqueta fica em amarelo (data ainda por confirmar).",
    titulo: "Nome da atividade.",
    texto: "Uma ou duas frases sobre a atividade.",
    imagem: "Foto principal (ficheiro na pasta img/ do site). Ex.: img/magusto.jpg",
    alt: "Descrição da foto, para quem não vê (leitores de ecrã).",
    emoji: "Emoji mostrado quando não há foto.",
    imagens: "Fotos depois da atividade (galeria). Uma por linha (Alt+Enter): img/foto.jpg | Legenda"
  },
  noticias: {
    titulo: "Título da notícia.",
    data: "Data da notícia (AAAA-MM-DD). As mais recentes aparecem primeiro.",
    texto: "Texto da notícia. Sem valores em dinheiro.",
    imagem: "Foto principal (img/…). Sem caras de crianças.",
    alt: "Descrição da foto principal.",
    imagens: "Galeria. Uma foto por linha (Alt+Enter): img/foto.jpg | Legenda",
    id: "Identificador curto e único (sem espaços). Ex.: halloween-2026",
    link: "Link extra no fim da notícia (opcional).",
    link_texto: "Texto do botão do link. Ex.: Ver o vídeo"
  },
  documentos: {
    id: "Identificador curto e único (sem espaços).",
    titulo: "Nome do documento.",
    tipo: "convocatoria, ata, estatutos, agrupamento…",
    data: "Data (AAAA-MM-DD).",
    hora: "Hora da reunião (só convocatórias). Ex.: 21h00",
    duracao: "Duração em minutos (só convocatórias).",
    local: "Local da reunião.",
    resumo: "Uma frase sobre o documento.",
    ordem: "Ordem de trabalhos: um ponto por linha (Alt+Enter).",
    nota: "Nota extra (opcional).",
    ficheiro: "Ficheiro (docs/…) ou link para o documento.",
    destaque: "sim = aparece em destaque na página inicial.",
    rascunho: "sim = ainda não é a versão final.",
    inicio: "Calendário: 1.º dia da atividade (AAAA-MM-DD). Vazio + 'mes' = dia a definir.",
    mes: "Calendário: só o mês (AAAA-MM), quando ainda não há dia. Ex.: 2027-01",
    curto: "Calendário: nome curto para a grelha (opcional)."
  },
  calendario: {
    tipo: "periodo, ferias, feriado ou escola (dia temático da escola).",
    inicio: "1.º dia (AAAA-MM-DD).",
    fim: "Último dia (AAAA-MM-DD). Vazio = o mesmo dia.",
    nome: "Nome. Ex.: Férias de Natal",
    curto: "Nome curto para a grelha (opcional).",
    emoji: "Um emoji. Ex.: 🎄",
    texto: "Frase curta (opcional).",
    confirmar: "sim = data ainda por confirmar.",
    publicar: "não = não aparece no site."
  },
  avisos: {
    atualizado: "Data e hora desta atualização. Ex.: 20/11/2026 09:20",
    titulo: "Nome do aviso. Mesmo título = mesmo aviso (as linhas antigas aparecem em 'Antes').",
    texto: "O que os pais precisam de saber (1–2 frases).",
    nivel: "urgente = vermelho. Vazio ou info = amarelo.",
    quando: "Opcional. Ex.: Sexta, 20 de novembro",
    ate: "O aviso desaparece às 00:00 deste dia. Ex.: 21/11/2026",
    fonte: "Opcional. Ex.: Escola"
  },
  links: {
    titulo: "Nome do link.",
    descricao: "Uma frase sobre para que serve.",
    url: "Endereço completo (https://… ou mailto:…).",
    icone: "Emoji do link.",
    categoria: "Grupo onde aparece na página Links.",
    linhas: "Texto extra: uma linha por parágrafo (Alt+Enter).",
    largo: "sim = o cartão ocupa a largura toda."
  },
  orgaos: {
    orgao: "Direção, Assembleia Geral ou Conselho Fiscal.",
    cargo: "Cargo da pessoa.",
    nome: "Nome como aparece no site.",
    publicar: "não = não aparece no site."
  },
  representantes: {
    turma: "Turma ou sala. Ex.: 1.º A, Pré Sala D",
    nome: "Nome do representante.",
    publicar: "não = não aparece no site."
  },
  recreio_areas: {
    titulo: "Nome da zona. Ex.: Recreio da pré",
    frase: "Uma frase sobre o que muda.",
    hoje: "Foto de hoje (img/metas/recreio/…).",
    projeto: "Imagem da simulação do projeto (mesmo ângulo da foto de hoje)."
  },
  recreio_zonas: {
    num: "Número no mapa (1, 2, 3…).",
    grupo: "Pré-escolar ou 1.º ciclo.",
    titulo: "Nome da zona.",
    frase: "O que vamos fazer nesta zona.",
    nota: "Nota curta por cima do texto (opcional).",
    projeto: "Imagem da simulação.",
    x: "Posição do número no mapa, da esquerda (0 a 100 %).",
    y: "Posição do número no mapa, de cima (0 a 100 %).",
    hoje: "Foto de hoje desta zona."
  },
  recreio_fases: {
    titulo: "Nome da fase. Ex.: Fase 1 · Pré-escolar",
    hoje: "Foto de hoje.",
    projeto: "Imagem do projeto.",
    projetos: "O que entra nesta fase, um por linha: id | emoji | título | custo | peça | n.º de peças | imagem da peça"
  },
  metas: {
    id: "Identificador único (sem espaços). Liga a meta aos movimentos (coluna destino).",
    publicar: "Desmarcar = a meta não aparece no site.",
    prioridade: "Ordem no site: 1 aparece primeiro.",
    estado: "a angariar · a seguir · garantido · feito",
    emoji: "Emoji da meta.",
    titulo: "Nome da meta.",
    frase: "Uma frase sobre a meta.",
    grupo: "Atividades, Recreio ou Natal (filtros da página).",
    custo: "Custo total em euros (só o número).",
    data_limite: "Data limite (AAAA-MM-DD), se houver.",
    feito_em: "Data em que foi feito (para metas 'feito').",
    nota: "Nota mostrada quando está feita. Ex.: Obrigado a todos!",
    unidade: "Nome de cada parte: singular|plural. Ex.: lugar no passeio|lugares no passeio",
    preco_unidade: "Preço de cada parte, em euros.",
    imagens: "Fotos (JSON ou uma por linha).",
    custos_detalhe: "Lista de custos que aparece em 'Ver custos'.",
    fatura: "Link para a fatura (quando está feito)."
  },
  movimentos: {
    data: "Data do movimento.",
    tipo: "entrada · saída · passagem",
    valor: "Valor em euros (sempre positivo).",
    destino: "id da meta (ver folha metas) ou vazio = fundo geral.",
    "descrição": "O que foi.",
    como: "MB WAY, transferência, dinheiro…",
    "quem tratou": "Quem da APAEF tratou.",
    comprovativo: "Link para o comprovativo/fatura.",
    confirmado: "Marcar quando a tesoureira confirmou o valor.",
    doador: "Quem deu (se for um donativo).",
    contacto: "Contacto do doador (privado).",
    "agradecer em público": "sim = pode aparecer o nome no site.",
    nota: "Nota interna."
  },
  apoiantes: {
    publicar: "Marcar = aparece no site.",
    nome: "Nome da empresa ou pessoa.",
    "tipo de negócio": "Ex.: café, farmácia, ginásio.",
    foto: "Logótipo/foto (img/apoiantes/…).",
    link: "Site, Facebook ou Google Maps.",
    oferta: "O que ofereceu.",
    "tipo de oferta": "produto, serviço, dinheiro, voucher…",
    "valor estimado €": "Valor aproximado. Define o tamanho do cartão no site (não aparece o valor).",
    para: "Para que atividade (rifas, cabaz, magusto…).",
    validade: "Validade do voucher, se houver.",
    "quem faz o voucher": "APAEF ou a empresa.",
    "empresa ou particular": "empresa · particular",
    onde: "Morada ou localidade.",
    contacto: "Contacto (privado, não vai para o site).",
    nif: "NIF, para a fatura/recibo (privado).",
    "quem preencheu": "Quem preencheu o formulário.",
    "quem conseguiu": "Quem da APAEF conseguiu o apoio.",
    "aceita aparecer": "não = não aparece no site.",
    data: "Data em que entrou.",
    "prémio usado": "Para onde foi o prémio (rifas, cabaz…)."
  },
  socios: {
    timestamp: "Quando a ficha foi enviada (automático).",
    aluno: "Nome do aluno.", turma: "Turma ou sala.", encarregado: "Encarregado de educação.",
    telefone: "Telefone (privado).", email: "Email (privado).", recibo: "Quer recibo?",
    nif: "NIF para o recibo.", reciboEmail: "Email para o recibo.", imagem: "Autoriza fotos do filho/a?",
    rgpd: "Aceitou a política de dados (obrigatório)."
  },
  sugestoes: {
    timestamp: "Quando foi enviada (automático).", tema: "Cantina, Recreio, Atividades, Transporte, Outro.",
    mensagem: "A sugestão ou reclamação.", nome: "Nome (opcional).", email: "Email (opcional).",
    resposta: "TRUE = a pessoa quer resposta."
  }
};

function arrumarSheet() {
  const livro = SpreadsheetApp.getActiveSpreadsheet();
  FOLHAS_INFO.forEach(([nome]) => {
    const aba = livro.getSheetByName(nome);
    if (!aba || aba.getLastColumn() === 0) return;
    const nc = aba.getLastColumn(), nl = Math.max(aba.getLastRow(), 2);
    const cab = aba.getRange(1, 1, 1, nc);
    aba.getBandings().forEach(b => b.remove());
    aba.getRange(1, 1, nl, nc).applyRowBanding(SpreadsheetApp.BandingTheme.YELLOW, true, false);
    cab.setFontWeight("bold").setBackground("#f6d55c").setFontColor("#1f1a14").setVerticalAlignment("middle").setWrap(true);
    aba.setRowHeight(1, 34);
    aba.setFrozenRows(1);
    aba.getRange(2, 1, nl - 1, nc).setVerticalAlignment("top").setWrap(true);
    const notas = NOTAS[nome] || {};
    cab.getValues()[0].forEach((c, i) => {
      const n = notas[String(c).trim()];
      aba.getRange(1, i + 1).setNote(n || "");
      aba.setColumnWidth(i + 1, /texto|frase|resumo|descri|mensagem|oferta|projetos|imagens/.test(c) ? 320 : 150);
    });
  });
  inicio(livro);
  CacheService.getScriptCache().remove("site");
}

function inicio(livro) {
  const aba = livro.getSheetByName("Início") || livro.insertSheet("Início", 0);
  livro.setActiveSheet(aba); livro.moveActiveSheet(1);
  aba.getBandings().forEach(b => b.remove());
  aba.clear();
  aba.getRange("A1").setValue("APAEF — dados do site").setFontSize(18).setFontWeight("bold");
  aba.getRange("A2:E2").merge().setValue("Esta Sheet é a ÚNICA fonte de dados do site apaefao.pt. Muda aqui e o site atualiza em ~1 minuto. Passa o rato pelo cabeçalho de cada folha para ver o que vai em cada coluna.").setWrap(true);
  aba.setRowHeight(2, 44);
  const linhas = [["Folha", "Grupo", "Para quê", "Quem escreve", "Linhas"]];
  FOLHAS_INFO.forEach(([nome, grupo, para, quem]) => {
    const f = livro.getSheetByName(nome);
    if (!f) return;
    linhas.push(['=HYPERLINK("#gid=' + f.getSheetId() + '","' + nome + '")', grupo, para, quem, Math.max(0, f.getLastRow() - 1)]);
  });
  aba.getRange(4, 1, linhas.length, 5).setValues(linhas).setVerticalAlignment("middle").setWrap(true);
  aba.getRange(4, 1, linhas.length, 5).applyRowBanding(SpreadsheetApp.BandingTheme.YELLOW, true, false);
  aba.getRange(4, 1, 1, 5).setFontWeight("bold").setBackground("#f6d55c");
  aba.getRange(5, 1, linhas.length - 1, 1).setFontWeight("bold");
  [160, 100, 460, 200, 70].forEach((w, i) => aba.setColumnWidth(i + 1, w));
  const r = 6 + linhas.length;
  aba.getRange(r, 1, 4, 1).setValues([["Regras"], ["• sim/não: escrever sim (ou deixar vazio)."], ["• Listas numa célula (fotos, pontos): um item por linha com Alt+Enter; partes separadas por | (ex.: img/foto.jpg | Legenda)."], ["• Fotos: o ficheiro tem de estar na pasta img/ do site. Sem caras de crianças."]]);
  aba.getRange(r, 1).setFontWeight("bold");
}

// Volta a copiar só a folha recreio_fases (faltavam as peças). Só uma vez.
function corrigirFases() {
  const livro = SpreadsheetApp.getActiveSpreadsheet();
  const f = livro.getSheetByName("recreio_fases");
  if (f) livro.deleteSheet(f);
  importarSite();
}

// Cache de 6 horas: limpa-se sempre que alguém edita a Sheet (onEdit) ou o site envia um formulário (doPost).
function limparCache() {
  CacheService.getScriptCache().removeAll(["site", "metas", "apoiantes", "avisos"]);
}
function onEdit(e) { limparCache(); }

// Limpeza de 16/11/2026: verifica e apaga folhas antigas. VERIFICAR=true só mostra o que faria.
function verificarLimpeza() { limpezaAntiga(true); }
function fazerLimpeza() { limpezaAntiga(false); }
function limpezaAntiga(soVer) {
  const livro = SpreadsheetApp.getActiveSpreadsheet(), log = [];
  const chave = (n, o) => (String(n || "").trim() + "|" + String(o || "").trim()).toLowerCase();
  // 1) donativos: só apaga se todas as linhas com nome/oferta já estão em apoiantes
  const don = livro.getSheetByName("donativos");
  let donOk = false;
  if (don) {
    const ap = abaApoiantes().getDataRange().getValues(); const cabA = ap.shift().map(c => String(c).trim().toLowerCase());
    const iN = cabA.indexOf("nome"), iO = cabA.indexOf("oferta");
    const existe = new Set(ap.map(l => chave(l[iN], l[iO])));
    const nomes = new Set(ap.map(l => String(l[iN]).trim().toLowerCase()));
    const dl = don.getDataRange().getValues(); const cabD = dl.shift().map(c => String(c).trim());
    const dN = cabD.indexOf("nome"), dO = cabD.indexOf("oferta");
    const reais = dl.filter(l => String(l[dN] || l[dO] || "").trim());
    const falta = reais.filter(l => !existe.has(chave(l[dN], l[dO])) && !nomes.has(String(l[dN]).trim().toLowerCase()));
    donOk = falta.every(l => !String(l[dN]).trim());   // só linhas sem nome (lixo) em falta
    log.push("donativos: " + reais.length + " ofertas; em falta nos apoiantes: " + falta.length + (falta.length ? " -> " + falta.map(l => l[dN] + " (" + l[dO] + ")").join("; ") : ""));
  }
  // 2) folhas a apagar
  const apagar = ["antigo_doacoes_metas", "votacao", "ideias", "responsaveis"].concat(donOk ? ["donativos"] : []);
  apagar.forEach(n => { const f = livro.getSheetByName(n); if (!f) return;
    const cheias = f.getDataRange().getValues().slice(1).filter(l => l.some(v => v !== "" && v !== false)).length;
    log.push((soVer ? "apagaria " : "apaguei ") + n + " (" + cheias + " linhas com dados)");
    if (!soVer) livro.deleteSheet(f); });
  // 3) sugestoes: linha de teste
  const sug = livro.getSheetByName("sugestoes");
  if (sug) { const v = sug.getDataRange().getValues();
    for (let i = v.length - 1; i >= 1; i--) if (/\(Teste\)/i.test(String(v[i].join(" ")))) { log.push((soVer ? "apagaria" : "apaguei") + " sugestão de teste: " + v[i][2]); if (!soVer) sug.deleteRow(i + 1); } }
  // 4) movimentos: linhas vazias no fim
  const mov = livro.getSheetByName("movimentos");
  if (mov) { const v = mov.getDataRange().getValues(); let ult = 1;
    v.forEach((l, i) => { if (i && l.some(x => x !== "" && x !== false)) ult = i + 1; });
    const max = mov.getMaxRows(), vazias = max - Math.max(ult, 1) - 20;
    log.push("movimentos: " + (ult - 1) + " linhas com dados; " + (soVer ? "apagaria " : "apaguei ") + Math.max(0, vazias) + " linhas vazias (ficam 20 livres)");
    if (!soVer && vazias > 0) mov.deleteRows(ult + 21, vazias); }
  if (!soVer) { limparCache(); arrumarSheet(); }
  Logger.log(log.join("\n"));
}

// ---------- Ementa da cantina: 👍/👎 (página ementa.html, 18/11/2026) ----------
// Folha "ementa_votos": uma linha por telemóvel (voterId) e por dia. Votar outra vez muda o voto.
// Aceita dias até 7 dias para trás e até 7 dias para a frente (pode votar-se nos dias da semana que aí vêm).
function abaEmentaVotos() {
  const folha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = folha.getSheetByName("ementa_votos") || folha.insertSheet("ementa_votos");
  if (aba.getLastRow() === 0) aba.appendRow(["timestamp", "data", "voto", "prato", "proteina", "voterId"]);
  return aba;
}

function guardarVotoEmenta(dados) {
  const data = String(dados.data || "");
  const voto = Number(dados.voto);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || (voto !== 1 && voto !== -1) || !dados.voterId) return json({ ok: false, erro: "dados" });
  const ate = Utilities.formatDate(new Date(Date.now() + 7 * 864e5), "Europe/Lisbon", "yyyy-MM-dd");
  const desde = Utilities.formatDate(new Date(Date.now() - 7 * 864e5), "Europe/Lisbon", "yyyy-MM-dd");
  if (data > ate || data < desde) return json({ ok: false, erro: "data" });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const aba = abaEmentaVotos();
    const id = limpar(dados.voterId, 60);
    const linha = [new Date(), "'" + data, voto, limpar(dados.prato, 200), limpar(dados.proteina, 20), id];
    const valores = aba.getLastRow() > 1 ? aba.getRange(2, 2, aba.getLastRow() - 1, 5).getDisplayValues() : [];
    const i = valores.findIndex(r => r[0] === data && r[4] === id);
    if (i >= 0) aba.getRange(i + 2, 1, 1, linha.length).setValues([linha]);
    else aba.appendRow(linha);
  } finally {
    lock.releaseLock();
  }
  CacheService.getScriptCache().remove("ementa_votos");
  return json({ ok: true });
}

// Totais por dia de uma semana: { "2026-11-16": { up: 30, down: 7 }, ... }. Sem nomes nem ids.
function votosEmenta(semana) {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get("ementa_votos");
  const todos = guardado ? JSON.parse(guardado) : contarVotosEmenta();
  if (!guardado) cache.put("ementa_votos", JSON.stringify(todos), 300);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(semana || ""))) return todos;
  const r = {}, inicio = new Date(semana + "T12:00:00Z");
  for (let n = 0; n < 7; n++) {
    const d = Utilities.formatDate(new Date(inicio.getTime() + n * 864e5), "UTC", "yyyy-MM-dd");
    if (todos[d]) r[d] = todos[d];
  }
  return r;
}

function contarVotosEmenta() {
  const aba = abaEmentaVotos(), r = {};
  if (aba.getLastRow() < 2) return r;
  aba.getRange(2, 2, aba.getLastRow() - 1, 2).getDisplayValues().forEach(([data, voto]) => {
    if (!data) return;
    const t = r[data] = r[data] || { up: 0, down: 0 };
    if (Number(voto) === 1) t.up++; else if (Number(voto) === -1) t.down++;
  });
  return r;
}

// ---------- Avisos urgentes (barra em todas as páginas + cartão na página inicial, 18/11/2026) ----------
// Aba "avisos": uma linha = uma atualização. Linhas com o mesmo título = o mesmo aviso.
// Colunas: atualizado | titulo | texto | nivel (urgente/info) | quando | ate | fonte
// O aviso desaparece às 00:00 do dia "ate" (Lisboa). Cache de só 60 s (não entra no ?acao=site, que guarda 6 h).
function avisos() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get("avisos");
  if (guardado) return JSON.parse(guardado);
  const hoje = Utilities.formatDate(new Date(), "Europe/Lisbon", "yyyy-MM-dd");
  const grupos = {};
  linhasDe("avisos").forEach(l => {
    const hora = dataAviso(l.atualizado, true), titulo = limpar(l.titulo, 80), texto = limpar(l.texto, 400);
    if (!hora || !titulo || !texto) return;
    const chave = titulo.toLowerCase();
    (grupos[chave] = grupos[chave] || []).push({ hora, titulo, texto, l });
  });
  const lista = Object.keys(grupos).map(k => {
    const g = grupos[k].sort((a, b) => a.hora < b.hora ? 1 : -1), novo = g[0].l;
    return {
      titulo: g[0].titulo,
      nivel: String(novo.nivel || "").trim().toLowerCase() === "urgente" ? "urgente" : "info",
      quando: limpar(novo.quando, 80),
      ate: dataAviso(novo.ate, false),
      fonte: limpar(novo.fonte, 60),
      atualizacoes: g.map(x => ({ hora: x.hora, texto: x.texto })),
    };
  }).filter(a => a.ate && a.ate > hoje)
    .sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "urgente" ? -1 : 1) || (a.atualizacoes[0].hora < b.atualizacoes[0].hora ? 1 : -1));
  cache.put("avisos", JSON.stringify(lista), 60);
  return lista;
}

// Data da Sheet (data ou texto "20/11/2026 09:20" / "2026-11-20 09:20") → "2026-11-20T09:20" ou "2026-11-20".
function dataAviso(v, comHora) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, "Europe/Lisbon", comHora ? "yyyy-MM-dd'T'HH:mm" : "yyyy-MM-dd");
  const s = String(v || "").trim();
  let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:[ T]+(\d{1,2})[:h](\d{2}))?/);
  if (m) m = [m[3], m[2], m[1], m[4], m[5]];
  else {
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2})[:h](\d{2}))?/);
    if (m) m = m.slice(1);
  }
  if (!m) return "";
  const d = m[0] + "-" + ("0" + m[1]).slice(-2) + "-" + ("0" + m[2]).slice(-2);
  return comHora ? d + "T" + ("0" + (m[3] || "0")).slice(-2) + ":" + (m[4] || "00") : d;
}

// Correr UMA vez (▶ prepararAvisos): cria a aba "avisos" com as colunas e põe o link da Ementa na aba "links".
function prepararAvisos() {
  const livro = SpreadsheetApp.getActiveSpreadsheet(), feito = [];
  let aba = livro.getSheetByName("avisos");
  if (aba) feito.push("avisos: já existia, não mexi");
  else {
    aba = livro.insertSheet("avisos");
    const cols = ["atualizado", "titulo", "texto", "nivel", "quando", "ate", "fonte"];
    aba.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold").setBackground("#ebce58");
    aba.getRange(1, 1, 1, cols.length).setNotes([cols.map(c => NOTAS.avisos[c])]);
    aba.setFrozenRows(1);
    aba.getRange("A2:A").setNumberFormat("dd/mm/yyyy hh:mm");
    aba.getRange("F2:F").setNumberFormat("dd/mm/yyyy");
    [140, 140, 420, 80, 180, 100, 100].forEach((w, i) => aba.setColumnWidth(i + 1, w));
    aba.getRange("D2:D").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["urgente", "info"], true).setAllowInvalid(true).build());
    feito.push("avisos: criada");
  }
  const links = livro.getSheetByName("links");
  if (links && links.getLastRow() > 1) {
    const dados = links.getDataRange().getValues(), cab = dados[0].map(c => String(c).trim().toLowerCase());
    const t = cab.indexOf("titulo"), u = cab.indexOf("url");
    const i = dados.findIndex((l, n) => n > 0 && /ementa/i.test(String(l[t])));
    if (t < 0 || u < 0) feito.push("links: não encontrei as colunas titulo/url");
    else if (i < 0) feito.push("links: não encontrei nenhum link com 'Ementa' no título");
    else { links.getRange(i + 1, u + 1).setValue("https://apaefao.pt/ementa"); feito.push("links: '" + dados[i][t] + "' → https://apaefao.pt/ementa"); }
  }
  limparCache();
  Logger.log(feito.join("\n"));
}

// Correr UMA vez (▶ prepararCalendario): cria a aba "calendario" com as datas de 2026/27 e
// junta à aba "agenda" as colunas inicio / mes / curto, preenchidas para as atividades que já lá estão.
// Não apaga nada. Se a aba "calendario" já existir, não mexe nela.
function prepararCalendario() {
  const livro = SpreadsheetApp.getActiveSpreadsheet(), feito = [];
  const COLS = ["tipo", "inicio", "fim", "nome", "curto", "emoji", "texto", "confirmar", "publicar"];
  const L = (tipo, inicio, fim, nome, curto, emoji, texto, confirmar) => [tipo, inicio, fim || "", nome, curto || "", emoji || "", texto || "", confirmar ? "sim" : "", ""];
  const linhas = [
    L("periodo", "2026-09-14", "2026-12-15", "1.º período"), L("periodo", "2027-01-04", "2027-03-19", "2.º período"), L("periodo", "2027-04-05", "2027-06-30", "3.º período"),
    L("ferias", "2026-12-16", "2027-01-03", "Férias de Natal", "Natal", "🎄"), L("ferias", "2027-02-08", "2027-02-10", "Férias do Carnaval", "Carnaval", "🎭"),
    L("ferias", "2027-03-22", "2027-04-02", "Férias da Páscoa", "Páscoa", "🐣"),
    L("feriado", "2026-10-05", "", "Implantação da República"), L("feriado", "2026-11-01", "", "Todos os Santos"),
    L("feriado", "2026-12-01", "", "Restauração da Independência"), L("feriado", "2026-12-08", "", "Imaculada Conceição"),
    L("feriado", "2026-12-25", "", "Natal"), L("feriado", "2027-01-01", "", "Ano Novo"), L("feriado", "2027-03-26", "", "Sexta-feira Santa"),
    L("feriado", "2027-03-28", "", "Páscoa"), L("feriado", "2027-04-25", "", "Dia da Liberdade"), L("feriado", "2027-05-01", "", "Dia do Trabalhador"),
    L("feriado", "2027-05-27", "", "Corpo de Deus"), L("feriado", "2027-06-10", "", "Dia de Portugal"),
    L("escola", "2026-09-14", "", "Primeiro dia de aulas", "", "🎒"),
    L("escola", "2026-09-23", "2026-09-30", "Semana Europeia do Desporto", "Semana do Desporto", "⚽"),
    L("escola", "2026-10-16", "", "Dia Mundial da Alimentação", "Dia da Alimentação", "🍎"),
    L("escola", "2026-11-20", "", "Dia do Pijama", "", "🧸", "Dia dos Direitos da Criança. Vem de pijama!"),
    L("escola", "2026-12-03", "", "Dia das Pessoas com Deficiência", "Dia da Inclusão", "🤝", "Palestra na escola."),
    L("escola", "2026-12-15", "", "Último dia de aulas · Pai Natal", "Último dia · Pai Natal", "🎅", "O Pai Natal chega no carro dos bombeiros.", true),
    L("escola", "2027-01-04", "", "Voltamos às aulas", "", "🎒"),
    L("escola", "2027-01-05", "", "Espetáculo no gelo (Porto)", "Espetáculo no gelo", "⛸️"),
    L("escola", "2027-02-09", "", "Carnaval", "", "🎭"), L("escola", "2027-02-14", "", "Dia dos Afetos", "", "💛"),
    L("escola", "2027-04-05", "", "Voltamos às aulas", "", "🎒"),
    L("escola", "2027-06-03", "", "Dia da Bicicleta", "", "🚲", "", true),
    L("escola", "2027-06-25", "", "Festa de Final de Ano", "", "🎉", "", true),
    L("escola", "2027-06-30", "", "Último dia de aulas", "", "☀️")
  ];
  if (livro.getSheetByName("calendario")) feito.push("calendario: já existia, não mexi");
  else {
    const aba = livro.insertSheet("calendario");
    aba.getRange("B:C").setNumberFormat("@");   // datas como texto AAAA-MM-DD
    aba.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight("bold").setBackground("#ebce58");
    aba.getRange(1, 1, 1, COLS.length).setNotes([COLS.map(c => NOTAS.calendario[c])]);
    aba.getRange(2, 1, linhas.length, COLS.length).setValues(linhas);
    aba.setFrozenRows(1);
    feito.push("calendario: criada com " + linhas.length + " linhas");
  }

  // agenda: novas colunas + valores para as atividades que já existem (procura pelo título)
  const ag = livro.getSheetByName("agenda");
  if (!ag) { feito.push("agenda: não encontrei a aba"); Logger.log(feito.join("\n")); return; }
  let cab = ag.getRange(1, 1, 1, ag.getLastColumn()).getValues()[0].map(c => String(c).trim().toLowerCase());
  ["inicio", "mes", "curto", "emoji"].forEach(c => {
    if (cab.indexOf(c) >= 0) return;
    ag.getRange(1, cab.length + 1).setValue(c).setNote(NOTAS.agenda[c] || "");
    cab.push(c);
    feito.push("agenda: coluna nova '" + c + "'");
  });
  const col = c => cab.indexOf(c) + 1;
  ag.getRange(2, col("inicio"), Math.max(ag.getMaxRows() - 1, 1), 1).setNumberFormat("@");
  ag.getRange(2, col("mes"), Math.max(ag.getMaxRows() - 1, 1), 1).setNumberFormat("@");
  // [palavra do título, inicio, mes, curto, emoji]  (Espetáculo no Gelo, Dia da Bicicleta e Festa de Final de Ano já estão no "calendario")
  const MAPA = [
    [/^dia do cinema/i, "2026-11-05", "", "", "🎬"], [/^magusto$/i, "2026-11-12", "", "Magusto da escola", "🌰"],
    [/^magusto do mercado/i, "2026-11-14", "", "Magusto do Mercado", "🌰"], [/^feirinha de outono/i, "2026-11-27", "", "", "🍂"],
    [/^jantar de natal/i, "2026-12-12", "", "", "🎄"], [/^cantar as janeiras/i, "", "2027-01", "", "👑"],
    [/^noite das sopas/i, "2027-02-05", "", "", "🍲"], [/baile de m[aá]scaras/i, "", "2027-02", "Baile de Máscaras", "🎭"],
    [/^p[aá]scoa$/i, "2027-03-15", "", "Semana da Páscoa", "🐣"], [/^dia da [aá]rvore/i, "2027-03-19", "", "", "🌳"],
    [/^marchas luminosas/i, "2027-04-02", "", "", "✨"], [/^feira do livro/i, "", "2027-04", "Feira do Livro", "📚"],
    [/^dia da fam[ií]lia/i, "2027-05-15", "", "", "👨‍👩‍👧"], [/^dia mundial da crian[cç]a/i, "2027-06-01", "", "Dia da Criança", "🧒"]
  ];
  const dados = ag.getDataRange().getValues(), t = cab.indexOf("titulo");
  MAPA.forEach(([rx, inicio, mes, curto, emoji]) => {
    const i = dados.findIndex((l, n) => n > 0 && rx.test(String(l[t]).trim()));
    if (i < 0) { feito.push("agenda: não encontrei " + rx); return; }
    const por = (c, v) => { if (v && !String(dados[i][col(c) - 1] || "").trim()) ag.getRange(i + 1, col(c)).setValue(v); };
    por("inicio", inicio); por("mes", mes); por("curto", curto); por("emoji", emoji);
    // um só dia (a Páscoa é a semana toda): o "fim" passa a ser o mesmo dia, para não aparecer em vários dias
    const fimDia = /p[aá]scoa/i.test(String(dados[i][t])) ? "2027-03-19" : inicio;
    if (fimDia && cab.indexOf("fim") >= 0) ag.getRange(i + 1, col("fim")).setValue(fimDia);
    feito.push("agenda: " + dados[i][t] + " → " + (inicio || mes));
  });
  // Feira da Primavera e Caminhada: ainda não estava na agenda
  if (!dados.some((l, n) => n > 0 && /feira da primavera/i.test(String(l[t])))) {
    const nova = cab.map(c => ({ titulo: "Feira da Primavera e Caminhada", quando: "maio", mes: "2027-05", emoji: "🌸", fim: "2027-05-31" }[c] || ""));
    ag.appendRow(nova);
    feito.push("agenda: nova linha 'Feira da Primavera e Caminhada'");
  }
  limparCache();
  Logger.log(feito.join("\n"));
}

// Correr UMA vez (▶ confirmarDatas, 18/11/2026): datas decididas pelo Jose deixam de estar "a confirmar".
// Pai Natal: 15/12 na escola (último dia de aulas) e 12/12 no Jantar de Natal (entrega os presentes).
function confirmarDatas() {
  const livro = SpreadsheetApp.getActiveSpreadsheet(), feito = [];
  function mudar(nomeAba, colTitulo, rx, valores) {
    const aba = livro.getSheetByName(nomeAba);
    if (!aba) { feito.push(nomeAba + ": não encontrei a aba"); return; }
    const dados = aba.getDataRange().getValues(), cab = dados[0].map(c => String(c).trim().toLowerCase());
    const i = dados.findIndex((l, n) => n > 0 && rx.test(String(l[cab.indexOf(colTitulo)]).trim()));
    if (i < 0) { feito.push(nomeAba + ": não encontrei " + rx); return; }
    Object.keys(valores).forEach(c => { if (cab.indexOf(c) >= 0) aba.getRange(i + 1, cab.indexOf(c) + 1).setValue(valores[c]); });
    feito.push(nomeAba + ": " + dados[i][cab.indexOf(colTitulo)] + " ✓");
  }
  mudar("calendario", "nome", /pai natal/i, { nome: "Último dia de aulas · Pai Natal na escola", texto: "De manhã, o Pai Natal chega à escola no carro dos bombeiros.", confirmar: "" });
  mudar("calendario", "nome", /^dia da bicicleta/i, { confirmar: "" });
  mudar("calendario", "nome", /^festa de final de ano/i, { confirmar: "" });
  mudar("agenda", "titulo", /^jantar de natal/i, { titulo: "Jantar de Natal · Pai Natal", curto: "Jantar · Pai Natal" });
  mudar("agenda", "titulo", /^noite das sopas/i, { quando: "Sexta, 5 fev", confirmar: "" });
  mudar("agenda", "titulo", /^dia da fam[ií]lia/i, { quando: "Sábado, 15 mai", confirmar: "" });
  limparCache();
  Logger.log(feito.join("\n"));
}
