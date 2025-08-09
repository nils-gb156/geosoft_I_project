"use-strict"

const map = L.map('map-fileupload').setView([52, 10.51], 6);
let routeLayer;

/**
 * Ausgewähltes GeoJSON Feature wird in MongoDB gespeichert.
 */
async function addRouteFromInput() {
    const input = document.getElementById("geojson-route-input");
    const file = input.files[0];
    const name = document.getElementById("station-name").value;
    let description = document.getElementById("station-description").value;
    const url = document.getElementById("station-url").value;

    if (!file) {
        alert("Bitte ein GeoJSON Feature oder FeatureCollection mit Point oder Polygon laden.");
        return;
    }

    if (!name) {
        alert("Bitte Name der Station angeben.");
        return;
    }

    if (!description && !url) {
        alert("Bitte Beschreibung der Station angeben.");
        return;
    }

    // Wenn URL eine Wikipediaseite ist, ersetze die Beschreibung durch den ersten Satz des Artikels
if (url && url.includes("wikipedia.org/wiki")) {
    try {
        // Titel korrekt encodieren
        const titlePart = url.split("/wiki/")[1];
        const encodedTitle = encodeURIComponent(titlePart);

        const wikiResponse = await fetch(
            `https://de.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`,
            { headers: { 'Accept': 'application/json' } }
        );

        if (!wikiResponse.ok) {
            throw new Error(`Wikipedia API antwortete mit Status ${wikiResponse.status}`);
        }

        const data = await wikiResponse.json();

        if (data.extract) {
            // Ersten Satz extrahieren
            const firstSentence = data.extract.split(".")[0];
            description = firstSentence;
        } else {
            console.warn("Wikipedia-Antwort enthält keine Beschreibung.");
        }
    }
    catch (error) {
        console.warn("Wikipedia-Beschreibung konnte nicht geladen werden:", error);
    }
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
                    fileName: fileName,
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

            // loadRouteList();
            alert("Station erfolgreich gespeichert")

            // Felder zurücksetzen
            routeLayer.clearLayers();
            map.setView([52, 10.51], 6);
            document.getElementById("geojson-route-input").value = null
            document.getElementById("station-name").value = null;
            document.getElementById("station-description").value = null;
            document.getElementById("station-url").value = null;

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
    //map = L.map('map-fileupload').setView([52, 10.51], 6);

    // OSM
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Route hinzufügen, sobald sie geladen wird
    routeLayer = L.geoJSON().addTo(map);

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
                map.fitBounds(routeLayer.getBounds());

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