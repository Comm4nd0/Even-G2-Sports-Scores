# Even G2 Sports Scores

A live sports scores viewer built for the [Even Realities G2](https://www.evenrealities.com/) smart glasses. Browse major tournaments for Soccer, Rugby, and Snooker — select a sport and competition on the glasses, then scroll through the latest match results.

## Live App

**URL:** [https://comm4nd0.github.io/Even-G2-Sports-Scores/](https://comm4nd0.github.io/Even-G2-Sports-Scores/)

Scan the QR code below in the Even app to load Sports Scores on your G2 glasses:

![QR Code](qrcode.png)

## Features

- **Three sports** — Soccer, Rugby, and Snooker with major tournaments only
- **Glasses navigation** — scroll up/down to browse, tap to select, drill into sport → competition → scores
- **Phone UI** — tap a sport tab to see all competition scores at a glance
- **Live data** — scores fetched from TheSportsDB API with 5-minute caching
- **Team name shortening** — long names auto-shortened for the glasses display

### Sports & Competitions

| Sport | Competitions |
|-------|-------------|
| Soccer | Premier League, Champions League, La Liga, Serie A, Bundesliga |
| Rugby | Six Nations, Rugby World Cup, Premiership |
| Snooker | World Championship, UK Championship, The Masters |

## How It Works

The app runs as a web page loaded by the Even app on your phone. The Even app renders it in a WebView and bridges communication to the G2 glasses over BLE.

```
[Vite Dev Server / GitHub Pages] <--HTTP(S)--> [iPhone WebView] <--BLE--> [G2 Glasses]
```

- **Glasses display:** Three-level text menu on the 576x288 monochrome green display. Navigate with scroll (ring/temple) and tap to select. `> ` marks the current selection, `< Back` returns to the previous screen.
- **Phone screen:** Sport tabs at the top, match cards below showing home/away teams, scores, and match status (FT, LIVE, or upcoming date).
- **Data:** TheSportsDB free API provides recent results and upcoming fixtures per league.

### Glasses Navigation

```
SPORTS SCORES          SOCCER                 Premier League
--------------------   --------------------   --------------------
> Soccer               > < Back               > < Back
  Rugby                  Premier League         Arsenal 2-1 Chelsea
  Snooker                Champions League       Spurs 0-0 Liverpool
                         La Liga                Man Utd 3-2 West Ham
```

Scroll up/down to move the `>` cursor. Tap to select. First item in sub-screens is always `< Back`.

## Project Structure

```
Even-G2-Sports-Scores/
├── index.html              # Entry point loaded by Even app WebView
├── styles.css              # Phone UI styling (dark theme)
├── src/
│   ├── Main.ts             # App bootstrap, event wiring
│   ├── GlassesDisplay.ts   # Even Hub SDK bridge + glasses navigation state machine
│   ├── PhoneUI.ts          # Phone DOM rendering (sport tabs, match cards)
│   ├── SportsService.ts    # TheSportsDB API client with caching
│   └── types.ts            # Shared TypeScript interfaces + sports config
├── app.json                # Even Hub app manifest
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite build configuration
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- [Even Hub CLI](https://www.npmjs.com/package/@evenrealities/evenhub-cli): `npm install -g @evenrealities/evenhub-cli`
- Even Realities G2 glasses + Even app on your phone

## Getting Started

### Install dependencies

```bash
npm install
```

### Start the dev server

```bash
npm run dev
```

This starts Vite at `http://0.0.0.0:5173`.

### Generate a QR code for the glasses

In a separate terminal:

```bash
npm run qr
```

The CLI will prompt for your local network IP on first run. Your phone must be on the same Wi-Fi network. Scan the QR code in the Even app to load the scores viewer.

You can also specify the IP directly:

```bash
evenhub qr --http -i <YOUR_LOCAL_IP> -p 5173
```

### Build for production

```bash
npm run build
```

Output goes to `dist/`. To package as an `.ehpk` for the Even Hub:

```bash
npm run pack
```

## Usage

1. Open the app via QR code in the Even app
2. **On glasses:** Scroll to a sport, tap to select → scroll to a competition, tap → scroll through scores
3. **On phone:** Tap a sport tab to view all competition scores

## Tech Stack

- **TypeScript** + **Vite** — fast dev server with HMR
- **Even Hub SDK** (`@evenrealities/even_hub_sdk`) — glasses display and event handling via BLE bridge
- **TheSportsDB** — free sports data API for scores and fixtures

## License

MIT
