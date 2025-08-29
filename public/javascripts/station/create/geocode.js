"use strict"

const geocodeMap = L.map('map-geocode').setView([51, 10], 6);
let geocodeMarker = null;

/**
 * Station aus Geokodierung wird in MongoDB gespeichert.
 */
async function addStationFromGeocode() {
    
    const name = document.getElementById("geocode-station-name").value;
    let description = document.getElementById("geocode-station-description").value;
    const url = document.getElementById("geocode-station-url").value;

    if (!geocodeMarker) {
        alert("Bitte nach einer Adresse suchen.");
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

    // GeoJSON direkt vom Marker erzeugen
    const latlng = geocodeMarker.getLatLng();
    const geojson = {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [latlng.lng, latlng.lat]
        }
    };

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
            geocodeMap.setView([51, 10], 6);
            geocodeMap.removeLayer(geocodeMarker);
            document.getElementById("geocode-station-address").value = null
            document.getElementById("geocode-station-name").value = null;
            document.getElementById("geocode-station-description").value = null;
            document.getElementById("geocode-station-url").value = null;

        } catch (error) {
            console.error("Speichern fehlgeschlagen:", error);
            alert("Fehler beim Speichern");
        }
}

/**
 * Initialisiert die Karte beim Laden der Webseite.
 */
function initMapGeocode() {

    // OSM
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(geocodeMap);
    
}

// Warte bis das HTML-Element existiert
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("map-geocode")) {
        initMapGeocode();
    }
})

// Dropdown für Vorschläge erzeugen
function createSuggestionDropdown() {
    let dropdown = document.getElementById("geocode-suggestion-dropdown");
    if (!dropdown) {
        dropdown = document.createElement("div");
        dropdown.id = "geocode-suggestion-dropdown";
        dropdown.className = "list-group position-absolute w-100";
        dropdown.style.zIndex = "1000";
        document.getElementById("geocode-station-address").parentNode.appendChild(dropdown);
    }
    return dropdown;
}

// Vorschläge anzeigen
function showSuggestions(suggestions) {
    const dropdown = createSuggestionDropdown();
    dropdown.innerHTML = "";
    suggestions.forEach(suggestion => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "list-group-item list-group-item-action";
        item.textContent = suggestion.display_name;
        item.onclick = () => {
            document.getElementById("geocode-station-address").value = suggestion.display_name;
            document.getElementById("geocode-station-description").value = suggestion.display_name;
            dropdown.innerHTML = "";
            setMarkerOnMap(suggestion);
        };
        dropdown.appendChild(item);
    });
    if (suggestions.length === 0) dropdown.innerHTML = "";
}

// Marker auf Karte setzen
function setMarkerOnMap(suggestion) {
    const lat = parseFloat(suggestion.lat);
    const lon = parseFloat(suggestion.lon);
    if (geocodeMarker) {
        geocodeMap.removeLayer(geocodeMarker);
    }
    geocodeMarker = L.marker([lat, lon]).addTo(geocodeMap);
    geocodeMap.setView([lat, lon], 16);
}

// Adresssuche mit Nominatim
let debounceTimeout;

document.getElementById("geocode-station-address").addEventListener("input", function (e) {
    clearTimeout(debounceTimeout);
    const query = e.target.value;
    if (query.length < 3) {
        showSuggestions([]);
        return;
    }
    debounceTimeout = setTimeout(async () => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&viewbox=-31.266,71.185,39.869,27.636&bounded=1`;
        const response = await fetch(url, { headers: { "Accept-Language": "de" } });
        const results = await response.json();
        showSuggestions(results);
    }, 300); // 300 ms Pause nach letzter Eingabe
});

// Klick außerhalb des Dropdowns schließt Vorschläge
document.addEventListener("click", function (e) {
    const dropdown = document.getElementById("geocode-suggestion-dropdown");
    if (dropdown && !dropdown.contains(e.target) && e.target.id !== "geocode-station-address") {
        dropdown.innerHTML = "";
    }
});