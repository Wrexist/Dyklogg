// Nödguide-test: kör hela guide-sidan i en riktig webbläsare och verifierar att
// markera/flytta/skala/redigera/ångra, rutnät & fästning, sidor, sparning och
// utskrift fungerar – och att guiden inte påverkar de vanliga layout-lägena.
//
// Körs med:  npm install playwright && npx playwright install chromium
//            node nodguide.test.js
// Har du en egen Chromium/Chrome: CHROME_PATH=/sökväg/till/chrome node nodguide.test.js
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ FAIL: ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
}
const pdfPages = buf => {
  const m = buf.toString('latin1').match(/\/Type[\s]*\/Pages[^>]*\/Count[\s]+(\d+)/);
  return m ? +m[1] : 0;
};

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox']
  });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 950 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });

  console.log('\n[1] Öppna guiden');
  await p.click('#guide-btn');
  await p.waitForTimeout(400);
  await p.evaluate(() => { gZoom = 1; gApplyZoom(); });
  await p.waitForTimeout(150);
  ok('guide-vyn syns', await p.isVisible('#view-guide'));
  ok('layout-etiketten visar Nödguide', (await p.textContent('#layout-label')) === 'Nödguide');
  ok('standardguiden har 2 sidor', (await p.evaluate(() => GDOC.pages.length)) === 2);
  ok('inget block hamnar utanför arket',
     (await p.evaluate(() => GDOC.blocks.filter(x => x.x < 0 || x.y < 0 || x.x + x.w > 291.01 || x.y + x.h > 204.01).length)) === 0);
  ok('allt innehåll får plats i sina block',
     (await p.evaluate(() => document.querySelectorAll('#g-pages .g-blk.of').length)) === 0);

  console.log('\n[2] Markera, flytta, skala');
  const first = await p.$('#g-pages .g-page[data-pi="0"] .g-blk:nth-child(3)');
  const box0 = await first.boundingBox();
  await p.mouse.click(box0.x + box0.width / 2, box0.y + box0.height - 8);
  await p.waitForTimeout(120);
  ok('klick markerar block', await p.evaluate(() => gSel.length === 1 && !!document.querySelector('.g-selbox')));

  const before = await p.evaluate(() => ({ x: gPrimary().x, y: gPrimary().y }));
  const bb = await p.$eval('.g-blk.sel', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.move(bb.x + bb.w / 2, bb.y + bb.h - 8);
  await p.mouse.down();
  await p.mouse.move(bb.x + bb.w / 2 + 47, bb.y + bb.h - 8 + 31, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(120);
  const after = await p.evaluate(() => ({ x: gPrimary().x, y: gPrimary().y }));
  ok('drag flyttar blocket', after.x !== before.x || after.y !== before.y, { before, after });
  ok('positionen fäster mot rutnätet (5 mm)', after.x % 5 === 0 && after.y % 5 === 0, after);

  await p.keyboard.press('Control+z');
  await p.waitForTimeout(150);
  const undone = await p.evaluate(() => ({ x: gPrimary().x, y: gPrimary().y }));
  ok('Ctrl+Z ångrar flytten', undone.x === before.x && undone.y === before.y, { undone, before });

  const p0 = await p.evaluate(() => gPrimary().x);
  await p.keyboard.press('ArrowRight');
  ok('piltangent flyttar ett rutsteg', (await p.evaluate(() => gPrimary().x)) === p0 + 5);
  await p.keyboard.press('ArrowLeft');

  const w0 = await p.evaluate(() => gPrimary().w);
  const hb = await p.$eval('.g-selbox .h-se', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.move(hb.x, hb.y);
  await p.mouse.down();
  await p.mouse.move(hb.x + 40, hb.y + 20, { steps: 6 });
  await p.mouse.up();
  await p.waitForTimeout(120);
  ok('handtag skalar blocket', (await p.evaluate(() => gPrimary().w)) > w0);
  await p.keyboard.press('Control+z');
  await p.waitForTimeout(150);

  console.log('\n[3] Redigera innehåll');
  await p.evaluate(() => gSelect(GDOC.blocks[2].id));
  await (await p.$('.g-blk.sel [data-t="title"]')).dblclick();
  await p.waitForTimeout(100);
  ok('dubbelklick öppnar textredigering',
     await p.$eval('.g-blk.sel [data-t="title"]', e => e.getAttribute('contenteditable') === 'true'));
  await p.keyboard.press('Control+a');
  await p.keyboard.type('MIN EGEN RUBRIK');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  ok('texten sparas i dokumentet', (await p.evaluate(() => GDOC.blocks[2].title)) === 'MIN EGEN RUBRIK');

  await p.fill('#g-side-body .gf input[type=text]', 'FÖRE DYKET');
  await p.waitForTimeout(150);
  ok('titel via panelen uppdaterar arket',
     (await p.textContent('#g-pages .g-blk.sel [data-t="title"]')) === 'FÖRE DYKET');

  await p.evaluate(() => gSetProp('variant', 'dark', true));
  await p.waitForTimeout(120);
  ok('stil (variant) byts', await p.$eval('#g-pages .g-blk.sel', e => e.classList.contains('v-dark')));
  await p.evaluate(() => gSetProp('bg', '#123456', true));
  await p.waitForTimeout(120);
  ok('egen bakgrundsfärg slår igenom',
     (await p.$eval('#g-pages .g-blk.sel', e => getComputedStyle(e).backgroundColor)) === 'rgb(18, 52, 86)');
  await p.evaluate(() => { gClearColors(); gSetProp('variant', 'light', true); });
  await p.waitForTimeout(120);
  ok('färger kan återställas till stilens', await p.evaluate(() => gPrimary().bg === undefined));

  const c0 = await p.evaluate(() => gPrimary().items.length);
  await p.evaluate(() => gAddItem('b'));
  ok('rad kan läggas till', (await p.evaluate(() => gPrimary().items.length)) === c0 + 1);
  await p.evaluate(() => gSetItem(gPrimary().items.length - 1, 't', 's', true));
  await p.waitForTimeout(120);
  ok('radtyp kan bytas', await p.$eval('#g-pages .g-blk.sel .g-body > :last-child', e => e.classList.contains('g-sub')));
  await p.evaluate(() => gDelItem(0));
  ok('rad kan tas bort', (await p.evaluate(() => gPrimary().items.length)) === c0);

  await p.evaluate(() => gPickBlockIcon());
  await p.waitForTimeout(150);
  ok('ikonväljaren öppnas', await p.isVisible('#g-icon-overlay .g-icons'));
  await p.click('#g-icon-list button:nth-child(5)');
  await p.waitForTimeout(150);
  ok('ikonväljaren stänger och sätter ikonen',
     !(await p.isVisible('#g-icon-overlay .g-icons')) && (await p.evaluate(() => gPrimary().icon !== 'list')));

  await p.evaluate(() => { gSetProp('h', 90, true); gFitHeight(); });
  await p.waitForTimeout(150);
  const fitted = await p.evaluate(() => gPrimary().h);
  ok('höjden kan anpassas efter innehållet', fitted > 10 && fitted < 60, fitted);

  await p.click('#g-pages .g-blk .g-box');
  await p.waitForTimeout(100);
  ok('kryssruta kan bockas i', await p.evaluate(() => GDOC.blocks.some(b => (b.items || []).some(i => i.on))));

  await p.evaluate(() => gGoPage(1));
  await p.waitForTimeout(300);
  await p.fill('#g-pages .g-fi', 'Kaj 12, Oxelösund');
  await p.waitForTimeout(400);
  ok('ifyllnadsfält sparas',
     (await p.evaluate(() => GDOC.blocks.filter(b => (b.items || []).some(i => i.t === 'f'))[0].items[0].v)) === 'Kaj 12, Oxelösund');

  console.log('\n[4] Block, markering och rutnät');
  const n0 = await p.evaluate(() => GDOC.blocks.length);
  const types = await p.evaluate(() => G_ADD.map(a => a.t));
  for (const t of types) await p.evaluate(k => gAdd(k), t);
  await p.waitForTimeout(300);
  ok('alla blocktyper kan läggas till',
     (await p.evaluate(() => document.querySelectorAll('#g-pages .g-blk').length)) === n0 + types.length);
  await p.keyboard.press('Control+d');
  await p.waitForTimeout(150);
  ok('Ctrl+D duplicerar', (await p.evaluate(() => GDOC.blocks.length)) === n0 + types.length + 1);
  for (let i = 0; i <= types.length; i++) {
    await p.evaluate(() => { gSel = [GDOC.blocks[GDOC.blocks.length - 1].id]; gDelete(); });
  }
  await p.waitForTimeout(200);
  ok('tillagda block kan tas bort igen', (await p.evaluate(() => GDOC.blocks.length)) === n0);

  await p.evaluate(() => { gZoom = 0.6; gApplyZoom(); gSelect([]); gGoPage(0); });
  await p.waitForTimeout(300);
  const pgBox = await p.$eval('#g-pages .g-page[data-pi="0"]', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.move(pgBox.x + 2, pgBox.y + pgBox.h - 4);
  await p.mouse.down();
  await p.mouse.move(pgBox.x + pgBox.w - 2, pgBox.y + 2, { steps: 10 });
  await p.mouse.up();
  await p.waitForTimeout(200);
  ok('dragram markerar flera block', (await p.evaluate(() => gSel.length)) >= 5);
  const beforeAlign = await p.evaluate(() => gSel.map(id => gFind(id).x));
  await p.evaluate(() => gAlign('l'));
  await p.waitForTimeout(150);
  const afterAlign = await p.evaluate(() => gSel.map(id => gFind(id).x));
  ok('justera vänster fungerar', afterAlign.every(v => v === afterAlign[0]) && beforeAlign.some(v => v !== beforeAlign[0]));
  await p.keyboard.press('Control+z');
  await p.waitForTimeout(200);

  await p.evaluate(() => { gSelect(GDOC.blocks[3].id); gToggleLock(); });
  const lx = await p.evaluate(() => gPrimary().x);
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(120);
  ok('låst block flyttas inte', (await p.evaluate(() => gPrimary().x)) === lx);
  await p.evaluate(() => gToggleLock());

  await p.click('#g-grid-btn');
  await p.waitForTimeout(150);
  ok('rutnätet kan stängas av',
     (await p.evaluate(() => GDOC.grid.show)) === false && (await p.$$('#g-pages .g-page.grid')).length === 0);
  await p.click('#g-grid-btn');
  await p.selectOption('#g-gridsize', '10');
  await p.waitForTimeout(120);
  ok('rutstorleken kan ändras', (await p.evaluate(() => GDOC.grid.size)) === 10);
  await p.click('#g-snap-btn');
  ok('fäst mot rutnät kan stängas av', (await p.evaluate(() => GDOC.grid.snap)) === false);
  await p.click('#g-snap-btn');
  await p.selectOption('#g-gridsize', '5');

  console.log('\n[5] Sidor, sparning och lägen');
  await p.click('.g-bar .gb[title*="ny sida"]');
  await p.waitForTimeout(200);
  ok('ny sida kan läggas till', (await p.evaluate(() => GDOC.pages.length)) === 3);
  await p.evaluate(() => { window._del = gDelPage(2); });     // öppnar bekräftelse-modalen
  await p.waitForTimeout(300);
  const modal = await p.$('.modal-overlay.open .modal-btn.danger');
  if (modal) await modal.click();
  await p.waitForTimeout(250);
  ok('sida kan tas bort igen', (await p.evaluate(() => GDOC.pages.length)) === 2);

  await p.waitForTimeout(400);
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(500);
  const rel = await p.evaluate(() => ({
    t: GDOC.blocks[2].title, layout: activeLayout,
    vis: getComputedStyle(document.getElementById('view-guide')).display
  }));
  ok('guiden finns kvar efter omladdning', rel.t === 'FÖRE DYKET', rel);
  ok('vyn kommer tillbaka efter omladdning', rel.layout === 'nodguide' && rel.vis !== 'none', rel);

  await p.evaluate(() => gSetEdit(false));
  await p.waitForTimeout(200);
  ok('markeringsramen försvinner när redigering är av', !(await p.$('.g-selbox')));
  ok('kryssruta fungerar även med redigering av', await p.evaluate(() => {
    const box = document.querySelector('#g-pages .g-box');
    const b = GDOC.blocks.filter(x => (x.items || []).some(i => i.t === 'c'))[0];
    const was = !!b.items[0].on;
    box.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b.items[0].on !== was;
  }));

  console.log('\n[6] Utskrift');
  const pdfGuide = await p.pdf({ printBackground: true, preferCSSPageSize: true });
  ok('guiden skrivs ut på exakt 2 ark', pdfPages(pdfGuide) === 2, pdfPages(pdfGuide));
  await p.evaluate(() => setLayout('2x-plan'));
  await p.waitForTimeout(250);
  ok('guiden döljs när man byter layout',
     (await p.evaluate(() => getComputedStyle(document.getElementById('view-guide')).display)) === 'none');
  const pdfOther = await p.pdf({ printBackground: true, preferCSSPageSize: true });
  ok('annan layout skriver fortfarande 2 sidor (guiden följer inte med)', pdfPages(pdfOther) === 2, pdfPages(pdfOther));

  console.log('\n[7] Återställning och företagsprofil');
  await p.evaluate(() => { setLayout('nodguide'); gApplyDoc(gDefaultDoc()); });
  await p.waitForTimeout(250);
  ok('standardguiden kan återställas', (await p.evaluate(() => GDOC.blocks[2].title)) === 'INNAN DYKET');
  const prof = await p.evaluate(() => {
    let out = null; const orig = window.download;
    window.download = (n, c) => { out = c; };
    exportProfile(); window.download = orig;
    return out;
  });
  ok('företagsprofilen innehåller guiden',
     !!(prof && JSON.parse(prof).guide && JSON.parse(prof).guide.blocks.length > 20));

  if (errs.length) { fail++; console.log('\n  ✗ JS-fel i konsolen:\n    ' + errs.join('\n    ')); }
  else console.log('\n  ✓ inga JS-fel i konsolen');

  console.log('\n================  ' + pass + ' OK, ' + fail + ' FAIL  ================\n');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FEL:', e); process.exit(1); });
