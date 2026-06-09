const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ FAIL: ' + name); } }

function makeDom() {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://dyklogg.test/', storageQuota: 10000000 });
  const w = dom.window;
  // stubs the script may touch on user actions
  w.URL.createObjectURL = () => 'blob:x';
  w.print = () => {};
  w.alert = () => {};
  w.scrollTo = () => {};
  return dom;
}

// ---------------------------------------------------------------------------
console.log('\n[1] Gather/apply-rundtur (inget tappas)');
{
  const dom = makeDom(); const w = dom.window, d = w.document;
  d.getElementById('datum').value = '2026-06-09';
  d.getElementById('maxdjup').value = '18';
  d.getElementById('led-namn').value = 'Anna Dyk';
  // en kryssruta utan id (utrustning)
  const cb = w.getNonIdCheckboxes()[3]; cb.checked = true; const cbKey = cb.dataset.k;
  // en gruppbokstav
  const span = d.querySelectorAll('#view-combined .groupletters span')[2]; span.classList.add('gsel');
  // en redigerad etikett
  const et = d.querySelector('.et'); et.innerHTML = 'MIN TITEL';
  // en flytta/skala-transform via blob-rundtur
  const blob = w.gatherAll();
  blob._layout = JSON.stringify({ L5: { x: 12, y: 34, s: 1.5 } });

  // nollställ allt
  d.getElementById('datum').value = '';
  d.getElementById('maxdjup').value = '';
  d.getElementById('led-namn').value = '';
  cb.checked = false; span.classList.remove('gsel'); et.innerHTML = 'X';

  w.applyAll(blob);
  ok('text-fält återställt', d.getElementById('maxdjup').value === '18');
  ok('namn återställt', d.getElementById('led-namn').value === 'Anna Dyk');
  ok('kryssruta återställd via namn-nyckel', w.getNonIdCheckboxes()[3].checked === true);
  ok('gruppbokstav återställd', d.querySelectorAll('#view-combined .groupletters span')[2].classList.contains('gsel'));
  ok('etikett-text återställd', d.querySelector('.et').innerHTML === 'MIN TITEL');
  const round = w.gatherAll();
  ok('layout bevarad (fingeravtryck matchar)', JSON.parse(round._layout).L5 && JSON.parse(round._layout).L5.x === 12);
  ok('inga positionsnycklar skrivs längre', !Object.keys(round).some(k => /^_(et|cb|gl)\d+$/.test(k)));
  ok('inga versionsstämplar skrivs längre', round._etv === undefined && round._cbv === undefined && round._ltv === undefined);
  ok('layout-fingeravtryck finns', typeof round._lsig === 'string');
}

// ---------------------------------------------------------------------------
console.log('\n[2] Lägg till ett NYTT .et-fält → gammal data hamnar INTE fel');
{
  const dom = makeDom(); const w = dom.window, d = w.document;
  // användaren har döpt om "Sikt:" och kryssat ruta 5
  const ddLabels = [...d.querySelectorAll('.et')].filter(e => e.textContent.includes('Sikt'));
  ddLabels[0].innerHTML = 'Visibility';
  const cb5 = w.getNonIdCheckboxes()[5]; cb5.checked = true; const cb5key = cb5.dataset.k;
  const blob = w.gatherAll();

  // simulera att utvecklaren la till en NY etikett HÖGST UPP (positionerna skiftar)
  const newEt = d.createElement('div'); newEt.className = 'et'; newEt.textContent = 'Helt ny rad';
  d.querySelector('#view-combined').insertBefore(newEt, d.querySelector('#view-combined').firstChild);
  w.assignDataKeys();   // nycklarna räknas om

  w.applyAll(blob);
  const siktLabel = [...d.querySelectorAll('.et')].find(e => e.dataset.k0 && e.dataset.k0.includes('Sikt'));
  ok('omdöpt "Sikt"-etikett följer med rätt element', siktLabel && siktLabel.innerHTML === 'Visibility');
  ok('den nya raden förblev orörd (default)', newEt.innerHTML === 'Helt ny rad');
  const cb5b = w.getNonIdCheckboxes().find(c => c.dataset.k === cb5key);
  ok('rätt kryssruta fortfarande ikryssad', cb5b && cb5b.checked === true);
}

