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
                <td>${station.name}</td>
                <td>${station.description}</td>
                <td><a href="${station.url}" target="_blank">${station.url}</a></td>
                <td><img src="images/view.png" alt="Ansehen" style="height: 25px; cursor: pointer;" onclick="")"></rd>   
                <td><img src="images/edit.png" alt="Bearbeiten" style="height: 25px; cursor: pointer;" onclick=""></rd>
                <td><img src="images/delete.png" alt="Löschen" style="height: 25px; cursor: pointer;" onclick="deleteStation(decodeURIComponent('${encodeURIComponent(station.name)}'))"></rd>        
            `
            tableBody.appendChild(row);
            
        });
    }
    catch (error) {
        console.error("Fehler beim Laden der Stationen:", error);
    }
}

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