/* Página "Como está a correr o site" — lê data/estatisticas.json (gerado por scripts/estatisticas_gerar.py) */
(function () {
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return n.toLocaleString('pt-PT'); };
  function data(iso, comDia) {
    var d = new Date(iso + 'T12:00:00');
    var t = d.getDate() + ' ' + MESES[d.getMonth()];
    return comDia ? SEMANA[(d.getDay() + 6) % 7].toLowerCase() + ', ' + t : t;
  }
  function soma(a) { return a.reduce(function (s, x) { return s + x; }, 0); }

  // Barras horizontais: [[nome, valor], ...]
  function lista(el, linhas, total) {
    var max = Math.max.apply(null, linhas.map(function (l) { return l[1]; }));
    el.innerHTML = linhas.map(function (l, i) {
      var pct = total ? ' <small>(' + Math.round(l[1] / total * 100) + '%)</small>' : '';
      return '<li' + (l[1] === max ? ' class="topo1"' : '') + '><span class="nome">' + l[0] + '</span>' +
        '<span class="trilho"><i style="width:' + Math.max(l[1] / max * 100, 1.5) + '%"></i></span>' +
        '<b>' + fmt(l[1]) + pct + '</b></li>';
    }).join('');
  }

  // Colunas verticais com dica ao tocar/passar
  function colunas(el, valores, etiquetas, dicas, eixo) {
    var max = Math.max.apply(null, valores);
    el.innerHTML = '<div class="cols">' + valores.map(function (v, i) {
      return '<button type="button" class="col' + (v === max ? ' topo1' : '') + '" data-dica="' + dicas[i] + '" aria-label="' + dicas[i] + '">' +
        '<i style="height:' + (v ? Math.max(v / max * 100, 2) : 0) + '%"></i></button>';
    }).join('') + '</div><div class="eixo">' + eixo + '</div><p class="dica" aria-live="polite">Toca numa barra para ver o número.</p>';
    var dica = el.querySelector('.dica');
    el.querySelectorAll('.col').forEach(function (b) {
      var mostra = function () {
        el.querySelectorAll('.col.ativa').forEach(function (x) { x.classList.remove('ativa'); });
        b.classList.add('ativa'); dica.textContent = b.dataset.dica;
      };
      b.addEventListener('mouseenter', mostra); b.addEventListener('click', mostra); b.addEventListener('focus', mostra);
    });
  }

  fetch('data/estatisticas.json?v=' + Date.now()).then(function (r) { return r.json(); }).then(function (d) {
    var dias = d.dias, valores = dias.map(function (x) { return x[1]; });
    var total = soma(valores);
    var entradas = soma(d.origens.map(function (o) { return o[1]; }));
    var ult7 = soma(valores.slice(-7)), ant7 = soma(valores.slice(-14, -7));
    var apar = soma(d.aparelhos.map(function (a) { return a[1]; }));
    var tel = (d.aparelhos.filter(function (a) { return a[0] === 'Telemóvel'; })[0] || [0, 0])[1];

    $('periodo').textContent = 'De ' + data(d.inicio) + ' a ' + data(d.fim) + ' de ' + d.fim.slice(0, 4) + ' · atualizado a ' + data(d.gerado.slice(0, 10)) + ' às ' + d.gerado.slice(11);

    // Cartões
    var vezes = ant7 ? ult7 / ant7 : 0;
    var comp = !ant7 ? 'primeira semana' : vezes >= 1.9 ? 'mais do dobro dos 7 dias antes (' + fmt(ant7) + ')' :
      vezes > 1.05 ? 'mais do que nos 7 dias antes (' + fmt(ant7) + ')' :
      vezes < 0.95 ? 'menos do que nos 7 dias antes (' + fmt(ant7) + ')' : 'igual aos 7 dias antes';
    var cartoes = [
      [fmt(total), 'páginas vistas', 'desde ' + data(d.inicio)],
      [fmt(entradas), 'entradas no site', 'vezes que alguém abriu o site vindo de fora'],
      [fmt(ult7), 'nos últimos 7 dias', comp],
      [Math.round(tel / apar * 100) + '%', 'no telemóvel', 'o site é visto sobretudo no telemóvel'],
      [Math.round(d.portugal / d.paises_total * 100) + '%', 'em Portugal', 'quase todas as visitas são de cá']
    ];
    $('cartoes').innerHTML = cartoes.map(function (c) {
      return '<div class="cartao-num"><strong>' + c[0] + '</strong><span>' + c[1] + '</span><small>' + c[2] + '</small></div>';
    }).join('');

    // Por dia
    var maxI = valores.indexOf(Math.max.apply(null, valores));
    colunas($('g-dias'), valores, null, dias.map(function (x) { return data(x[0], true) + ': ' + fmt(x[1]) + ' visitas'; }),
      '<span>' + data(d.inicio) + '</span><span>' + data(d.fim) + '</span>');
    $('c-dias').innerHTML = 'O dia com mais visitas foi <b>' + data(dias[maxI][0], true) + '</b> (' + fmt(valores[maxI]) + '). ' +
      'Os picos aparecem quando o site é partilhado nos grupos de WhatsApp.';

    // Por semana (semanas de 7 dias a contar do fim)
    var semanas = [];
    for (var f = valores.length; f > 0; f -= 7) {
      var i0 = Math.max(0, f - 7);
      semanas.unshift([data(dias[i0][0]) + ' – ' + data(dias[f - 1][0]), soma(valores.slice(i0, f))]);
    }
    lista($('g-semanas'), semanas);
    var ws = semanas.map(function (s) { return s[1]; }), wl = ws[ws.length - 1];
    $('c-semanas').innerHTML = wl === Math.max.apply(null, ws) ? 'A última semana (em baixo) é a <b>melhor até agora</b>.' :
      'A última semana teve <b>' + fmt(wl) + '</b> visitas.';

    // Páginas
    lista($('g-paginas'), d.paginas.slice(0, 12));
    $('c-paginas').innerHTML = 'Depois do início, a página mais vista é <b>' + d.paginas[1][0] + '</b>.';

    // Origens
    lista($('g-origens'), d.origens, entradas);
    $('c-origens').innerHTML = 'Quase todos chegam por um <b>link</b> (sobretudo do WhatsApp). O Google ainda traz poucas pessoas.';

    // Hora
    var horas = d.horas, hMax = horas.indexOf(Math.max.apply(null, horas));
    colunas($('g-horas'), horas, null, horas.map(function (v, h) { return 'Das ' + h + 'h às ' + (h + 1) + 'h: ' + fmt(v) + ' visitas'; }),
      '<span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>');
    $('c-horas').innerHTML = 'A hora com mais visitas é <b>das ' + hMax + 'h às ' + (hMax + 1) + 'h</b>. Bom momento para partilhar novidades.';

    // Dia da semana
    lista($('g-semana'), SEMANA.map(function (n, i) { return [n, d.semana[i]]; }));
    var sMax = d.semana.indexOf(Math.max.apply(null, d.semana));
    $('c-semana').innerHTML = 'O dia da semana com mais visitas é <b>' + SEMANA[sMax].toLowerCase() + '</b>. Ao fim de semana quase ninguém vem.';

    // Aparelhos
    lista($('g-aparelhos'), d.aparelhos, apar);
  }).catch(function () {
    $('cartoes').innerHTML = '<p>Não foi possível carregar os números. Tenta mais tarde.</p>';
  });
})();
