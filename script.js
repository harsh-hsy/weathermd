// Cities shown in the "Other Cities" card.
// Coordinates are hardcoded because Open-Meteo returns no city name, and
// searching "Bangalore" resolves to an unrelated town in Pakistan.
const OTHER_CITIES = [
  { name: "Jaipur", lat: 26.9196, lon: 75.7878 },
  { name: "Delhi", lat: 28.652, lon: 77.2315 },
  { name: "Noida", lat: 28.58, lon: 77.33 },
  { name: "Agra", lat: 27.1833, lon: 78.0167 },
  { name: "Lucknow", lat: 26.8393, lon: 80.9231 },
  { name: "Bangalore", lat: 12.9719, lon: 77.5937 },
];

// Get DOM elements
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const locationBtn = document.getElementById("locationBtn");
const loading = document.getElementById("loading");
const errorDiv = document.getElementById("error");
const forecastContainer = document.getElementById("forecastContainer");
const citiesContainer = document.getElementById("citiesContainer");
const themeBtn = document.getElementById("themeBtn");

// Weather display elements
const cityName = document.getElementById("cityName");
const weatherIcon = document.getElementById("weatherIcon");
const temperature = document.getElementById("temperature");
const condition = document.getElementById("condition");
const feelsLike = document.getElementById("feelsLike");
const highTemp = document.getElementById("highTemp");
const lowTemp = document.getElementById("lowTemp");
const humidity = document.getElementById("humidity");
const windSpeed = document.getElementById("windSpeed");

// Air quality and UV elements
const aqiValue = document.getElementById("aqiValue");
const aqiText = document.getElementById("aqiText");
const uvValue = document.getElementById("uvValue");
const uvMax = document.getElementById("uvMax");

// Live clock elements
const clock = document.getElementById("clock");
const dateText = document.getElementById("date");
const timeIcon = document.getElementById("timeIcon");
const timeLabel = document.getElementById("timeLabel");

// Add click event to search button
searchBtn.addEventListener("click", fetchWeather);

// Allow pressing Enter to search
cityInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    fetchWeather();
  }
});

// Get the weather for the user's current location
locationBtn.addEventListener("click", getLocationWeather);

// --------------------------------------------------
// THEME (dark / light)
// --------------------------------------------------
// Read the saved theme (guarded because file:// can block storage)
let savedTheme = "light";
try {
  savedTheme = localStorage.getItem("theme") || "light";
} catch (error) {
  savedTheme = "light";
}
applyTheme(savedTheme);

// Switch theme when the button is clicked
themeBtn.addEventListener("click", function () {
  const isDark = document.body.classList.contains("dark-mode");
  applyTheme(isDark ? "light" : "dark");
});

// Apply a theme, remember it, and swap the button icon
function applyTheme(theme) {
  document.body.classList.toggle("dark-mode", theme === "dark");

  try {
    localStorage.setItem("theme", theme);
  } catch (error) {
    // ignore storage errors
  }

  // Show a sun in dark mode, a moon in light mode
  themeBtn.innerHTML = iconSvg(theme === "dark" ? "ic-sun" : "ic-moon");
}

// Main function to fetch weather data by city name
async function fetchWeather() {
  const city = cityInput.value.trim();

  // Check if city is entered
  if (!city) {
    showError("Please enter a city name.");
    return;
  }

  // Show loading and hide any old error
  showLoading();
  hideError();

  try {
    // Turn the typed name into coordinates
    const place = await geocodeCity(city);

    // Check if city was found
    if (!place) {
      throw new Error("City not found. Please enter a valid city.");
    }

    // Display the weather data
    await showWeatherFor(place.lat, place.lon, `${place.name}, ${place.countryCode}`);
  } catch (error) {
    showError(friendlyError(error));
  } finally {
    hideLoading();
  }
}

// --------------------------------------------------
// PLACE LOOKUP
// --------------------------------------------------
// Turn a typed city name into coordinates using the keyless Open-Meteo geocoder
async function geocodeCity(city) {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
  );

  if (!response.ok) {
    throw new Error("Unable to search for that city right now.");
  }

  const data = await response.json();
  const place = data.results && data.results[0];

  if (!place) {
    return null;
  }

  return {
    name: place.name,
    countryCode: place.country_code,
    lat: place.latitude,
    lon: place.longitude,
  };
}

