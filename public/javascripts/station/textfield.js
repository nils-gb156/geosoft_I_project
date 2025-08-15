"use strict"

/**
 * Aktuelles GeoJSON Station Feature wird als .geojson in MongoDB gepseichert.
 */
async function addRouteFromTextfield() {
    const geojsonText = document.getElementById("geojson-station-textfield").value;
    const name = document.getElementById("textfield-station-name").value;
    let description = document.getElementById("textfield-station-description").value;
    const url = document.getElementById("textfield-station-url").value;
    let parsedGeojson;

    try {
        parsedGeojson = JSON.parse(geojsonText);
    } catch (error) {
        alert("Bitte gültiges GeoJSON einfügen!");
        return;
    }

    if (!hasExactlyOneFeature(parsedGeojson) || (!isValidGeoJSONPoint(parsedGeojson) && !isValidGeoJSONPolygon(parsedGeojson))) {
        alert("Ungültiges GeoJSON-Format. Bitte genau ein Feature oder FeatureCollection mit Point oder Polygon laden.");
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
        document.getElementById("geojson-station-textfield").value = null
        document.getElementById("textfield-station-name").value = null;
        document.getElementById("textfield-station-description").value = null;
        document.getElementById("textfield-station-url").value = null;

    } catch (error) {
        console.error("Speichern fehlgeschlagen:", error);
        alert("Fehler beim Speichern");
    }
}
