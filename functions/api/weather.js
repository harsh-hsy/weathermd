// Cloudflare Pages Function — route: /api/weather
//
// It proxies OpenWeatherMap so the API key is never sent to the browser.
//
// SETUP (do this once, in the Cloudflare dashboard — no local setup needed):
//   Pages project → Settings → Environment variables → add a variable
//     Name:  OWM_KEY
//     Value: your OpenWeatherMap key
//   Mark it as a secret, then redeploy.
//
// (Optional: to preview locally, put OWM_KEY=... in a .dev.vars file and
//  run `npx wrangler pages dev .`.)
//
// The frontend calls /api/weather?q=City or /api/weather?lat=..&lon=..

export async function onRequestGet(context) {
  const { request, env } = context;
  const params = new URL(request.url).searchParams;

  const city = params.get("q");
  const lat = params.get("lat");
  const lon = params.get("lon");

  // Build the OpenWeatherMap query from either a city or coordinates
  let query;
  if (city) {
    query = `q=${encodeURIComponent(city)}`;
  } else if (lat && lon) {
    query = `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  } else {
    return jsonResponse({ error: "Pass ?q=city or ?lat=..&lon=.." }, 400);
  }

  if (!env.OWM_KEY) {
    return jsonResponse({ error: "Server is missing the OWM_KEY secret." }, 500);
  }

  const owmUrl = `https://api.openweathermap.org/data/2.5/weather?${query}&appid=${env.OWM_KEY}&units=metric`;
  const response = await fetch(owmUrl);

  // Pass the body and status straight through (so "city not found" 404 still works)
  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "content-type": "application/json",
      // Let the CDN cache this briefly so repeat visits don't use up the API quota
      "cache-control": "public, max-age=600",
    },
  });
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