// Turn coordinates into a "City, CC" label, falling back to a generic name
async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );

    if (!response.ok) {
      throw new Error("Reverse geocoding failed.");
    }

    const data = await response.json();
    const name = data.city || data.locality;

    if (!name) {
      throw new Error("No city name for these coordinates.");
    }

    return data.countryCode ? `${name}, ${data.countryCode}` : name;
  } catch (error) {
    // The weather still works without a name, so keep going
    return "Your Location";
  }
}

// --------------------------------------------------
// CURRENT LOCATION
// --------------------------------------------------
// Ask the browser for the user's location when the button is clicked
function getLocationWeather() {
  // Some older browsers do not support geolocation
  if (!navigator.geolocation) {
    showError("Location is not supported by this browser.");
    return;
  }

  // Show loading while we wait for the location and the weather
  showLoading();
  hideError();

  navigator.geolocation.getCurrentPosition(
    // Success: we received the latitude and longitude
    function (position) {
      showLocationWeather(position.coords.latitude, position.coords.longitude);
    },
    // Error: the location request failed
    function (error) {
      hideLoading();
      showLocationError(error);
    },
    { timeout: 10000 },
  );
}

// Name the coordinates and show their weather
async function showLocationWeather(lat, lon) {
  try {
    const label = await reverseGeocode(lat, lon);
    await showWeatherFor(lat, lon, label);
  } catch (error) {
    showError(friendlyError(error));
  } finally {
    hideLoading();
  }
}

// Show a friendly message when location access fails
function showLocationError(error) {
  // error.code: 1 = permission denied, 2 = position unavailable, 3 = timeout
  if (error.code === 1) {
    showError("Location permission denied. Please allow access or search for a city instead.");
  } else if (error.code === 2) {
    showError("Your location is unavailable right now. Please try again or search for a city.");
  } else if (error.code === 3) {
    showError("The location request timed out. Please try again.");
  } else {
    showError("Unable to get your location. Please search for a city instead.");
  }
}

// --------------------------------------------------
// CURRENT WEATHER
// --------------------------------------------------
// Fetch the current conditions and today's high/low for a pair of coordinates
async function fetchCurrentWeather(lat, lon) {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`,
  );

  if (!response.ok) {
    throw new Error("Unable to fetch weather data. Please try again.");
  }

  return response.json();
}

// Load everything the dashboard shows for one place
async function showWeatherFor(lat, lon, label) {
  const data = await fetchCurrentWeather(lat, lon);

  displayWeather(data, label);

  // The forecast, air quality and UV index use the same coordinates
  fetchForecast(lat, lon);
  fetchAirQuality(lat, lon);
  fetchUvIndex(lat, lon);
}

function displayWeather(data, label) {
  const current = data.current;

  // City and country
  cityName.textContent = label;

  // Weather icon
  weatherIcon.innerHTML = iconSvg(
    getWeatherCodeIconId(current.weather_code, current.is_day),
  );

  // Temperature and condition
  temperature.textContent = `${Math.round(current.temperature_2m)}°C`;
  condition.textContent = getWeatherDescription(current.weather_code);

  // Details
  feelsLike.textContent = `${Math.round(current.apparent_temperature)}°C`;
  highTemp.textContent = `${Math.round(data.daily.temperature_2m_max[0])}°C`;
  lowTemp.textContent = `${Math.round(data.daily.temperature_2m_min[0])}°C`;
  humidity.textContent = `${current.relative_humidity_2m}%`;
  windSpeed.textContent = `${Math.round(current.wind_speed_10m)} km/h`; // Open-Meteo already gives km/h
}

// --------------------------------------------------
// AIR QUALITY
// --------------------------------------------------
// Fetch and show the Air Quality Index for a latitude and longitude
async function fetchAirQuality(lat, lon) {
  try {
    // Open-Meteo gives the US AQI as a number (for example 42)
    const response = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=auto`,
    );

    if (!response.ok) {
      throw new Error("Air quality unavailable.");
    }

    const data = await response.json();
    const aqi = data.current.us_aqi;

    aqiValue.textContent = Math.round(aqi);
    aqiText.textContent = getAqiLabel(aqi);
  } catch (error) {
    aqiValue.textContent = "--";
    aqiText.textContent = "Unavailable";
  }
}

