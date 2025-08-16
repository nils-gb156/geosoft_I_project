"use strict"

const stationMap = L.map('station-map').setView([52, 10.51], 6);
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

/**
 * Läd alle Stationen aus MongoDB und stellt sie in der Tabelle dar.
 */
async function loadStations() {
    try {
        const response = await fetch('/get-stations');
        const stations = await response.json();

        const tableBody = document.getElementById("stations-table-body");
        tableBody.innerHTML = "";
        stations.forEach(station => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${station.name}</td>
                <td>${station.description}</td>
                <td><a href="${station.url}" target="_blank">Link</a></td>
                <td class="text-center"><img src="images/view.png" alt="Ansehen" data-action="view" style="height: 25px; cursor: pointer;"></td>   
                <td class="text-center"><img src="images/edit.png" alt="Bearbeiten" data-action="edit" style="height: 25px; cursor: pointer;"></td>
                <td class="text-center"><img src="images/delete.png" alt="Löschen" data-action="delete" style="height: 25px; cursor: pointer;"></td>
            `;
            row.dataset.station = JSON.stringify(station);
            tableBody.appendChild(row);

        });
    }
    catch (error) {
        console.error("Fehler beim Laden der Stationen:", error);
    }
}

document.getElementById("stations-table-body").addEventListener("click", (event) => {
    const action = event.target.dataset.action;
    // Klick ist kein Button
    if (!action) return;

    const row = event.target.closest("tr");
    const station = JSON.parse(row.dataset.station);

    if (action === "view") {
        showStationOnMap(station);
    } else if (action === "delete") {
        deleteStation(station.name);
    } else if (action === "edit") {
        // editStation(station)
    }
});

/**
 * Löscht die angegeben Station aus MongoDB.
 * @param {*} name Name der Station
 * @returns 
 */
async function deleteStation(name) {
    if (!confirm("Möchtest du die Station wirklich löschen?")) return;

    // Anfrage an Server senden
    try {
        const response = await fetch("/delete-station", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name
            }),
        })

        if (!response.ok) {
            if (response.status === 404) {
                alert(`Station existiert nicht.`);
            } else {
                throw new Error("Fehler beim Löschen");
            }
            return;
        }

        loadStations();
    }
    catch (error) {
        console.error("Löschen fehlgeschlagen:", error);
        alert("Fehler beim Löschen");
    }
}

// Warte bis das HTML-Element existiert
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("station-map")) {
        initStationMap();
    }
})