/* gstin.niveshsahayak.in: GSTIN checker.
   Reads a GSTIN character by character (state, PAN or TAN, registration number, 14th character, check character),
   checks many at once, gets name and address through the GST portal (gstfetch.js) and saves the party to the shared data home. */
(function () {
  'use strict';
  var NS = window.NS, $ = NS.$, esc = NS.esc, t = function (k, v) { return NS.t(k, v); };
  var C36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var HOLDER = { C: 'gf.h.C', P: 'gf.h.P', F: 'gf.h.F', H: 'gf.h.H', A: 'gf.h.A', T: 'gf.h.T', B: 'gf.h.B', L: 'gf.h.L', J: 'gf.h.J', G: 'gf.h.G' };
  var RECENT = 'ns-gstin-recent';

  /* the 15th character for the first 14 */
  function checkChar(g14) {
    var sum = 0;
    for (var i = 0; i < 14; i++) {
      var v = C36.indexOf(g14[i]) * (i % 2 ? 2 : 1);
      sum += Math.floor(v / 36) + (v % 36);
    }
    return C36[(36 - (sum % 36)) % 36];
  }
  NS.gstinCheckChar = checkChar;

  function stateOf(code) {
    if (code === '25') return t('gi.st25');
    return NS.stateName(code);
  }

  /* everything we can tell from the number itself */
  function analyse(raw) {
    var g = String(raw || '').toUpperCase().replace(/[\s\-.]/g, '');
    if (!g) return null;
    var r = { g: g, errs: [], warns: [], hint: '' };
    var bad = [];
    for (var i = 0; i < g.length; i++) if (C36.indexOf(g[i]) < 0) bad.push(i + 1);
    if (bad.length) { r.errs.push(t('gi.e.chars', { p: bad.join(', ') })); return r; }
    if (g.length !== 15) {
      r.errs.push(t('gi.e.len', { n: g.length }));
      if (g.length === 14 && /^[0-9]{2}/.test(g)) r.hint = t('gi.hint14', { c: checkChar(g) });
      return r;
    }
    var st = g.slice(0, 2), k14 = g[13], id = g.slice(2, 12), n13 = g[12];
    r.state = st; r.stateName = stateOf(st); r.id = id; r.k14 = k14;
    if (!/^[0-9]{2}$/.test(st) || !r.stateName) r.errs.push(t('gi.e.state', { s: st }));
    else if (st === '25') r.warns.push(t('gi.w25'));
    if (k14 === 'D') {
      r.idKind = 'tan';
      if (!/^[A-Z]{4}[0-9]{5}[A-Z]$/.test(id)) r.errs.push(t('gi.e.tan'));
    } else {
      r.idKind = 'pan';
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(id)) r.errs.push(t('gi.e.pan'));
      else r.holder = HOLDER[id[3]] ? t(HOLDER[id[3]]) : '';
      if (r.holder === '' && /^[A-Z]{5}/.test(id)) r.warns.push(t('gi.w.holder', { c: id[3] }));
    }
    if (n13 === '0') r.errs.push(t('gi.e.n13'));
    else r.n13 = C36.indexOf(n13);
    r.kind = k14 === 'Z' ? t('gi.k.Z') : k14 === 'D' ? t('gi.k.D') : k14 === 'C' ? t('gi.k.C') : t('gi.k.x');
    if (!/[ZDC]/.test(k14)) r.warns.push(t('gi.w14', { c: k14 }));
    r.want = checkChar(g);
    if (r.want !== g[14]) r.errs.push(t('gi.e.chk', { c: r.want, x: g[14] }));
    r.ok = !r.errs.length;
    return r;
  }
  NS.gstinAnalyse = analyse;

  var root, saved = [];

  function boxes(g) {
    var cls = function (i) { return i < 2 ? 'st' : i < 12 ? 'id' : i === 12 ? 'n' : i === 13 ? 'k' : 'ck'; };
    return '<div class="gt-boxes" dir="ltr" aria-hidden="true">' + g.split('').map(function (c, i) {
      return '<span class="' + cls(i) + '"><b>' + esc(c) + '</b><i>' + (i + 1) + '</i></span>';
    }).join('') + '</div>';
  }
  function rowHtml(lbl, val, extra) { return '<tr><th scope="row">' + esc(lbl) + '</th><td>' + val + (extra ? ' <span class="soft">' + esc(extra) + '</span>' : '') + '</td></tr>'; }

  function showOne() {
    var inp = $('#gi-in', root), out = $('[data-gi-out]', root), r = analyse(inp.value);
    var act = $('[data-gi-acts]', root);
    act.hidden = !(r && r.ok);
    if (!r) { out.innerHTML = '<p class="soft">' + esc(t('gi.empty')) + '</p>'; return; }
    var head = r.ok ? '<p class="gt-badge ok">✓ ' + esc(t('gi.ok')) + '</p>' : '<p class="gt-badge bad">✕ ' + esc(t('gi.bad')) + '</p>';
    var list = r.errs.concat(r.warns.map(function (w) { return '⚠ ' + w; }));
    var h = head + (list.length ? '<ul class="gt-msgs">' + list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      (r.hint ? '<p class="note">' + esc(r.hint) + '</p>' : '');
    if (r.g.length === 15 && !/[^0-9A-Z]/.test(r.g)) {
      h += boxes(r.g) + '<table class="gt-tbl">' +
        rowHtml(t('gi.p.state'), '<b class="mono">' + esc(r.state) + '</b> · ' + esc(r.stateName || t('gi.unknown'))) +
        rowHtml(r.idKind === 'tan' ? t('gi.p.tan') : 'PAN', '<b class="mono">' + esc(r.id) + '</b>', r.holder ? t('gf.holder') + ': ' + r.holder : '') +
        rowHtml(t('gi.p.n13'), '<b class="mono">' + esc(r.g[12]) + '</b>', r.n13 === 1 ? t('gi.n13one') : r.n13 ? t('gi.n13', { n: r.n13 }) : '') +
        rowHtml(t('gi.p.k14'), '<b class="mono">' + esc(r.k14) + '</b>', r.kind) +
        rowHtml(t('gi.p.ck'), '<b class="mono">' + esc(r.g[14]) + '</b>', r.want === r.g[14] ? t('gi.ck.ok') : t('gi.ck.bad', { c: r.want })) +
        '</table>';
    }
    if (r.ok) h += '<p class="note">' + esc(t('gi.only')) + '</p>';
    var have = saved.filter(function (p) { return (p.gstin || '').toUpperCase() === r.g; })[0];
    if (have) h += '<p class="note ok-note">' + esc(t('gi.have', { n: have.name })) + '</p>';
    out.innerHTML = h;
    if (r.ok) remember(r.g);
  }

  function remember(g) {
    var l = [];
    try { l = JSON.parse(localStorage.getItem(RECENT) || '[]'); } catch (e) {}
    l = [g].concat(l.filter(function (x) { return x !== g; })).slice(0, 8);
    try { localStorage.setItem(RECENT, JSON.stringify(l)); } catch (e) {}
    drawRecent(l);
  }
  function drawRecent(l) {
    if (!l) { try { l = JSON.parse(localStorage.getItem(RECENT) || '[]'); } catch (e) { l = []; } }
    var box = $('[data-gi-recent]', root);
    box.innerHTML = l.length ? '<span class="soft">' + esc(t('gi.recent')) + '</span> ' + l.map(function (g) { return '<button type="button" class="chip mono" data-g="' + esc(g) + '">' + esc(g) + '</button>'; }).join(' ') : '';
  }

  /* save the confirmed portal details as a customer or supplier (same record shape as docs.js) */
  function savePortal(d, role) {
    var key = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
    return NSStore.list('party').then(function (all) {
      var hit = all.filter(function (x) { return x.gstin === d.gstin; })[0] || all.filter(function (x) { return key(x.name) === key(d.name); })[0];
      var r2 = !hit || !hit.role ? role : hit.role === role || hit.role === 'both' ? hit.role : 'both';
      return NSStore.put('party', Object.assign(hit || {}, { name: d.name, addr: d.addr || (hit && hit.addr) || '', city: d.city || (hit && hit.city) || '', pin: d.pin || (hit && hit.pin) || '',
        state: d.state, gstin: d.gstin, role: r2, reg: d.reg || '',
        gst: { legal: d.legal || '', trade: d.trade || '', status: d.status || '', type: d.type || '', since: d.since || '', checked: d.checked } }));
    }).then(function () { NS.toast(t('gf.saved', { n: d.name })); loadSaved(); }, function (err) { NS.toast(t('nosave', { e: err.message }), 'bad'); });
  }

  function fetchDetails(g) {
    NS.gstFetch(g, function (d) {
      var box = $('[data-gi-portal]', root);
      box.hidden = false;
      box.innerHTML = '<h3>' + esc(d.name) + '</h3><p>' + esc([d.addr, d.city, d.pin].filter(Boolean).join(', ')) + '</p>' +
        '<ul class="gf-facts">' + [['gf.legal', d.legal], ['gf.trade', d.trade], ['gf.status', d.status], ['gf.type', d.type], ['gf.since', d.since], ['gf.const', d.constitution]]
          .filter(function (x) { return x[1]; }).map(function (x) { return '<li>' + esc(t(x[0])) + ': <b>' + esc(x[1]) + '</b></li>'; }).join('') + '</ul>' +
        '<p class="soft">' + esc(t('gi.checkedon', { d: NS.fmtDate(d.checked) })) + '</p>' +
        '<div class="row"><button type="button" class="btn primary" data-role="customer">' + esc(t('gi.savec')) + '</button><button type="button" class="btn" data-role="supplier">' + esc(t('gi.saves')) + '</button></div>';
      NS.$$('[data-role]', box).forEach(function (b) { b.onclick = function () { savePortal(d, b.getAttribute('data-role')); }; });
      box.scrollIntoView({ block: 'nearest' });
    });
  }

  /* many at once */
  var bulkRows = [];
  function bulk() {
    var txt = $('#gi-many', root).value, seen = {};
    var toks = txt.toUpperCase().split(/[\s,;|]+/).map(function (s) { return s.replace(/[^0-9A-Z]/g, ''); }).filter(function (s) { return s.length >= 10; });
    bulkRows = toks.map(function (g) { var r = analyse(g); r.dup = !!seen[g]; seen[g] = 1; return r; });
    var ok = bulkRows.filter(function (r) { return r.ok; }).length;
    var out = $('[data-gi-bulk]', root);
    if (!bulkRows.length) { out.innerHTML = '<p class="soft">' + esc(t('gi.m.none')) + '</p>'; return; }
    out.innerHTML = '<p><b>' + esc(t('gi.m.sum', { n: bulkRows.length, ok: ok, bad: bulkRows.length - ok })) + '</b></p>' +
      '<div class="gt-scroll"><table class="gt-tbl gt-list"><thead><tr><th>#</th><th>GSTIN</th><th>' + esc(t('gi.m.res')) + '</th><th>' + esc(t('gi.p.state')) + '</th><th>PAN</th><th>' + esc(t('gf.holder')) + '</th></tr></thead><tbody>' +
      bulkRows.map(function (r, i) {
        return '<tr class="' + (r.ok ? '' : 'bad') + '"><td>' + (i + 1) + '</td><td class="mono" dir="ltr">' + esc(r.g) + '</td><td>' + (r.ok ? '✓ ' + esc(t('gi.m.ok')) : '✕ ' + esc(r.errs[0])) + (r.dup ? ' <span class="soft">(' + esc(t('gi.m.dup')) + ')</span>' : '') +
          '</td><td>' + esc(r.stateName || '') + '</td><td class="mono">' + esc(r.idKind === 'pan' && r.id ? r.id : '') + '</td><td>' + esc(r.holder || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="row"><button type="button" class="btn" data-gi-csv>' + esc(t('gi.m.csv')) + '</button></div>';
    $('[data-gi-csv]', out).onclick = csv;
  }
  function csv() {
    var q = function (s) { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var lines = [['GSTIN', 'Result', 'State code', 'State', 'PAN', 'Registered as', 'Problem'].join(',')].concat(bulkRows.map(function (r) {
      return [r.g, r.ok ? 'OK' : 'Wrong', r.state || '', r.stateName || '', r.idKind === 'pan' ? r.id || '' : '', r.holder || '', r.errs.join(' ')].map(q).join(',');
    }));
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }));
    a.download = 'gstin-check-' + NS.today() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* the customers and suppliers already saved: any wrong GSTIN among them? */
  function loadSaved() {
    var box = $('[data-gi-saved]', root);
    return NSStore.list('party').then(function (all) {
      saved = all.filter(function (p) { return p.gstin; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      if (!saved.length) { box.innerHTML = '<p class="soft">' + esc(t('gi.s.none')) + '</p>'; return; }
      var bad = saved.filter(function (p) { var r = analyse(p.gstin); return !r || !r.ok; }).length;
      box.innerHTML = '<p>' + esc(t('gi.s.sum', { n: saved.length, bad: bad })) + '</p><div class="gt-scroll"><table class="gt-tbl gt-list"><thead><tr><th>' + esc(t('gi.s.name')) + '</th><th>GSTIN</th><th>' + esc(t('gi.m.res')) + '</th><th>' + esc(t('gi.s.portal')) + '</th><th></th></tr></thead><tbody>' +
        saved.map(function (p) {
          var r = analyse(p.gstin), g = p.gst || {};
          var portal = g.checked ? esc((g.status || '') + ' · ' + NS.fmtDate(g.checked)) : '<span class="soft">' + esc(t('gi.s.never')) + '</span>';
          return '<tr class="' + (r && r.ok ? '' : 'bad') + '"><td>' + esc(p.name) + '</td><td class="mono" dir="ltr">' + esc(p.gstin) + '</td><td>' + (r && r.ok ? '✓' : '✕ ' + esc(r ? r.errs[0] : '')) + '</td><td>' + portal +
            '</td><td><button type="button" class="btn sm" data-check="' + esc(p.gstin) + '">' + esc(t('gi.s.again')) + '</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      NS.$$('[data-check]', box).forEach(function (b) { b.onclick = function () { var inp = $('#gi-in', root); inp.value = b.getAttribute('data-check'); showOne(); inp.scrollIntoView({ block: 'center' }); }; });
      showOne();
    }).catch(function () { box.innerHTML = '<p class="soft">' + esc(t('gi.s.none')) + '</p>'; });
  }

  function shareText(g) {
    var r = analyse(g);
    return 'GSTIN ' + g + '\n' + (r.ok ? t('gi.ok') : t('gi.bad')) + '\n' + t('gi.p.state') + ': ' + r.state + ' ' + (r.stateName || '') + '\nPAN: ' + (r.id || '') + (r.holder ? ' (' + r.holder + ')' : '') + '\nhttps://gstin.niveshsahayak.in/?g=' + g;
  }

  function render() {
    var was = $('#gi-in', root), wasMany = $('#gi-many', root);
    var keep = was ? was.value : '', keepMany = wasMany ? wasMany.value : '';
    root.innerHTML =
      '<div class="gt-grid">' +
      '<section class="gt-card" aria-labelledby="gi-h1"><h2 id="gi-h1">' + esc(t('gi.h.one')) + '</h2>' +
      '<label for="gi-in" class="gt-lbl">' + esc(t('gi.lbl')) + '</label>' +
      '<input id="gi-in" class="gt-big mono" dir="ltr" maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="03ABCDE1234F1ZA" inputmode="text">' +
      '<div data-gi-recent class="gt-recent"></div>' +
      '<div data-gi-out aria-live="polite"></div>' +
      '<div class="row gt-acts" data-gi-acts hidden><button type="button" class="btn primary" data-gi="fetch">' + esc(t('gf.btn')) + '</button>' +
      '<button type="button" class="btn" data-gi="copy">' + esc(t('gi.copy')) + '</button><button type="button" class="btn" data-gi="share">' + esc(t('gi.share')) + '</button><button type="button" class="btn" data-gi="print">' + esc(t('gi.print')) + '</button></div>' +
      '<div class="gt-portal" data-gi-portal hidden aria-live="polite"></div>' +
      '</section>' +
      '<section class="gt-card gt-noprint" aria-labelledby="gi-h2"><h2 id="gi-h2">' + esc(t('gi.h.many')) + '</h2><p class="soft">' + esc(t('gi.m.help')) + '</p>' +
      '<label for="gi-many" class="gt-lbl">' + esc(t('gi.m.lbl')) + '</label><textarea id="gi-many" rows="5" dir="ltr" class="mono" spellcheck="false"></textarea>' +
      '<div class="row"><button type="button" class="btn primary" data-gi="bulk">' + esc(t('gi.m.go')) + '</button></div><div data-gi-bulk aria-live="polite"></div></section>' +
      '</div>' +
      '<section class="gt-card gt-noprint" aria-labelledby="gi-h3"><h2 id="gi-h3">' + esc(t('gi.h.saved')) + '</h2><div data-gi-saved><div class="shim" style="height:80px"></div></div></section>';
    var inp = $('#gi-in', root);
    inp.addEventListener('input', showOne);
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-g')) { inp.value = b.getAttribute('data-g'); showOne(); return; }
      var a = b.getAttribute('data-gi'), g = (analyse(inp.value) || {}).g;
      if (a === 'bulk') return bulk();
      if (!g) return;
      if (a === 'fetch') fetchDetails(g);
      else if (a === 'copy') { if (navigator.clipboard) navigator.clipboard.writeText(g).then(function () { NS.toast(t('gf.copied')); }); }
      else if (a === 'share') { var tx = shareText(g); if (navigator.share) navigator.share({ title: 'GSTIN ' + g, text: tx }).catch(function () {}); else window.open('https://wa.me/?text=' + encodeURIComponent(tx), '_blank', 'noopener'); }
      else if (a === 'print') window.print();
    });
    var q = new URLSearchParams(location.search).get('g');
    inp.value = keep || (q ? q.toUpperCase().slice(0, 20) : '');
    $('#gi-many', root).value = keepMany;
    if (keepMany) bulk();
    drawRecent();
    showOne();
    NSStore.ready().then(loadSaved);
  }

  function start() {
    root = $('#gstin-tool');
    if (!root) return;
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  document.addEventListener('ns-lang', function () { if (root) render(); });
})();
