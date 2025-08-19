"use strict"

const drawMap = L.map('map-draw').setView([51, 10], 6);
let drawnStation;

/**
 * Initialisiert die Karte beim Laden der Webseite.
 */
function initMapDrawStations() {

    // OSM
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(drawMap);

    // FeatureGroup zum Speichern der Zeichnungen
    drawnStation = new L.FeatureGroup();
    drawMap.addLayer(drawnStation);

    // Zeichnen-Controls
    const drawControl = new L.Control.Draw({
        draw: {
            polygon: true,
            polyline: false,
            circle: false,
            circlemarker: false,
            marker: true,
            rectangle: false
        },
        edit: {
            featureGroup: drawnStation
        }
    });
    drawMap.addControl(drawControl);

    // Event: Wenn etwas gezeichnet wird
    drawMap.on('draw:created', function (e) {

        const drawnlayer = e.layer;

        // Sicherstellen, dass nur ein Feature in der Karte ist
        drawnStation.clearLayers();
        drawnStation.addLayer(drawnlayer);
    });

}

/**
 * Aktueller GeoJSON Station Layer wird als .geojson in MongoDB gepseichert.
 */
async function addRouteFromDraw() {
    const geojson = drawnStation.toGeoJSON();
    const name = document.getElementById("draw-station-name").value;
    let description = document.getElementById("draw-station-description").value;
    const url = document.getElementById("draw-station-url").value;

    if (!geojson || !geojson.features || geojson.features.length === 0) {
        alert("Bitte erst ein Punkt oder Polygon in die Karte zeichnen.");
        return;
    }

    if (!name) {
        alert("Bitte Name der Station angeben.");
        return;
    }

    if (!description && !url) {
        alert("Bitte Beschreibung der Station oder Wikipedia URL angeben.");
        return;
    }

    if (url && url.includes("wikipedia.org/wiki")) {
        const wikiDescription = await getWikipediaFirstSentence(url);
        if (wikiDescription) {
            description = wikiDescription;
        }
    }

    if (!description) {
        alert("Keine gültige Beschreibung verfügbar.");
        return;
    }

    // Anfrage an Server senden
    try {
        const response = await fetch("/save-station", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name,
                description: description,
                url: url,
                geojson: geojson
            }),
        });

        if (!response.ok) {
            if (response.status === 409) {
                alert(`Eine Station mit dem Namen "${name}" existiert bereits.`);
            } else {
                throw new Error("Fehler beim Speichern");
            }
            return;
        }

        loadStations();
        alert("Station erfolgreich gespeichert")

        // Felder zurücksetzen
        drawnStation.clearLayers();
        drawMap.setView([52, 10.51], 6);
        document.getElementById("draw-station-name").value = null;
        document.getElementById("draw-station-description").value = null;
        document.getElementById("draw-station-url").value = null;

    } catch (error) {
        console.error("Speichern fehlgeschlagen:", error);
        alert("Fehler beim Speichern");
    }

}

// Warte bis das HTML-Elemnt existiert
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("map-draw")) {
        initMapDrawStations();
    }
})
