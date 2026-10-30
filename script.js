"use strict";

const studentFullName = "Шликов Денис";
const journalNumber   = 19;

const collegeCoords  = { latitude: 48.94321, longitude: 24.73380 };
const pyramidsCoords = { latitude: 29.97925, longitude: 31.13419 };

const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

let watchId = null;            
let map = null;                
let lastPosition = null;       
let destinationCoords = null;  
let destinationMarker = null;  



// ---------- Math ----------

function convertDegreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

function calcDistance(startCoords, destCoords) {
    const earthRadius = 6371;
    const dLat = convertDegreesToRadians(destCoords.latitude - startCoords.latitude);
    const dLon = convertDegreesToRadians(destCoords.longitude - startCoords.longitude);
    const lat1 = convertDegreesToRadians(startCoords.latitude);
    const lat2 = convertDegreesToRadians(destCoords.latitude);

    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

    return 2 * earthRadius * Math.asin(Math.sqrt(a));
}



// ---------- Checks and getters ----------

function checkGeolocationSupport() {
    return Boolean(navigator.geolocation);
}

function checkCoordinateInRange(value, min, max) {
    return Number.isFinite(value) && value >= min && value <= max;
}

function getParsedCoordinate(text) {
    if (text.trim() === "") return NaN;
    return Number(text.replace(",", "."));
}

function getCoordinateFromUser(message, min, max) {
    let text = prompt(message);

    while (text !== null) {
        const value = getParsedCoordinate(text);
        if (checkCoordinateInRange(value, min, max)) return value;

        text = prompt(`Помилка! Потрібне число від ${min} до ${max}.\n` + message);
    }

    return null;
}

function getFormattedTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString("uk-UA");
}

function getErrorMessage(error) {
    const errorTypes = {
        0: "Невідома помилка",
        1: "Користувач заборонив доступ",
        2: "Позицію неможливо визначити",
        3: "Вичерпано час очікування"
    };

    let message = errorTypes[error.code] || errorTypes[0];
    if (error.code === 0 || error.code === 2) {
        message += " " + error.message;
    }

    return message;
}



// ---------- Output ----------

function setBoxContent(boxId, html) {
    document.getElementById(boxId).innerHTML = html;
}

function showError(boxId, message) {
    setBoxContent(boxId, `<p style="color:red; font-weight:600;">${message}</p>`);
}

function showNoSupportAlert() {
    alert("Oops, no geolocation support");
}

function createErrorHandler(boxId) {
    return error => showError(boxId, getErrorMessage(error));
}



// ---------- Map ----------

// Creates the main tile layer (no API key needed)
function createMainTileLayer() {
    return L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Tiles &copy; Esri" }
    );
}

function createBackupTileLayer() {
    return L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors, HOT"
    });
}

function enableTileFallback(targetMap, mainLayer) {
    let isSwitched = false;

    mainLayer.on("tileerror", () => {
        if (isSwitched) return;
        isSwitched = true;
        targetMap.removeLayer(mainLayer);
        createBackupTileLayer().addTo(targetMap);
    });
}

// Creates the map centered on the College
function createMap() {
    const newMap = L.map("map").setView(
        [collegeCoords.latitude, collegeCoords.longitude], 12
    );

    const mainLayer = createMainTileLayer().addTo(newMap);
    enableTileFallback(newMap, mainLayer);

    return newMap;
}

function initMap() {
    if (typeof L === "undefined") return;
    map = createMap();
}

function createPopupText(position, title) {
    const { latitude, longitude, accuracy } = position.coords;

    return `<b>${title}</b><br>` +
           `Широта: ${latitude.toFixed(6)}<br>` +
           `Довгота: ${longitude.toFixed(6)}<br>` +
           `Точність: ${Math.round(accuracy)} м<br>` +
           `Час: ${getFormattedTime(position.timestamp)}`;
}

function createPositionMarker(position, title) {
    const { latitude, longitude } = position.coords;

    return L.marker([latitude, longitude])
        .bindPopup(createPopupText(position, title));
}

function showMarkerOnMap(marker) {
    marker.addTo(map);
    map.setView(marker.getLatLng(), 15);
    marker.openPopup();
}

function saveLastPosition(position) {
    lastPosition = position.coords;
}

function addPositionMarker(position, title) {
    saveLastPosition(position);
    if (!map) return;

    showMarkerOnMap(createPositionMarker(position, title));
}

function createDestinationMarker(coords) {
    return L.circleMarker([coords.latitude, coords.longitude], {
        radius: 10,
        color: "red",
        fillColor: "red",
        fillOpacity: 0.6
    }).bindPopup(`<b>Пункт призначення</b><br>${coords.latitude}, ${coords.longitude}`);
}

