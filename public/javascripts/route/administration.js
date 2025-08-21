"use strict"

loadStations();

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

            // Prüfen, ob GeoJSON & Koordinaten vorhanden sind
            let lat = "";
            let lng = "";
            if (
                station.geojson &&
                station.geojson.features &&
                station.geojson.features.length > 0 &&
                station.geojson.features[0].geometry &&
                station.geojson.features[0].geometry.type === "Point"
            ) {
                const coords = station.geojson.features[0].geometry.coordinates;
                lng = coords[0];
                lat = coords[1];
            }

            row.innerHTML = `
                <td>
                    <input class="form-check-input station-checkbox" 
                           type="checkbox" 
                           value="${station.name}" 
                           data-lat="${lat}" 
                           data-lng="${lng}">
                </td>
                <td>${station.name}</td>
                <td>${station.description}</td>       
            `;

            tableBody.appendChild(row);

            // Checkbox-Event
            const checkbox = row.querySelector(".station-checkbox");
            checkbox.addEventListener("change", loadStationsOnMap);
        });

        // Master-Checkbox steuert alle Zeilen
        const selectAll = document.getElementById("select-all");
        selectAll.addEventListener("change", () => {
            document.querySelectorAll(".station-checkbox").forEach(cb => {
                cb.checked = selectAll.checked;
            });
            
        });

    } catch (error) {
        console.error("Fehler beim Laden der Stationen:", error);
    }

}