// Turn the US AQI number into a simple label
function getAqiLabel(aqi) {
  if (aqi <= 50) {
    return "Good";
  } else if (aqi <= 100) {
    return "Moderate";
  } else if (aqi <= 150) {
    return "Unhealthy for Sensitive Groups";
  } else if (aqi <= 200) {
    return "Unhealthy";
  } else if (aqi <= 300) {
    return "Very Unhealthy";
  } else {
    return "Hazardous";
  }
}

// --------------------------------------------------
// UV INDEX
// --------------------------------------------------
// Fetch and show the live UV and today's maximum UV for a latitude and longitude
async function fetchUvIndex(lat, lon) {
  try {
    // current.uv_index = live UV now, daily.uv_index_max = today's highest UV
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=uv_index&daily=uv_index_max&forecast_days=1&timezone=auto`,
    );

    if (!response.ok) {
      throw new Error("UV index unavailable.");
    }

    const data = await response.json();

    uvValue.textContent = Math.round(data.current.uv_index);
    uvMax.textContent = Math.round(data.daily.uv_index_max[0]);
  } catch (error) {
    uvValue.textContent = "--";
    uvMax.textContent = "--";
  }
}

// --------------------------------------------------
// OTHER CITIES
// --------------------------------------------------
// Load the weather for the fixed list of other cities
async function loadOtherCities() {
  citiesContainer.innerHTML = "";

  for (const city of OTHER_CITIES) {
    try {
      const data = await fetchCurrentWeather(city.lat, city.lon);
      const icon = iconSvg(
        getWeatherCodeIconId(data.current.weather_code, data.current.is_day),
      );

      addCityCard(city.name, `${Math.round(data.current.temperature_2m)}°C`, icon);
    } catch (error) {
      addCityCard(city.name, "--", iconSvg("ic-cloud"));
    }
  }
}

// Create one small card inside the "Other Cities" card
function addCityCard(name, temp, icon) {
  const card = document.createElement("div");
  card.className = "city-card";
  card.innerHTML = `
        <div class="city-name">${name}</div>
        <div class="city-temp">${temp}</div>
        <div class="city-icon">${icon}</div>
    `;

  citiesContainer.appendChild(card);
}

// --------------------------------------------------
// 6-DAY FORECAST
// --------------------------------------------------
// Fetch and show the 6-day forecast for a latitude and longitude
async function fetchForecast(lat, lon) {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=auto`,
    );

    if (!response.ok) {
      throw new Error("Forecast unavailable.");
    }

    const data = await response.json();
    displayForecast(data.daily);
  } catch (error) {
    forecastContainer.innerHTML = `<p class="placeholder-text">Forecast unavailable.</p>`;
  }
}

// Show the daily forecast inside the forecast card
function displayForecast(daily) {
  // Clear previous forecast
  forecastContainer.innerHTML = "";

  daily.time.forEach((dayString, index) => {
    // Skip today — this card shows the next days only
    if (index === 0) {
      return;
    }

    // Turn "2026-09-25" into a Date so we can show the weekday name
    const date = new Date(`${dayString}T00:00:00`);
    const maxTemp = Math.round(daily.temperature_2m_max[index]);
    const minTemp = Math.round(daily.temperature_2m_min[index]);
    const icon = iconSvg(getWeatherCodeIconId(daily.weather_code[index]));

    // Create the day label
    let dayLabel;
    if (index === 1) {
      dayLabel = "Tomorrow";
    } else {
      dayLabel = date.toLocaleDateString("en-US", { weekday: "short" });
    }

    // Create the forecast card
    const card = document.createElement("div");
    card.className = "forecast-card";
    card.innerHTML = `
            <div class="forecast-day">${dayLabel}</div>
            <div class="forecast-icon">${icon}</div>
            <div class="forecast-temps">${maxTemp}°C / ${minTemp}°C</div>
        `;

    forecastContainer.appendChild(card);
  });
}

