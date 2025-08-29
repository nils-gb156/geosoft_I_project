"use strict"

/**
 * Liefert den ersten Satz des Wikipediaartikel zu der apssenden Wikipedia-URL.
 * @param {*} url 
 * @returns 
 */
async function getWikipediaFirstSentence(url) {
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
            return firstSentence
        } else {
            console.warn("Wikipedia-Antwort enthält keine Beschreibung.");
        }
    }
    catch (error) {
        console.warn("Wikipedia-Beschreibung konnte nicht geladen werden:", error);
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
        editStation(station)
    } else if (action === "save") {
        saveStation(station)
    } else if (action === "cancel") {
        cancelStation(station)
    } else if (action === "download") {
        downloadStation(station)
    }
});

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
                <td class="text-center"><img src="images/view.png" alt="Ansehen" data-action="view" style="height: 25px; cursor: pointer;"></td>
                <td class="text-center"><img src="images/download.png" alt="Herunterladen" data-action="download" style="height: 25px; cursor: pointer;"></td>
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