"use strict"

// Diese Datei ist für interne Logik der Touren-Erstellung zuständig.
// Sie lädt die Liste der verfügbaren Stationen und verwaltet die Auswahlreihenfolge.

// Stellt sicher, dass die globale Variable für die Auswahlreihenfolge existiert.
window.selectionOrder = Array.isArray(window.selectionOrder) ? window.selectionOrder : [];

// Lädt die Stationen in die Tabelle, sobald das Skript ausgeführt wird.
loadStations();

/**
 * Lädt die verfügbaren Stationen vom Server und füllt die Auswahl-Tabelle.
 * Für jede Station wird eine Zeile mit einer Checkbox und den relevanten Daten erstellt.
 */
async function loadStations() {
  try {
    const response = await fetch('/get-stations');
    const stations = await response.json();
    const tableBody = document.getElementById("stations-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = ""; // Leert die Tabelle vor dem Befüllen.
    stations.forEach(station => {
      const row = document.createElement("tr");

      // Berechnet den Mittelpunkt der Station, um ihn als Wegpunkt-Koordinate zu verwenden.
      let lat = "";
      let lng = "";
      let feature = null;
      if (station.geojson?.type === 'FeatureCollection') {
        feature = station.geojson.features?.[0];
      } else if (station.geojson?.type === 'Feature') {
        feature = station.geojson;
      }
      const center = feature ? bboxCenterOfGeometry(feature.geometry) : null;
      if (center) {
        lng = center[0];
        lat = center[1];
      }

      const urlCell = station.url ? `<a href="${station.url}" target="_blank">${station.url}</a>` : "-";

      // Erstellt das HTML für die Tabellenzeile. Die Koordinaten werden in data-Attributen gespeichert.
      row.innerHTML = `
        <td>
          <input class="form-check-input station-checkbox" 
                 type="checkbox" 
                 value="${station.name}" 
                 data-lat="${lat}" 
                 data-lng="${lng}">
        </td>
        <td>${station.name}</td>
        <td>${station.description || "-"}</td>
        <td>${urlCell}</td>
      `;
      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error("Fehler beim Laden der Stationen-Tabelle:", error);
  }
}

/**
 * Globaler Event-Listener, der auf Änderungen an den Checkboxen der Stationen reagiert.
 * Er pflegt die `selectionOrder` (die Reihenfolge, in der Stationen angeklickt werden)
 * und löst die Aktualisierung der Karte aus.
 */
document.addEventListener('change', (e) => {
  const cb = e.target;
  // Stellt sicher, dass nur auf die relevanten Checkboxen reagiert wird.
  if (!cb || !cb.classList || !cb.classList.contains('station-checkbox')) {
    return;
  }

  const name = cb.value;
  const order = window.selectionOrder;

  // Entfernt die Station aus der Reihenfolge, falls sie bereits vorhanden ist.
  const index = order.indexOf(name);
  if (index !== -1) {
    order.splice(index, 1);
  }

  // Wenn die Checkbox aktiviert wurde, wird die Station am Ende der Reihenfolge hinzugefügt.
  if (cb.checked) {
    order.push(name);
  }

  // Löst die Funktion zum Neuzeichnen der Marker und Routen auf der Karte aus.
  if (typeof loadStationsOnMap === "function") {
    loadStationsOnMap();
  }
});