"use strict"

/**
 * Setzt die Station in den Bearbeitungsmodus.
 * @param {*} station 
 */
async function editStation(station) {
    const tableBody = document.getElementById("stations-table-body");
    const rows = tableBody.querySelectorAll("tr");

    // Finde die Zeile der aktuellen Station
    const row = Array.from(rows).find(r => JSON.parse(r.dataset.station).name === station.name);

    // Buttons nur für diese Zeile umwandeln
    row.querySelector("td:nth-child(4)").innerHTML = '<img src="images/view.png" alt="Ansehen" data-action="view" style="height: 25px; cursor: pointer;">';
    row.querySelector("td:nth-child(5)").innerHTML = '<img src="images/download.png" alt="Herunterladen" data-action="download" style="height: 25px; cursor: pointer;">';
    row.querySelector("td:nth-child(6)").innerHTML = '<img src="images/save.png" alt="Speichern" data-action="save" style="height: 25px; cursor: pointer;">';
    row.querySelector("td:nth-child(7)").innerHTML = '<img src="images/cancel.png" alt="Abbrechen" data-action="cancel" style="height: 25px; cursor: pointer;">';


    // Zellen in Input-Felder umwandeln
    row.querySelector("td:nth-child(1)").innerHTML = `<input type="text" class="form-control" value="${station.name}">`;
    row.querySelector("td:nth-child(2)").innerHTML = `<input type="text" class="form-control" value="${station.description}">`;
    row.querySelector("td:nth-child(3)").innerHTML = `<input type="text" class="form-control" value="${station.url}">`;

}

/**
 * Speichert die Änderung an der Station in MongoDB.
 * @param {*} station 
 */
async function saveStation(station) {

    const tableBody = document.getElementById("stations-table-body");
    const rows = tableBody.querySelectorAll("tr");

    // Finde die Zeile der aktuellen Station
    const row = Array.from(rows).find(r => JSON.parse(r.dataset.station).name === station.name);
    if (!row) return;

    // Inputs auslesen
    const inputs = row.querySelectorAll("input");
    const newName = inputs[0].value.trim();
    let newDescription = inputs[1].value.trim();
    const newUrl = inputs[2].value.trim();

    // Wenn neue URL ein Wikipedia Link ist, ersetzte die beschreibung
    if (newUrl && newUrl.includes("wikipedia.org/wiki")) {
        const wikiDescription = await getWikipediaFirstSentence(newUrl);
        if (wikiDescription) {
            newDescription = wikiDescription;
        }
    }

    if (!newName || !newDescription) {
        alert("Name und Beschreibung dürfen nicht leer sein.");
        return;
    }

    try {
        const response = await fetch("/edit-station", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                oldName: station.name,
                name: newName,
                description: newDescription,
                url: newUrl
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.error || "Fehler beim Speichern der Station.");
            return;
        }

        // Tabelle wieder normal darstellen
        row.querySelector("td:nth-child(1)").textContent = newName;
        row.querySelector("td:nth-child(2)").textContent = newDescription;
        row.querySelector("td:nth-child(3)").innerHTML = `<a href="${newUrl}" target="_blank">${newUrl}</a>`;

        // Buttons wiederherstellen
        row.querySelector("td:nth-child(4)").innerHTML = '<img src="images/view.png" alt="Ansehen" data-action="view" style="height: 25px; cursor: pointer;">';
        row.querySelector("td:nth-child(5)").innerHTML = '<img src="images/download.png" alt="Herunterladen" data-action="download" style="height: 25px; cursor: pointer;">';
        row.querySelector("td:nth-child(6)").innerHTML = '<img src="images/edit.png" alt="Bearbeiten" data-action="edit" style="height: 25px; cursor: pointer;">';
        row.querySelector("td:nth-child(7)").innerHTML = '<img src="images/delete.png" alt="Löschen" data-action="delete" style="height: 25px; cursor: pointer;">';

        // Aktualisiere das station-Objekt im dataset
        row.dataset.station = JSON.stringify({
            name: newName,
            description: newDescription,
            url: newUrl,
            geojson: station.geojson
        });

    } catch (error) {
        console.error("Speichern fehlgeschlagen:", error);
        alert("Fehler beim Speichern");
    }
}

/**
 * Bricht die Bearbeitung der Station ab.
 * @param {*} station 
 */
function cancelStation(station) {
    const tableBody = document.getElementById("stations-table-body");
    const rows = tableBody.querySelectorAll("tr");

    // Finde die Zeile der aktuellen Station
    const row = Array.from(rows).find(r => JSON.parse(r.dataset.station).name === station.name);
    if (!row) return;

    // Tabelle wieder normal darstellen
    row.querySelector("td:nth-child(1)").textContent = station.name;
    row.querySelector("td:nth-child(2)").textContent = station.description;
    row.querySelector("td:nth-child(3)").innerHTML = `<a href="${station.url}" target="_blank">${station.url}</a>`;

    // Buttons wiederherstellen
    row.querySelector("td:nth-child(4)").innerHTML = '<img src="images/view.png" alt="Ansehen" data-action="view" style="height: 25px; cursor: pointer;">';
    row.querySelector("td:nth-child(5)").innerHTML = '<img src="images/download.png" alt="Herunterladen" data-action="download" style="height: 25px; cursor: pointer;">';
    row.querySelector("td:nth-child(6)").innerHTML = '<img src="images/edit.png" alt="Bearbeiten" data-action="edit" style="height: 25px; cursor: pointer;">';
    row.querySelector("td:nth-child(7)").innerHTML = '<img src="images/delete.png" alt="Löschen" data-action="delete" style="height: 25px; cursor: pointer;">';

    // Dataset wiederherstellen
    row.dataset.station = JSON.stringify(station);
}