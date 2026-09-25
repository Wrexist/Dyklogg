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

// ---------------------------------------------------------------------------
console.log('\n[6] Regressioner (buggar som fixats)');
{
  const dom = makeDom(); const w = dom.window, d = w.document;
  const cbs = () => d.querySelectorAll('#atgrid-b1 input[type=checkbox]');
  // a) Arbetstyp-kryss i ett laddat dyk får inte skrivas över av de nuvarande
  cbs()[0].checked = true; cbs()[0].dispatchEvent(new w.Event('change', { bubbles: true }));
  const blob = w.gatherAll();
  cbs()[0].checked = false; cbs()[0].dispatchEvent(new w.Event('change', { bubbles: true }));
  cbs()[2].checked = true;  cbs()[2].dispatchEvent(new w.Event('change', { bubbles: true }));
  w.applyAll(JSON.parse(JSON.stringify(blob)));
  ok('laddade arbetstyp-kryss återställs (ruta 1 ikryssad)', cbs()[0].checked === true);
  ok('laddade arbetstyp-kryss återställs (ruta 3 okryssad)', cbs()[2].checked === false);

  // b) Inställningar i verktygsfältet är inte dyk-data
  const keys = Object.keys(w.gatherAll());
  ok('Dubblett/Bläckfisk-kryssen sparas inte som dyk-data', !keys.includes('dupchk') && !keys.includes('octopus-chk'));

  // c) Fält som saknas i ett laddat dyk töms (ingen data läcker mellan dyk)
  d.getElementById('b1-sikt').value = 'från förra dyket';
  w.applyAll({ 'b1-dyknr': '9' });
  ok('saknat fält töms vid laddning', d.getElementById('b1-sikt').value === '');
  ok('befintligt fält laddas', d.getElementById('b1-dyknr').value === '9');

  // d) Etikett-HTML från filer rensas från skript och attribut
  const et = d.querySelector('.et');
  const b2 = w.gatherAll(); b2['et.' + et.dataset.k] = 'A<img src=x onerror="x()"><b onclick="y()">B</b><script>z()</script>';
  w.applyAll(b2);
  ok('etikett rensad från farlig HTML', et.innerHTML === 'A<b>B</b>');

  // e) Flytta/skala-fingeravtrycket beror inte på vilken layout som är aktiv
  w.setLayout('logg-plan'); const sigHome = w.layoutSig();
  w.setLayout('2x-plan');   const sigMoved = w.layoutSig();
  w.setLayout('hel-plan');  const sigPlan = w.layoutSig();
  ok('layout-fingeravtryck lika i alla layouter', sigHome === sigMoved && sigHome === sigPlan);

  // f) Egna fält finns även i 2× Dyklogg-bladen, och påverkar inte fingeravtrycket
  w.setCustomFields([{ key: 'gas', label: 'Gasblandning' }]); w.renderCustomFields();
  ok('eget fält i dyklogg-blad 1 och 2', !!d.getElementById('b1-cf-gas') && !!d.getElementById('b2-cf-gas'));
  ok('egna fält ändrar inte layout-fingeravtrycket', w.layoutSig() === sigHome);

  // g) Datum/tid-tolkning för UDDF
  ok('normDate tolkar svenska format', w.normDate('2/6 2026') === '2026-06-02' && w.normDate('20260602') === '2026-06-02' && w.normDate('31/2 2026') === '');
  // h) Export/metadata läser den dyklogg som SYNS, inte den dolda (t.ex. projektuppgifter)
  w.setLayout('2x-plan');
  d.getElementById('arbetsplats').value = 'Dolt projekt'; d.getElementById('b1-arbetsplats').value = 'Synlig plats';
  ok('synlig dyklogg går före den dolda', w.logVal('arbetsplats') === 'Synlig plats' && w.diveMeta().plats === 'Synlig plats');
  w.setLayout('logg-plan');
  ok('i Logg + Plan går huvudvyn först', w.logVal('arbetsplats') === 'Dolt projekt');
  ok('normTime tolkar klockslag', w.normTime('8.30') === '08:30' && w.normTime('0915') === '09:15' && w.normTime('25:00') === '');
}

