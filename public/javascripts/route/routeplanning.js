"use-strict"

const routePlanningMap = L.map('map-routes').setView([51, 10], 6);
let routeLayer;

/**
 * Initialisiert die Karte beim Laden der Webseite.
 */
function initMapFileInput() {

    // OSM
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(routePlanningMap);
}


async function loadStationsOnMap() {
    // Vorherige Marker entfernen
    if (routeLayer) {
        routePlanningMap.removeLayer(routeLayer);
    }

    try {
        const response = await fetch('/get-stations');
        const stations = await response.json();

        // Nur die ausgewählten Stationen
        const selectedNames = Array.from(document.querySelectorAll(".station-checkbox:checked"))
            .map(cb => cb.value);

        const selectedStations = stations.filter(station => selectedNames.includes(station.name));

        // GeoJSON Layer erstellen
        routeLayer = L.layerGroup(); // leere Gruppe

        selectedStations.forEach(station => {
            if (station.geojson) {
                L.geoJSON(station.geojson)
                 .bindPopup(`<b>${station.name}</b><br>${station.description}`)
                 .addTo(routeLayer);
            }
        });

        routeLayer.addTo(routePlanningMap);

    } catch (error) {
        console.error("Fehler beim Laden der Stationen für die Karte:", error);
    }
}

document.getElementById("select-all").addEventListener("change", loadStationsOnMap);



// Warte bis das HTML-Element existiert
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("map-routes")) {
        initMapFileInput();
    }
})
