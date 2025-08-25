"use strict"

loadStations();

let selectionOrder = []; // Reihenfolge der angehakten Stationen


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
            checkbox.addEventListener("change", (e) => {
                const name = e.target.value;
                if (e.target.checked) {
                    if (!selectionOrder.includes(name)) selectionOrder.push(name);
                } else {
                    const i = selectionOrder.indexOf(name);
                    if (i !== -1) selectionOrder.splice(i, 1);
                }
                loadStationsOnMap();
            });

        });

        // Master-Checkbox steuert alle Zeilen
        const selectAll = document.getElementById("select-all");
        selectAll.addEventListener("change", () => {
            const boxes = document.querySelectorAll(".station-checkbox");

            if (selectAll.checked) {
                boxes.forEach(cb => {
                    if (!cb.checked) {
                        cb.checked = true;
                        if (!selectionOrder.includes(cb.value)) selectionOrder.push(cb.value);
                    }
                });
            } else {
                boxes.forEach(cb => { cb.checked = false; });
                selectionOrder.length = 0; // leeren
            }

        
            loadStationsOnMap();
        });


    } catch (error) {
        console.error("Fehler beim Laden der Stationen:", error);
    }

}
