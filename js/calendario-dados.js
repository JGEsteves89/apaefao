// Calendário do ano: as datas da escola (aba "calendario" da Sheet) + as atividades da APAEF (aba "agenda").
// Ficheiro partilhado: a página do calendário usa-o, e a Ementa pode usá-lo para saber os dias sem escola.
// Datas sempre locais (Portugal): nunca new Date("AAAA-MM-DD") (isso é UTC). Usar diaDe("AAAA-MM-DD").

const CAL_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CAL_MESES3 = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const CAL_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const CAL_DIAS3 = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const calPad = n => String(n).padStart(2, "0");
const calIso = d => `${d.getFullYear()}-${calPad(d.getMonth() + 1)}-${calPad(d.getDate())}`;
const diaDe = s => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const calMais = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const calData = s => /^\d{4}-\d{2}-\d{2}/.test(String(s || "")) ? String(s).slice(0, 10) : "";

// dados = resposta de ?acao=site ({ calendario: [...], agenda: [...] })
function calendarioDe(dados) {
  const linhas = (dados && dados.calendario) || [];
  const tipo = l => String(l.tipo || "").trim().toLowerCase();
  const periodos = [], ferias = [], feriados = {}, eventos = [], semDia = [];
  linhas.forEach(l => {
    const ini = calData(l.inicio), fim = calData(l.fim) || ini;
    if (!ini) return;
    const t = tipo(l), nome = String(l.nome || "").trim();
    if (t === "periodo") periodos.push({ ini, fim, nome });
    else if (t === "ferias") ferias.push({ ini, fim, nome, curto: l.curto || nome, emoji: l.emoji || "🏠" });
    else if (t === "feriado") feriados[ini] = nome;
    else if (t === "escola" && nome) eventos.push({ d: ini, fim: fim > ini ? fim : "", e: l.emoji || "🏫", nome, curto: l.curto || "", txt: l.texto || "", conf: !!l.confirmar, tipo: "escola" });
  });
  // Atividades da APAEF: só as que têm "inicio" (dia certo) ou "mes" (dia a definir).
  ((dados && dados.agenda) || []).forEach(a => {
    const ini = calData(a.inicio), nome = String(a.titulo || "").trim();
    if (!nome) return;
    const base = { e: a.emoji || "📌", nome, curto: a.curto || "", txt: a.texto || "", conf: !!a.confirmar, tipo: "apaef" };
    if (ini) {
      const fim = calData(a.fim);
      eventos.push(Object.assign(base, { d: ini, fim: fim > ini ? fim : "" }));
    } else if (/^\d{4}-\d{2}/.test(String(a.mes || ""))) semDia.push(Object.assign(base, { mes: String(a.mes).slice(0, 7) }));
  });
  periodos.sort((a, b) => a.ini.localeCompare(b.ini));
  ferias.sort((a, b) => a.ini.localeCompare(b.ini));
  eventos.sort((a, b) => a.d.localeCompare(b.d));
  if (!periodos.length) return null;

  const cal = { periodos, ferias, feriados, eventos, semDia, primeiro: periodos[0].ini, ultimo: periodos[periodos.length - 1].fim };
  cal.feriasDe = s => ferias.find(f => s >= f.ini && s <= f.fim);
  // feriado → fim de semana → férias → aulas (dentro de um período) → verão (fora dos períodos)
  cal.tipoDia = d => {
    const s = calIso(d);
    if (feriados[s]) return "feriado";
    const w = d.getDay();
    if (w === 0 || w === 6) return "fds";
    if (cal.feriasDe(s)) return "ferias";
    if (periodos.some(p => s >= p.ini && s <= p.fim)) return "aulas";
    return "verao";
  };
  cal.temEscola = d => cal.tipoDia(d) === "aulas";
  cal.eventosDia = s => eventos.filter(e => s >= e.d && s <= (e.fim || e.d));
  cal.diasEscola = (de, ate) => { let n = 0; for (let d = diaDe(de); calIso(d) <= ate; d = calMais(d, 1)) if (cal.tipoDia(d) === "aulas") n++; return n; };
  cal.estadoDia = d => {
    const t = cal.tipoDia(d), s = calIso(d);
    if (t === "aulas") return { casa: false, txt: "🏫 Há escola" };
    if (t === "fds") return { casa: true, txt: "🏠 Fim de semana" };
    if (t === "feriado") return { casa: true, txt: "🏠 Feriado: " + feriados[s] };
    if (t === "ferias") return { casa: true, txt: "🏠 " + cal.feriasDe(s).nome };
    return { casa: true, txt: "☀️ Férias de verão" };
  };
  return cal;
}
