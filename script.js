// Cities shown in the "Other Cities" card
const OTHER_CITIES = ["Jaipur", "Delhi", "Noida", "Agra", "Lucknow", "Bangalore"];

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
    // Fetch current weather data
    const weatherResponse = await fetch(
      `/api/weather?q=${encodeURIComponent(city)}`,
    );

    // Check if city was found
    if (!weatherResponse.ok) {
      if (weatherResponse.status === 404) {
        throw new Error("City not found. Please enter a valid city.");
      }
      throw new Error(await errorMessage(weatherResponse, "Unable to fetch weather data."));
    }

    const weatherData = await weatherResponse.json();

    // Display the weather data
    displayWeather(weatherData);

    // The forecast, air quality and UV index all use the coordinates
    const lat = weatherData.coord.lat;
    const lon = weatherData.coord.lon;
    fetchForecast(lat, lon);
    fetchAirQuality(lat, lon);
    fetchUvIndex(lat, lon);
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoading();
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
      fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
    },
    // Error: the location request failed
    function (error) {
      hideLoading();
      showLocationError(error);
    },
    { timeout: 10000 },
  );
}

// Fetch and show the weather for a latitude and longitude
async function fetchWeatherByCoords(lat, lon) {
  // Show loading and hide any old error
  showLoading();
  hideError();

  try {
    // Fetch current weather data
    const weatherResponse = await fetch(
      `/api/weather?lat=${lat}&lon=${lon}`,
    );

    if (!weatherResponse.ok) {
      throw new Error(await errorMessage(weatherResponse, "Unable to fetch weather data. Please try again."));
    }

    const weatherData = await weatherResponse.json();

    // Display the weather data
    displayWeather(weatherData);

    // The forecast, air quality and UV index use these coordinates
    fetchForecast(lat, lon);
    fetchAirQuality(lat, lon);
    fetchUvIndex(lat, lon);
  } catch (error) {
    // fetch() throws a TypeError when there is no internet connection
    if (error instanceof TypeError) {
      showError("Network error. Please check your internet connection.");
    } else {
      showError(error.message);
    }
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
// DISPLAY CURRENT WEATHER
// --------------------------------------------------
function displayWeather(data) {
  // City and country
  cityName.textContent = `${data.name}, ${data.sys.country}`;

  // Weather icon
  const iconCode = data.weather[0].icon;
  weatherIcon.innerHTML = iconSvg(getWeatherIconId(iconCode));

  // Temperature and condition
  temperature.textContent = `${Math.round(data.main.temp)}°C`;
  condition.textContent = data.weather[0].description;

  // Details
  feelsLike.textContent = `${Math.round(data.main.feels_like)}°C`;
  highTemp.textContent = `${Math.round(data.main.temp_max)}°C`;
  lowTemp.textContent = `${Math.round(data.main.temp_min)}°C`;
  humidity.textContent = `${data.main.humidity}%`;
  windSpeed.textContent = `${Math.round(data.wind.speed * 3.6)} km/h`; // Convert m/s to km/h
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
      const response = await fetch(
        `/api/weather?q=${encodeURIComponent(city)}`,
      );

      if (!response.ok) {
        throw new Error("Unavailable");
      }

      const data = await response.json();
      addCityCard(data.name, `${Math.round(data.main.temp)}°C`, iconSvg(getWeatherIconId(data.weather[0].icon)));
    } catch (error) {
      addCityCard(city, "--", iconSvg("ic-cloud"));
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

// Convert an Open-Meteo weather code (WMO) into a sprite icon id
function getWeatherCodeIconId(code) {
  if (code === 0) {
    return "ic-sun"; // Clear sky
  } else if (code === 1 || code === 2) {
    return "ic-cloud-sun"; // Mainly clear / partly cloudy
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
    return "ic-sun";
  }
}

// Build an inline SVG icon that points at the sprite in index.html
function iconSvg(id) {
  return `<svg class="icon" aria-hidden="true"><use href="#${id}"></use></svg>`;
}

// Convert an OpenWeatherMap icon code into a sprite icon id
function getWeatherIconId(iconCode) {
  const iconMap = {
    "01d": "ic-sun", // Clear sky day
    "01n": "ic-moon", // Clear sky night
    "02d": "ic-cloud-sun", // Few clouds day
    "02n": "ic-cloud-moon", // Few clouds night
    "03d": "ic-cloud", // Scattered clouds
    "03n": "ic-cloud",
    "04d": "ic-cloud", // Broken clouds
    "04n": "ic-cloud",
    "09d": "ic-rain", // Shower rain
    "09n": "ic-rain",
    "10d": "ic-rain", // Rain
    "10n": "ic-rain",
    "11d": "ic-thunder", // Thunderstorm
    "11n": "ic-thunder",
    "13d": "ic-snow", // Snow
    "13n": "ic-snow",
    "50d": "ic-fog", // Mist
    "50n": "ic-fog",
  };
  return iconMap[iconCode] || "ic-sun";
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

// Read the message from a failed response (for example a missing API key)
async function errorMessage(response, fallback) {
  try {
    const body = await response.json();
    if (body && body.error) {
      return body.error;
    }
  } catch (error) {
    // ignore and use the fallback
  }
  return fallback;
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
