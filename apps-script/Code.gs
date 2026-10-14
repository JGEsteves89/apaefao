// Google Apps Script — recebe as respostas dos formulários do site e guarda numa Google Sheet.
// Como instalar (por agora numa conta Google pessoal do Jose; depois mudar para apaefao@gmail.com):
// 1. Criar uma Google Sheet "Inscrições APAEF".
// 2. Extensões → Apps Script → colar este código.
// 3. Implementar → Nova implementação → Tipo "Aplicação Web"
//    Executar como: Eu · Quem tem acesso: Qualquer pessoa.
// 4. Copiar o URL e colar em ENDPOINT no halloween.html.

function doPost(e) {
  const dados = JSON.parse(e.postData.contents);
  const folha = SpreadsheetApp.getActiveSpreadsheet();
  const nome = dados.evento || "Respostas";
  const aba = folha.getSheetByName(nome) || folha.insertSheet(nome);
  const campos = ["data", "nome", "telemovel", "criancas", "turma", "recebe", "rua", "ajuda"];
  if (aba.getLastRow() === 0) aba.appendRow(campos);
  aba.appendRow(campos.map(c => dados[c] || ""));
  return ContentService.createTextOutput("ok");
}