// ---------------------------------------------------------------------------
console.log('\n[3] Migrering av GAMMALT sparformat (positionsnycklar + versioner)');
{
  const dom = makeDom(); const w = dom.window, d = w.document;
  // bygg en "gammal" blob: börja från ett nytt gather, byt sedan till positionsnycklar
  const etEls = [...d.querySelectorAll('.et')];
  const cbEls = w.getNonIdCheckboxes();
  const glEls = [...d.querySelectorAll('.groupletters span')];
  const old = {};
  d.getElementById('datum').value = '2025-01-01'; // id-fält oförändrade
  old['datum'] = '2025-01-01';
  old['_et' + 2] = 'GAMMAL ETIKETT';       // 3:e .et
  old['_cb' + 7] = true;                    // 8:e kryssruta
  old['_gl' + 1] = true;                    // 2:a gruppbokstaven (combined B)
  old['_layout'] = JSON.stringify({ L9: { x: 5, y: 6, s: 1 } });
  old['_etv'] = 10; old['_cbv'] = 2; old['_atv'] = 4; old['_ltv'] = 2;

  w.applyAll(old);
  ok('id-fält inläst', d.getElementById('datum').value === '2025-01-01');
  ok('_et2 → rätt etikett-element', etEls[2].innerHTML === 'GAMMAL ETIKETT');
  ok('_cb7 → rätt kryssruta', w.getNonIdCheckboxes()[7].checked === true);
  ok('_gl1 → rätt gruppbokstav', glEls[1].classList.contains('gsel'));
  ok('gammal layout (LTV=2) bevarad', JSON.parse(w.gatherAll()._layout).L9 !== undefined);

  // efter ett nytt gather ska det vara nytt format
  const re = w.gatherAll();
  ok('migrering skrev om till namngivna nycklar', re['et.' + etEls[2].dataset.k] === 'GAMMAL ETIKETT');
  ok('inga positionsnycklar kvar efter omsparning', !Object.keys(re).some(k => /^_(et|cb|gl)\d+$/.test(k)));
}

// ---------------------------------------------------------------------------
console.log('\n[4] För GAMMAL version (et-version ≠ baslinje) → släpps som förr');
{
  const dom = makeDom(); const w = dom.window, d = w.document;
  const etEls = [...d.querySelectorAll('.et')];
  const old = { '_et0': 'SKA SLÄNGAS', '_schema': 2 }; // schema 2 => et-version 2, inte 10
  const before = etEls[0].innerHTML;
  w.applyAll(old);
  ok('för gammal et-data migreras inte (säkert)', etEls[0].innerHTML === before);
}

// ---------------------------------------------------------------------------
console.log('\n[5] Företagsprofil export/import');
{
  const dom = makeDom(); const w = dom.window, d = w.document;
  w.setAccent('#112233');
  w.setCustomFields([{ key: 'f1', label: 'Gasblandning' }]);
  w.saveTemplate = null; // ej relevant
  let captured = null;
  w.download = (name, content) => { captured = { name, content }; }; // fånga exportfilen
  w.exportProfile();
  ok('exportProfile anropade download', captured && /foretagsprofil\.json$/.test(captured.name));
  const profile = JSON.parse(captured.content);
  ok('accent sparas i profilen', profile.accent === '#112233');
  ok('egna fält finns i profilen', profile.customfields.length === 1 && profile.customfields[0].label === 'Gasblandning');
  ok('arbetstyper finns i profilen', Array.isArray(profile.arbetstyper) && profile.arbetstyper.length > 0);

  // import på en "ny enhet"
  const dom2 = makeDom(); const w2 = dom2.window;
  w2.applyProfile({ accent: '#abcdef', customfields: [{ key: 'x', label: 'Tanktryck' }], arbetstyper: ['A', 'B'], paper: 'A3' });
  ok('import satte accent', w2.document.documentElement.style.getPropertyValue('--accent').trim() === '#abcdef');
  ok('import satte egna fält', w2.getCustomFields()[0].label === 'Tanktryck');
  const gridTxt = [...w2.document.querySelectorAll('#atgrid label')].map(l => l.textContent.trim()).join(',');
  ok('import satte arbetstyper (renderade)', gridTxt === 'A,B');
  ok('import satte pappersval', w2.document.getElementById('papersize').value === 'A3');
}

console.log('\n================  ' + pass + ' OK, ' + fail + ' FAIL  ================');
process.exit(fail ? 1 : 0);