// ---------------------------------------------------------------------------
console.log('\n[7] Register, loggbok, månadsrapport, nytt dyk och underskrift');
{
  const dom = makeDom(); const w = dom.window, d = w.document;
  const iso = off => { const x = new w.Date(); x.setDate(x.getDate() + off); return w.isoOf(x); };
  // Datum
  ok('addMonths hanterar månadsslut', w.addMonths('2026-01-31', 1) === '2026-02-28' && w.addMonths('2026-11-15', 3) === '2027-02-15');
  ok('expiryStatus: utgånget / snart / ok / saknas',
    w.expiryStatus(iso(-1), 'X').level === 'bad' && w.expiryStatus(iso(10), 'X').level === 'warn' &&
    w.expiryStatus(iso(90), 'X').level === 'ok' && w.expiryStatus('', 'X').level === 'none');
  // Personal + varning för bemanningen i öppet dyk
  w.setPersonal([
    { id: 'a', namn: 'Anna Berg', certUtgar: iso(300), lakareUtgar: iso(-5) },
    { id: 'b', namn: 'Erik Holm', certUtgar: iso(300), lakareUtgar: iso(300) }]);
  ok('namnförslag i namnfälten', d.getElementById('b1-d1-namn').getAttribute('list') === 'dl-personal' && d.querySelectorAll('#dl-personal option').length === 2);
  w.setLayout('2x-plan');
  d.getElementById('b1-d1-namn').value = '  anna  berg '; d.getElementById('b1-led-namn').value = 'Erik Holm';
  const ci = w.crewIssues();
  ok('varning för utgånget läkarintyg (namn matchas skiftlägesokänsligt)', ci.length === 1 && ci[0].name === 'Anna Berg' && ci[0].level === 'bad');
  w.updateCrewAlert();
  ok('varningschip i verktygsfältet', !d.getElementById('crew-alert').hidden && d.getElementById('crew-alert').textContent.includes('Anna Berg'));
  ok('märke på Register-knappen', d.getElementById('reg-badge').textContent === '1' && d.getElementById('reg-badge').classList.contains('bad'));
  // Sammanslagning (säkerhetskopia/profil): nytt läggs till, nyare ersätter, skräp ignoreras
  const m = w.mergeRegister([{ id: 'a', namn: 'Anna', updatedAt: 5 }],
    [{ id: 'a', namn: 'Anna B', updatedAt: 9 }, { id: 'c', namn: 'Ny', certUtgar: 'igår' }, { id: 7, namn: 'x' }, { id: 'd' }], w.eval('PERSON_FIELDS'));
  const me = w.mergeRegister([], [{ id: 'e1', namn: 'Kompressor', intervall: 'abc' }, { id: 'e2', namn: 'Hjälm', intervall: '12' }], w.eval('EQUIP_FIELDS'));
  ok('mergeRegister rensar ogiltigt kontrollintervall', me.list[0].intervall === '' && me.list[1].intervall === '12');
  ok('mergeRegister', m.added === 1 && m.updated === 1 && m.list.length === 2 && m.list[0].namn === 'Anna B' && m.list[1].certUtgar === '');
  // Arkiv → loggbok + månadsrapport
  const today = w.todayISO();
  w.setDives({
    x1: { id: 'x1', savedAt: 1, projectId: 'p1', data: { 'b1-datum': today, 'b1-dyknr': '4', 'b1-d1-namn': 'Anna Berg', 'b1-led-namn': 'Erik Holm', 'b1-time-in': '8.00', 'b1-time-out': '8:45', 'b1-maxdjup': '12,5',
      // Dubblett-läget: höger blad identiskt → räknas en gång
      'b2-datum': today, 'b2-dyknr': '4', 'b2-d1-namn': 'Anna Berg', 'b2-led-namn': 'Erik Holm', 'b2-time-in': '8.00', 'b2-time-out': '8:45', 'b2-maxdjup': '12,5',
      // Dold huvudlogg med bara förifyllt datum/namn → inget dyk
      'datum': today, 'd1-namn': 'Anna Berg' } },
    x2: { id: 'x2', savedAt: 2, projectId: 'p2', data: { 'datum': today, 'dyknr': '9', 'd2-namn': 'Anna Berg', 'bottentid': '30 min', 'maxdjup': '8' } }
  });
  ok('diveLogs: dubblett och tom logg räknas inte', w.diveLogs(w.getDives().x1).length === 1);
  const lb = w.logbookFor('Anna Berg');
  ok('loggbok: antal dyk, dyktid, största djup', lb.dives === 2 && lb.minutes === 75 && lb.maxDepth === 12.5 && lb.last === today);
  ok('loggbok: dykledarens roll', w.logbookFor('Erik Holm').rows[0].role === 'Dykledare' && w.logbookFor('Erik Holm').dives === 0);
  const mr = w.monthReport('p1', today.slice(0, 7));
  ok('månadsrapport per projekt', mr.rows.length === 1 && mr.minutes === 45 && mr.divers[0].name === 'Anna Berg');
  ok('månadsrapport alla projekt', w.monthReport('', today.slice(0, 7)).rows.length === 2);
  // Nästa dyknummer (inom aktivt projekt / hela arkivet)
  w.setActiveProject('');
  ok('nästa dyknummer, hela arkivet', w.nextDiveNo() === 10);
  const pr = w.getProjects(); pr.p1 = { id: 'p1', name: 'Kaj' }; w.setProjects(pr); w.setActiveProject('p1');
  ok('nästa dyknummer, inom projektet', w.nextDiveNo() === 5);
  // Underskrift: sparas, laddas, rensas och filtreras
  const blob = w.gatherAll(); blob['sig.b1-led-sign'] = 'M10 20L30 40'; blob['sig.b1-d1-sign'] = 'M1 1<script>';
  w.applyAll(blob);
  ok('underskrift laddas och ritas', !!d.querySelector('#b1-led-sign').closest('.sig-field').querySelector('svg.sig-img path'));
  ok('ogiltig underskrift ignoreras', w.gatherAll()['sig.b1-d1-sign'] === undefined && w.gatherAll()['sig.b1-led-sign'] === 'M10 20L30 40');
  w.resetFormData();
  ok('underskrift töms med formuläret', w.gatherAll()['sig.b1-led-sign'] === undefined && !d.querySelector('svg.sig-img'));
  ok('underskrift påverkar inte layout-fingeravtrycket', (() => { const a = w.layoutSig(); w.applyAll(blob); return w.layoutSig() === a; })());
}

console.log('\n================  ' + pass + ' OK, ' + fail + ' FAIL  ================');
process.exit(fail ? 1 : 0);
