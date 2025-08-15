"use strict"

loadStations();

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
                <td><a href="${station.url}" target="_blank">${station.url || ''}</a></td>
                <td><img src="images/view.png" alt="Ansehen" style="height: 25px; cursor: pointer;" onclick="")"></rd>   
                <td><img src="images/edit.png" alt="Bearbeiten" style="height: 25px; cursor: pointer;" onclick=""></rd>
                <td><img src="images/delete.png" alt="Löschen" style="height: 25px; cursor: pointer;" onclick=""></rd>        
            `
            tableBody.appendChild(row);
            
        });
    }
    catch (error) {
        console.error("Fehler beim Laden der Stationen:", error);
    }
}