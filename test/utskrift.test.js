// Utskriftstest: renderar riktiga PDF:er i headless Chromium och verifierar
// att varje layout-läge ger EXAKT rätt antal sidor – även i värsta fallet
// med flera egna fält tillagda (de gör sidan högre).
//
// Körs med:  npm install playwright && npx playwright install chromium
//            node utskrift.test.js
// Har du en egen Chromium/Chrome: CHROME_PATH=/sökväg/till/chrome node utskrift.test.js
const { chromium } = require('playwright');
const path = require('path');

function pdfPages(buf) {
  const s = buf.toString('latin1');
  const m = s.match(/\/Type[\s]*\/Pages[^>]*\/Count[\s]+(\d+)/);
  return m ? +m[1] : (s.match(/\/Type[\s]*\/Page[^s]/g) || []).length;
}

let pass = 0, fail = 0;
function ok(name, got, want) {
  if (got === want) { pass++; console.log('  ✓ ' + name + ' → ' + got + ' sidor'); }
  else { fail++; console.log('  ✗ FAIL: ' + name + ' → ' + got + ' sidor (förväntat ' + want + ')'); }
}

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox']
  });
  const p = await b.newPage();
  const file = 'file://' + path.join(__dirname, '..', 'index.html');
  await p.goto(file, { waitUntil: 'load' });

  // [läge, liggande?, förväntade sidor]
  const cases = [
    ['logg-plan', true,  1],
    ['2x',        true,  1],
    ['2x-copy',   true,  2],
    ['2x-plan',   true,  2],
    ['hel-plan',  false, 1],
  ];

  async function run(label) {
    console.log('\n' + label);
    for (const [lay, landscape, want] of cases) {
      await p.evaluate(l => setLayout(l), lay);
      // Vänta tills layouten faktiskt är aktiv (markerat val i menyn) i stället
      // för en fast timeout – stabilare på långsamma system.
      await p.waitForFunction(
        l => { const s = document.querySelector('.layout-opt.sel'); return s && s.getAttribute('data-lay') === l; },
        lay, { timeout: 5000 }
      );
      const pdf = await p.pdf({ format: 'A4', landscape, printBackground: true, preferCSSPageSize: true });
      ok(lay, pdfPages(pdf), want);
    }
  }

  await run('[1] Standard (inga egna fält)');

  await p.evaluate(() => {
    setCustomFields([
      { key: 'a', label: 'Gasblandning' }, { key: 'b', label: 'Tanktryck' },
      { key: 'c', label: 'Anteckning' },   { key: 'd', label: 'Extra rad' }
    ]);
    renderCustomFields();
  });
  await p.waitForTimeout(150);
  await run('[2] Värsta fall: 4 egna fält tillagda');

  await b.close();
  console.log('\n================  ' + pass + ' OK, ' + fail + ' FAIL  ================');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FEL:', e.stack || e.message); process.exit(1); });