function replaceDestinationMarker() {
    if (!map) return;
    if (destinationMarker) destinationMarker.remove();

    destinationMarker = createDestinationMarker(destinationCoords);
    destinationMarker.addTo(map);
}

function moveMapToDestination() {
    map.flyTo([destinationCoords.latitude, destinationCoords.longitude], 14);
    destinationMarker.openPopup();
    document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
}



// ---------- Texts for result blocks ----------

function createDistanceText(coords) {
    const toCollege = calcDistance(coords, collegeCoords);
    const toPyramids = calcDistance(coords, pyramidsCoords);

    return `<p>Ви за ${toCollege.toFixed(3)} км від Коледжу</p>` +
           `<p>Ви за ${toPyramids.toFixed(3)} км від пірамід у Гізі</p>`;
}

function createTrackingText(position) {
    const { latitude, longitude, accuracy } = position.coords;
    const km = calcDistance(position.coords, collegeCoords);

    return `<p>Широта: ${latitude}, довгота: ${longitude}</p>` +
           `<p>Точність: ${accuracy} м, час: ${getFormattedTime(position.timestamp)}</p>` +
           `<p>До Коледжу: ${km.toFixed(3)} км</p>`;
}

function createDestinationText() {
    let html = `<p>Пункт призначення: ${destinationCoords.latitude}, ${destinationCoords.longitude}</p>`;

    if (lastPosition) {
        const km = calcDistance(lastPosition, destinationCoords);
        html += `<p>Відстань від вашої позиції: ${km.toFixed(3)} км</p>`;
    }

    return html;
}



// ---------- Tasks (button handlers) ----------

// Task 1: success handler, shows coordinates and accuracy
function showCoordinates(position) {
    const { latitude, longitude, accuracy } = position.coords;

    setBoxContent("locationBox",
        `<p>You are at Latitude: ${latitude}, Longitude: ${longitude}</p>` +
        `<p>(with ${accuracy} meters accuracy)</p>`);
}

// Task 1: requests the current position
function showMyLocation() {
    if (!checkGeolocationSupport()) {
        showNoSupportAlert();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        showCoordinates,
        createErrorHandler("locationBox"),
        geoOptions
    );
}

// Task 2: success handler, shows distances
function showDistances(position) {
    setBoxContent("distanceBox", createDistanceText(position.coords));
}

// Task 2: requests the current position for distance calculation
function showMyDistances() {
    if (!checkGeolocationSupport()) {
        showNoSupportAlert();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        showDistances,
        createErrorHandler("distanceBox"),
        geoOptions
    );
}

// Task 3: success handler, shows data and adds a marker on every update
function showTracking(position) {
    setBoxContent("watchBox", createTrackingText(position));
    addPositionMarker(position, "Відстеження");
}

// Task 3: starts watching the position
function startWatch() {
    if (!checkGeolocationSupport()) {
        showNoSupportAlert();
        return;
    }

    if (watchId !== null) {
        setBoxContent("watchBox", "<p>Відстеження вже запущено.</p>");
        return;
    }

    watchId = navigator.geolocation.watchPosition(
        showTracking,
        createErrorHandler("watchBox"),
        geoOptions
    );
}

// Task 3: stops watching the position
function stopWatch() {
    if (watchId === null) return;

    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    setBoxContent("watchBox", "<p><i>Відстеження зупинено.</i></p>");
}

// Task 4: success handler, adds a marker and a hint
function showMapMarker(position) {
    addPositionMarker(position, "You are here");
    setBoxContent("mapBox", "<p>Маркер додано. Натисніть на нього.</p>");
}

// Task 4: requests the position and shows it on the map
function showMeOnMap() {
    if (!checkGeolocationSupport()) {
        showNoSupportAlert();
        return;
    }

    if (!map) {
        showError("mapBox", "Карта не завантажена (перевірте Інтернет).");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        showMapMarker,
        createErrorHandler("mapBox"),
        geoOptions
    );
}

// Task 5: asks for destination coordinates and shows them on the map
function setDestination() {
    const latitude = getCoordinateFromUser("Широта пункту призначення (від -90 до 90):", -90, 90);
    if (latitude === null) return;

    const longitude = getCoordinateFromUser("Довгота пункту призначення (від -180 до 180):", -180, 180);
    if (longitude === null) return;

    destinationCoords = { latitude, longitude };
    setBoxContent("destinationBox", createDestinationText());
    replaceDestinationMarker();
}

// Task 6: scrolls the map to the destination point
function scrollToDestination() {
    if (!destinationCoords) {
        showError("scrollBox", "Спочатку введіть координати (завдання 5).");
        return;
    }

    if (!map) return;

    moveMapToDestination();
    setBoxContent("scrollBox", "<p>Карту переміщено до пункту призначення.</p>");
}

document.addEventListener("DOMContentLoaded", initMap);
