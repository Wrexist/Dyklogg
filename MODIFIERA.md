# Modifiera Dyklogg — steg för steg

Den här guiden är skriven så att **en enda person utan djup webbkunskap** ska
kunna ändra appen själv utan att råka förstöra sparad data.

Hela appen ligger i **en fil**: `index.html`. Den innehåller tre delar:

| Del | Var i filen | Vad den gör |
|-----|-------------|-------------|
| **CSS** (utseende) | överst, i `<style>` | färger, ramar, typsnitt, utskrift |
| **HTML** (formuläret) | mitten, mellan `<body>` och `<script>` | själva blanketten du fyller i |
| **JS** (logik) | nederst, i `<script>` | spara/ladda, export, anpassning |

Allra först i `<script>` finns ett **`CONFIG`-block**. Nästan allt du vill ändra
snabbt rör du där. Du behöver aldrig längre "höja versionsnummer" – det är borta.

> **Gyllene regel:** testa alltid efter en ändring (se sista avsnittet) och spara
> en kopia av `index.html` innan du börjar, så kan du alltid gå tillbaka.

---

## 1. Byta temafärgen (orange → något annat)

Två sätt:

- **Utan att koda:** öppna appen → menyn **🎨 Anpassa** → välj färg under "Temafärg".
  Det sparas i webbläsaren.
- **Permanent standard för alla:** i `index.html`, hitta `CONFIG` och ändra raden:
  ```js
  accent: '#ff9900',   // ← byt till t.ex. '#0077cc'
  ```

---

## 2. Ändra standardlistan med arbetstyper

Listan (Besiktning, Svetsning, …) står numera på **EN enda plats**. I `CONFIG`:

```js
arbetstyper: ['Besiktning', 'Betongarbete', 'Demontage', /* ... */ ],
```

Lägg till, ta bort eller döp om i listan. Det gäller alla **nya** dyk.
(Användare kan fortfarande ändra listan per dyk via "✎ Redigera"-knappen i appen,
och de ändringarna sparas i just det dyket.)

---

## 3. Lägga till ett eget fält (utan att koda)

Öppna appen → **🎨 Anpassa** → **➕ Lägg till eget fält** → skriv namnet.
Fältet dyker upp i en "Egna fält"-ruta i dykloggen och kommer med i utskrift.
Detta är det rekommenderade sättet och kräver ingen redigering av filen.

---

## 4. Lägga till ett fält DIREKT i blanketten (kräver lite HTML)

Säg att du vill ha ett "Vattentemp vid yta"-fält i Dykdata-rutan.

1. Hitta rutan i HTML:en. Sök efter texten `Dykdata` i `index.html`.
2. Kopiera en befintlig rad, t.ex.:
   ```html
   <div class="ddr"><span class="dl et" contenteditable="false">Sikt:</span><input type="text" id="sikt"></div>
   ```
3. Klistra in den under och ändra **två saker**: etikettens text och `id`:
   ```html
   <div class="ddr"><span class="dl et" contenteditable="false">Yttemp:</span><input type="text" id="yttemp"></div>
   ```

**Viktigt om `id`:** varje `id` måste vara **unikt** i hela filen. Använd små
bokstäver utan mellanslag (`yttemp`, inte `Yt Temp`). Det är allt – fältet
sparas, laddas och exporteras automatiskt eftersom appen plockar upp alla
`<input>` som har ett `id`.

> Tack vare de **namngivna nycklarna** (se avsnitt 7) hamnar ingen sparad data
> fel när du lägger till eller flyttar rader. Du behöver **inte** röra någon
> kod i `<script>` för ett vanligt textfält.

---

## 5. Byta en etiketttext permanent

Två sätt:

- **Tillfälligt/per användare:** knappen **✎ Redigera text** i appen, klicka på
  texten och skriv om. Sparas i webbläsaren.
- **Permanent för alla:** ändra texten direkt i HTML:en. Sök efter den nuvarande
  texten (t.ex. `Bottentid:`) och skriv om den.

Etiketter som ska gå att redigera i appen har klassen `et`
(t.ex. `<span class="dl et" ...>`). Lägg till `et` i `class` om du vill att en
ny etikett ska bli redigerbar.

---

## 6. Byta logga

