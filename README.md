# Weather.md

A small weather dashboard: live conditions for any city, air quality, UV index, a 6-day
forecast and a few cities at a glance — with a live clock and a light/dark theme.

**Live:** https://weathermd.pages.dev/

## Features

- **City search** — type any city name, or hit *Current Location* to use the browser's
  geolocation.
- **Today's weather** — temperature, feels like, high/low, humidity and wind.
- **AQI & UV** — US Air Quality Index plus the live UV index and today's maximum.
- **6-day forecast** — tomorrow onward, with icons per day.
- **Other Cities** — a fixed row of cities (Jaipur, Delhi, Noida, Agra, Lucknow, Bangalore).
- **Live clock** — time, date, and a sunrise/day/sunset/night icon.
- **Theme** — light and dark mode, remembered in `localStorage`.

## Tech

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies.

| Data | Source |
| --- | --- |
| Current weather + city lookup | [OpenWeatherMap](https://openweathermap.org/) — through the `/api/weather` function, so the API key never reaches the browser |
| 6-day forecast, UV index | [Open-Meteo](https://open-meteo.com/) — no API key needed |
| Air quality (US AQI) | [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) — no API key needed |

Icons are an inline SVG sprite at the top of `index.html`, so there are no image files
or icon fonts to load.

## Project structure

```
index.html               page markup + the inline SVG icon sprite
style.css                all styling, including the dark theme variables
script.js                all the front-end logic (search, rendering, clock, theme)
functions/api/weather.js Cloudflare Pages Function — proxies OpenWeatherMap
.dev.vars                local copy of the API key (gitignored, never committed)
```

## How the API key is handled

The OpenWeatherMap key is never sent to the browser. The page only ever calls its own
endpoint:

```
/api/weather?q=Goa            →  current weather for a city
/api/weather?lat=15.3&lon=74.1 →  current weather for coordinates
```

`functions/api/weather.js` runs on Cloudflare and adds the key server-side. That is also why
the page has to be served (see below) — opening `index.html` straight from disk will not work,
because there is no server to answer `/api/weather`.

The key lives in:

- **Production:** Cloudflare Pages → Settings → Environment variables → `OWM_KEY` (as a secret).
- **Locally:** a `.dev.vars` file in the project root: `OWM_KEY=your-key-here`.

`.dev.vars` is listed in `.gitignore` and must stay that way.

## Run it locally

Requires Node.js (for `npx`) and an OpenWeatherMap API key.

1. Create a `.dev.vars` file in the project root:

   ```
   OWM_KEY=your-openweathermap-key
   ```

2. Start the local Cloudflare Pages dev server:

   ```bash
   npx wrangler pages dev .
   ```

3. Open the URL wrangler prints (usually <http://localhost:8788>).

## Deploying

1. Push the repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**,
   then pick the repository and the `main` branch.
3. Build settings: **Framework preset** `None`, **Build command** empty, **Build output
   directory** `/`.
4. After the first deploy, add the key: **Settings → Environment variables** → name `OWM_KEY`,
   value your key, type **Secret** (add it for both Production and Preview), then redeploy.

Without `OWM_KEY` the site loads but every search answers with
"Server is missing the OWM_KEY secret."
