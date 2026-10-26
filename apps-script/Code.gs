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
};

function guardarFormulario(dados) {
  if (dados.evento === "socio" && dados.rgpd !== true) return json({ ok: false, erro: "sem rgpd" });
  const f = CAMPOS_FORMULARIO[dados.evento];
  const folha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = folha.getSheetByName(f.folha) || folha.insertSheet(f.folha);
  if (aba.getLastRow() === 0) aba.appendRow(["timestamp"].concat(f.campos));
  const valores = f.campos.map(c => limpar(dados[c], c === "mensagem" ? 1500 : 120));
  aba.appendRow([new Date()].concat(valores));
  const assunto = dados.evento === "socio" ? "Nova ficha de sócio: " + valores[0] + " (" + valores[1] + ")" : "Nova sugestão: " + valores[0];
  MailApp.sendEmail(EMAIL_AVISOS, "[APAEF site] " + assunto, f.campos.map((c, i) => c + ": " + valores[i]).join("\n"));
  return json({ ok: true });
}

function doGet(e) {
  if (e && e.parameter && e.parameter.acao === "resultados") return json(resultados());
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