- **Utan att koda:** **🎨 Anpassa** → "Egen logga" → välj bildfil.
- **Permanent:** byt bildfilerna `dawab_logo.png` / `blackfisk.png` i mappen,
  eller ändra `src="..."` på `<img class="logo" ...>` i HTML:en.

---

## 7. Hur sparning fungerar (bra att förstå)

All data sparas automatiskt i webbläsaren (`localStorage`) och kan exporteras
till JSON-filer. Tidigare nycklades varje fält på sin **position** i sidan, vilket
gjorde att en liten ändring i formuläret kunde radera användarnas data om man
inte kom ihåg att höja ett "versionsnummer".

**Det är nu borttaget.** Varje fält identifieras på **namn** istället:

- Vanliga fält → sitt `id` (du sätter det själv, se avsnitt 4).
- Etiketter, kryssrutor, gruppbokstäver → en automatisk nyckel byggd på texten
  (`el.dataset.k`), satt av funktionen `assignDataKeys()`.

Därför kan du flytta, lägga till och ta bort rader fritt. Gamla sparfiler från
före ändringen läses in automatiskt av `migrateLegacy()` (du behöver inte göra
något). De enda som kan "nollas" vid en strukturändring är **flytta/skala-
positionerna** i en vy – aldrig text- eller kryssdata.

### localStorage-nycklar
Alla nycklar byggs via hjälpfunktionen `K('namn')` och delar prefixet i
`CONFIG.store` (`dyklogg`). Vill du byta namnrymd ändrar du den på ett ställe.

---

## 8. Företagsprofil — sätt upp en gång, dela med teamet

All anpassning (logga, färg, egna fält, mallar, arbetstyper, marginaler,
pappersval) kan sparas till **en fil** och laddas på en annan enhet.

- **Spara:** **🎨 Anpassa** → **💾 Spara företagsprofil** → en `.json`-fil laddas ner.
- **Ladda:** **🎨 Anpassa** → **📂 Ladda företagsprofil** → välj filen.

Skicka filen till en kollega så får hens app exakt samma uppsättning.
Den enskilda dyk-datan ingår **inte** i profilen (den hanteras separat under
**📁 Arkiv** och **💾 Spara/📂 Ladda**), så du kan dela en profil utan att dela dyk.

---

## 9. Lägga till en knapp i verktygsfältet

1. I HTML:en, hitta `<div class="toolbar">`.
2. Lägg en knapp där du vill ha den:
   ```html
   <button class="btn" onclick="minFunktion()">Min knapp</button>
   ```
3. I `<script>`, skriv funktionen:
   ```js
   function minFunktion() { toast('Hej!'); }
   ```
   `toast('text')` visar en liten bekräftelse längst ner – bra för feedback.

---

## 10. Testa att allt fungerar efter en ändring

Det finns ett automatiskt test (`test/persistens.test.js`) som kontrollerar att
spara/ladda och migrering fungerar. Kör så här (kräver Node.js):

```bash
cd test
npm install jsdom      # bara första gången
node persistens.test.js
```

(Se även `test/README.md` för samma instruktioner.)

Du ska se `28 OK, 0 FAIL`. Får du `FAIL` har något i sparlogiken gått sönder –
ångra din senaste ändring och prova igen.

**Snabbtest för hand:** öppna `index.html` i en webbläsare, fyll i några fält,
ladda om sidan (F5). Allt du skrev ska finnas kvar. Klicka **💾 Spara**, **🗑 Rensa**,
sen **📂 Ladda** och välj filen – allt ska komma tillbaka.

---

## Vanliga misstag

| Symptom | Trolig orsak | Lösning |
|---------|--------------|---------|
| Ett nytt fält sparas inte | `<input>` saknar `id`, eller `id` krockar med ett annat | Ge fältet ett unikt `id` (avsnitt 4) |
| Appen blir tom/vit efter ändring | Ett kodfel i `<script>` (t.ex. saknad `}`) | Ångra ändringen; kontrollera med testet i avsnitt 10 |
| Färgen ändras inte | Sparad färg i webbläsaren tar över | **🎨 Anpassa → ⟲ Återställ logga & färg** |
| Två fält visar samma sak | Två `<input>` har samma `id` | Gör `id` unikt |

Lycka till! Behöver du större ändringar – fråga gärna, men för det mesta räcker
det att röra `CONFIG` och kopiera en befintlig rad i HTML:en.
