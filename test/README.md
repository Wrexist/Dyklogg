# Test

Automatiskt test som verifierar att spara/ladda, "lägg till fält utan
dataförlust", migrering av gamla sparfiler och företagsprofilen fungerar.

## Köra testet

Kräver [Node.js](https://nodejs.org).

```bash
cd test
npm install jsdom      # första gången
node persistens.test.js
```

Förväntat resultat: `28 OK, 0 FAIL`.

Får du `FAIL` har något i sparlogiken (`gatherAll` / `applyAll` / `migrateLegacy`
i `index.html`) gått sönder – ångra din senaste ändring och kör om.

## Utskriftstest (`utskrift.test.js`)

Renderar riktiga PDF:er i headless Chromium och verifierar att varje
layout-läge ger exakt rätt antal sidor (t.ex. att RISK-rutan inte spiller
över på ett extra blad) – även med flera egna fält tillagda.

```bash
cd test
npm install playwright          # första gången
npx playwright install chromium # första gången
node utskrift.test.js
```

Förväntat resultat: `10 OK, 0 FAIL`.

Har du redan en Chrome/Chromium installerad:
`CHROME_PATH=/sökväg/till/chrome node utskrift.test.js`
