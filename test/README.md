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