// Convert an Open-Meteo weather code (WMO) into a sprite icon id.
// is_day is 1 in daylight and 0 at night; when it is missing we assume day.
function getWeatherCodeIconId(code, isDay) {
  const night = isDay === 0;

  if (code === 0) {
    return night ? "ic-moon" : "ic-sun"; // Clear sky
  } else if (code === 1 || code === 2) {
    return night ? "ic-cloud-moon" : "ic-cloud-sun"; // Mainly clear / partly cloudy
  } else if (code === 3) {
    return "ic-cloud"; // Overcast
  } else if (code === 45 || code === 48) {
    return "ic-fog"; // Fog
  } else if (code >= 51 && code <= 57) {
    return "ic-drizzle"; // Drizzle
  } else if (code >= 61 && code <= 67) {
    return "ic-rain"; // Rain
  } else if (code >= 71 && code <= 77) {
    return "ic-snow"; // Snow
  } else if (code >= 80 && code <= 82) {
    return "ic-rain"; // Rain showers
  } else if (code === 85 || code === 86) {
    return "ic-snow"; // Snow showers
  } else if (code >= 95) {
    return "ic-thunder"; // Thunderstorm
  } else {
    return night ? "ic-moon" : "ic-sun";
  }
}

// Turn an Open-Meteo weather code (WMO) into readable text
function getWeatherDescription(code) {
  if (code === 0) {
    return "Clear sky";
  } else if (code === 1) {
    return "Mainly clear";
  } else if (code === 2) {
    return "Partly cloudy";
  } else if (code === 3) {
    return "Overcast";
  } else if (code === 45) {
    return "Fog";
  } else if (code === 48) {
    return "Depositing rime fog";
  } else if (code >= 51 && code <= 55) {
    return "Drizzle";
  } else if (code === 56 || code === 57) {
    return "Freezing drizzle";
  } else if (code >= 61 && code <= 65) {
    return "Rain";
  } else if (code === 66 || code === 67) {
    return "Freezing rain";
  } else if (code >= 71 && code <= 75) {
    return "Snow";
  } else if (code === 77) {
    return "Snow grains";
  } else if (code >= 80 && code <= 82) {
    return "Rain showers";
  } else if (code === 85 || code === 86) {
    return "Snow showers";
  } else if (code === 95) {
    return "Thunderstorm";
  } else if (code === 96 || code === 99) {
    return "Thunderstorm with hail";
  } else {
    return "Unknown";
  }
}

// Build an inline SVG icon that points at the sprite in index.html
function iconSvg(id) {
  return `<svg class="icon" aria-hidden="true"><use href="#${id}"></use></svg>`;
}

// Show loading message
function showLoading() {
  loading.classList.remove("hidden");
}

// Hide loading message
function hideLoading() {
  loading.classList.add("hidden");
}

// Show error message
function showError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.remove("hidden");
}

// Hide error message
function hideError() {
  errorDiv.classList.add("hidden");
}

// Turn a thrown error into a message worth showing
function friendlyError(error) {
  // fetch() throws a TypeError when there is no internet connection
  if (error instanceof TypeError) {
    return "Network error. Please check your internet connection.";
  }
  return error.message;
}

// --------------------------------------------------
// LIVE CLOCK (Hours : Minutes : Seconds AM/PM)
// --------------------------------------------------
function updateClock() {
  const now = new Date();

  // Get the current hours, minutes and seconds
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // Work out if it is AM or PM
  const ampm = hours >= 12 ? "PM" : "AM";

  // Convert 24-hour time into 12-hour time
  hours = hours % 12;
  if (hours === 0) {
    hours = 12; // midnight (0) should show as 12
  }

  // Add a leading zero when needed (9 -> 09)
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  // Show the time, for example: 11:24:37 PM
  clock.textContent = `${hh}:${mm}:${ss} ${ampm}`;

  // Show the day, date, month and year, for example: Thursday, 24 September 2026
  dateText.textContent = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Show the icon and label for the current time of day
  const timeOfDay = getTimeOfDay(now.getHours());
  timeIcon.innerHTML = iconSvg(timeOfDay.id);
  timeLabel.textContent = timeOfDay.label;
}

// Work out the icon and label for the current time of day
function getTimeOfDay(hour) {
  if (hour >= 5 && hour < 7) {
    return { id: "ic-sunrise", label: "Sunrise" };
  } else if (hour >= 7 && hour < 17) {
    return { id: "ic-sun", label: "Day" };
  } else if (hour >= 17 && hour < 19) {
    return { id: "ic-sunset", label: "Sunset" };
  } else {
    return { id: "ic-moon", label: "Night" };
  }
}

// Start the clock once and update it every second
updateClock();
setInterval(updateClock, 1000);

// Load the "Other Cities" card when the page opens
loadOtherCities();
