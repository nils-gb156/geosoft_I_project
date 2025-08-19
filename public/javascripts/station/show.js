"use strict"

const stationMap = L.map('station-map').setView([51, 10], 6);
let activeStationLayer;
loadStations();

/**
 * Initialisiert die Karte zum Anzeigen der Stationen beim Laden der Webseite.
 */
function initStationMap() {
    // OSM
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(stationMap);

}

/**
 * Zeigt das übergebene GeoJSON Station Feature auf der Karte an.
 * @param {*} station 
 */
function showStationOnMap(station) {
    let geojson = station.geojson;
    activeStationLayer = L.geoJSON().addTo(stationMap);
    activeStationLayer.clearLayers(),
        activeStationLayer.addData(geojson);
    stationMap.fitBounds(activeStationLayer.getBounds());

}

// Warte bis das HTML-Element existiert
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("station-map")) {
        initStationMap();
    }
})