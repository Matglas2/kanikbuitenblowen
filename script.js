"use strict";

// Beslisdrempels (km/u en mm regen)
const WIND_NEE = 30;   // boven deze windsnelheid: kansloos om aan te krijgen
const WIND_MISSCHIEN = 18; // erboven wordt het lastig
const REGEN_NEE = 0.2; // mm in het komende uur

const els = {
  answer: document.getElementById("answer"),
  reason: document.getElementById("reason"),
  details: document.getElementById("details"),
  wind: document.getElementById("wind"),
  rain: document.getElementById("rain"),
  place: document.getElementById("place"),
  retry: document.getElementById("retry"),
};

function setAnswer(text, kind, reason) {
  els.answer.textContent = text;
  els.answer.className = "answer answer--" + kind;
  els.reason.textContent = reason;
}

function showError(msg) {
  setAnswer("?", "maybe", msg);
  els.retry.hidden = false;
}

// Beslislogica op basis van wind en regen
function decide(windKmh, rainMm) {
  if (rainMm >= REGEN_NEE) {
    return ["NEE", "no", "Het regent, je blunt wordt drijfnat. Blijf lekker binnen."];
  }
  if (windKmh >= WIND_NEE) {
    return ["NEE", "no", "Veel te veel wind (" + Math.round(windKmh) + " km/u), die krijg je niet aan."];
  }
  if (windKmh >= WIND_MISSCHIEN) {
    return ["MISSCHIEN", "maybe", "Het waait flink (" + Math.round(windKmh) + " km/u). Zoek een luwe plek en bescherm de vlam."];
  }
  return ["JA", "yes", "Droog en weinig wind, perfect weer om buiten te blowen."];
}

async function reverseGeocode(lat, lon) {
  try {
    const url = "https://geocoding-api.open-meteo.com/v1/search?count=1" +
      "&latitude=" + lat + "&longitude=" + lon;
    // Open-Meteo heeft geen reverse endpoint; gebruik BigDataCloud (gratis, geen key).
    const r = await fetch(
      "https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=nl" +
      "&latitude=" + lat + "&longitude=" + lon
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d.city || d.locality || d.principalSubdivision || null;
  } catch (e) {
    return null;
  }
}

async function getWeather(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + lat +
    "&longitude=" + lon +
    "&current=precipitation,wind_speed_10m,rain,showers" +
    "&wind_speed_unit=kmh" +
    "&timezone=auto";
  const r = await fetch(url);
  if (!r.ok) throw new Error("weather " + r.status);
  return r.json();
}

async function run(lat, lon) {
  els.retry.hidden = true;
  setAnswer("…", "loading", "Weer wordt opgehaald…");
  try {
    const [weather, place] = await Promise.all([
      getWeather(lat, lon),
      reverseGeocode(lat, lon),
    ]);
    const cur = weather.current || {};
    const windKmh = Number(cur.wind_speed_10m) || 0;
    const rainMm = Number(cur.precipitation ?? cur.rain ?? 0) || 0;

    const [text, kind, reason] = decide(windKmh, rainMm);
    setAnswer(text, kind, reason);

    els.wind.textContent = Math.round(windKmh) + " km/u";
    els.rain.textContent = rainMm > 0 ? rainMm.toFixed(1) + " mm" : "droog";
    els.place.textContent = place || "onbekend";
    els.details.hidden = false;
  } catch (e) {
    showError("Kon het weer niet ophalen. Probeer het opnieuw.");
  }
}

function start() {
  if (!("geolocation" in navigator)) {
    // Val terug op Amsterdam
    run(52.37, 4.90);
    els.place.textContent = "Amsterdam (standaard)";
    return;
  }
  setAnswer("…", "loading", "Je locatie wordt opgevraagd…");
  navigator.geolocation.getCurrentPosition(
    (pos) => run(pos.coords.latitude, pos.coords.longitude),
    () => {
      // Geweigerd of mislukt: val terug op Amsterdam
      setAnswer("…", "loading", "Geen locatie, we gebruiken Amsterdam.");
      run(52.37, 4.90);
    },
    { timeout: 10000, maximumAge: 600000 }
  );
}

els.retry.addEventListener("click", start);
start();
