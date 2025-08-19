"use-strict"

const fileuploadMap = L.map('map-fileupload').setView([51, 10], 6);
let routeLayer;

/**
 * Ausgewähltes GeoJSON Feature wird in MongoDB gespeichert.
 */
async function addRouteFromInput() {
    const input = document.getElementById("geojson-route-input");
    const file = input.files[0];
    const name = document.getElementById("fileupload-station-name").value;
    let description = document.getElementById("fileupload-station-description").value;
    const url = document.getElementById("fileupload-station-url").value;

    if (!file) {
        alert("Bitte ein GeoJSON Feature oder FeatureCollection mit Point oder Polygon laden.");
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

    const reader = new FileReader();

    reader.onload = async function (e) {
        let parsedGeojson;

        try {
            parsedGeojson = JSON.parse(e.target.result);
        } catch (err) {
            alert("Ungültiges JSON-Format.");
            return;
        }

        const fileName = file.name;

        // Anfrage an Server senden
        try {
            const response = await fetch("/save-station", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name,
                    description: description,
                    url: url,
                    geojson: parsedGeojson
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
            routeLayer.clearLayers();
            fileuploadMap.setView([52, 10.51], 6);
            document.getElementById("geojson-route-input").value = null
            document.getElementById("fileupload-station-name").value = null;
            document.getElementById("fileupload-station-description").value = null;
            document.getElementById("fileupload-station-url").value = null;

        } catch (error) {
            console.error("Speichern fehlgeschlagen:", error);
            alert("Fehler beim Speichern");
        }
    }

    reader.readAsText(file);
}

/**
 * Initialisiert die Karte beim Laden der Webseite.
 */
function initMapFileInput() {

    // OSM
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(fileuploadMap);

    // Route hinzufügen, sobald sie geladen wird
    routeLayer = L.geoJSON().addTo(fileuploadMap);

    document.getElementById("geojson-route-input").addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const geojson = JSON.parse(e.target.result);

                // Typabsicherung für GeoJSON Point oder Polygon als Feature oder FeatureCollection
                if ( !hasExactlyOneFeature(geojson) || (!isValidGeoJSONPoint(geojson) && !isValidGeoJSONPolygon(geojson))) {
                    alert("Ungültiges GeoJSON-Format. Bitte genau ein Feature oder FeatureCollection mit Point oder Polygon laden.");
                    return;
                }

                // Vorherige Route entfernen und neue hinzufügen
                routeLayer.clearLayers();
                routeLayer.addData(geojson);
                fileuploadMap.fitBounds(routeLayer.getBounds());

            } catch (error) {
                console.error("Fehler beim Parsen:", error);
                alert("Ungültiges GeoJSON.");
            }
        };

        reader.readAsText(file);
    });

}

// Warte bis das HTML-Element existiert
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("map-fileupload")) {
        initMapFileInput();
    }
})