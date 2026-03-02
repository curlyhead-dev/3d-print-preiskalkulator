# 3D‑Druck Preiskalkulator (Static PWA)

Ein statischer 3D‑Druck Stückpreis‑Kalkulator (HTML/CSS/JS) mit:
- detailliertem Kosten‑Breakdown
- Persistenz via `localStorage`
- Offline‑Support (Service Worker) + `manifest.json`

## Lokal verwenden

### Quick & dirty
Du kannst `index.html` direkt im Browser öffnen.

**Hinweis:** Manche Browser (und iOS) mögen Service Worker nicht bei `file://`.
Für Offline/PWA am iPhone solltest du es über `http(s)://` hosten.

### Lokaler Mini‑Server (empfohlen)
Im Projektordner:

```bash
python3 -m http.server 8080
```

Dann öffnen: `http://localhost:8080`

## Am iPhone als „App“ auf den Home Screen
1. URL in **Safari** öffnen
2. Teilen → **„Zum Home‑Bildschirm“**

## GitHub Pages Hosting
1. Repo auf GitHub erstellen und pushen
2. GitHub → Settings → Pages → Deploy from branch → `main` / root
3. Danach hast du eine URL, die am iPhone „Add to Home Screen“ kann.

## Icons
Lege PNGs ab:
- `icons/icon-192.png`
- `icons/icon-512.png`

(Platzhalter fehlen bewusst – damit du dein Branding reinhaust.)

## Formeln
Siehe `app.js` (oben kommentiert).

Designrate ist fix: **70 €/h**.
Wartung ist standardmäßig: **1 € pro Druckstunde**.
Rüstkosten sind standardmäßig: **10 € pro Job** (auf Stückzahl verteilt).
USt/VAT Standard: **20 %** (anpassbar).
