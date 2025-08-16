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

            row.innerHTML = `
                <td>
                  <input class="form-check-input station-checkbox" type="checkbox" value="${station.name}">
                </td>
                <td>${station.name}</td>
                <td>${station.description}</td>
                <td>
                    <img src="images/view.png" alt="Ansehen" style="height: 25px; cursor: pointer;">
                    <img src="images/edit.png" alt="Bearbeiten" style="height: 25px; cursor: pointer;">
                    <img src="images/delete.png" alt="Löschen" style="height: 25px; cursor: pointer;" onclick="deleteStation(decodeURIComponent('${encodeURIComponent(station.name)}'))">
                </td>        
            `
            tableBody.appendChild(row);
            
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
    }
    catch (error) {
        console.error("Fehler beim Laden der Stationen:", error);
    }
}