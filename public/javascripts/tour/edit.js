"use strict"

// Diese Datei steuert die Funktionalität des Abschnitts "Touren bearbeiten".
// Sie ist verantwortlich für das Laden, Anzeigen, Bearbeiten und Löschen von gespeicherten Touren.

const editTourMap = L.map('edit-tour-map').setView([51, 10], 6);
window.editTourMap = editTourMap; // Die Karte global verfügbar machen, um von anderen Skripten darauf zugreifen zu können.

/**
 * Initialisiert die Basiskarte mit einem OpenStreetMap-Tile-Layer.
 */
function initMapEditTour() {
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(editTourMap);
}

/**
 * Entfernt alle aktuell auf der Karte angezeigten Tour-Layer (Route und Segmente).
 */
function clearTourMap() {
  if (currentTourLayer) {
    currentTourLayer.remove();
    currentTourLayer = null;
  }
  if (currentSegmentPopupsLayer) {
    currentSegmentPopupsLayer.remove();
    currentSegmentPopupsLayer = null;
  }
}

/**
 * Lädt alle Touren aus der Datenbank und stellt sie in einer Tabelle dar.
 * Jede Zeile enthält Aktionen zum Anzeigen, Herunterladen, Bearbeiten und Löschen.
 */
async function loadTours() {
  clearTourMap();
  try {
    const response = await fetch('/get-tours');
    const tours = await response.json();
    const tableBody = document.getElementById("tour-table-body");
    tableBody.innerHTML = "";
    tours.forEach(tour => {
        const row = document.createElement("tr");
        row.dataset.tour = JSON.stringify(tour);
        row.innerHTML = `
            <td>${tour.name}</td>
            <td>${(tour.description && tour.description.trim()) ? tour.description : "-"}</td>
            <td>${formatTourDistance(tour)}</td>
            <td>${formatTourDuration(tour)}</td>
            <td><img src="images/view.png" alt="Anzeigen" style="height:25px;cursor:pointer;" onclick="showTourOnMap('${tour.name}')">
              <img src="images/download.png" alt="Download" style="height:25px;cursor:pointer;" onclick="downloadTour('${tour.name}')">
              <img src="images/edit.png" alt="Bearbeiten" style="height:25px;cursor:pointer;" onclick="editTour('${tour.name}')">
              <img src="images/delete.png" alt="Löschen" style="height:25px;cursor:pointer;" onclick="deleteTour('${tour.name}')"></td>
        `;
        tableBody.appendChild(row);
    });
  } catch (_) {
    // Fehler beim Laden wird ignoriert, um die Nutzererfahrung nicht zu stören.
  }
}
window.loadTours = loadTours;

// Globale Variablen für die aktuell angezeigten Layer.
let currentTourLayer;
let currentSegmentPopupsLayer = null;

// Cache für Stationsdaten, um wiederholte Abfragen zu vermeiden.
let stationsCache = null;
/**
 * Stellt sicher, dass die Stationsdaten geladen und zwischengespeichert sind.
 * @returns {Promise<Map<string, object>>} Eine Map mit Stationsnamen als Schlüssel und Stations-Objekten als Wert.
 */
async function ensureStationsLoaded() {
  if (stationsCache) return stationsCache;
  try {
    const res = await fetch('/get-stations');
    const list = await res.json();
    stationsCache = new Map(list.map(s => [s.name, s]));
  } catch (_) {
    stationsCache = new Map();
  }
  return stationsCache;
}

/**
 * Zeichnet die ausgewählte Tour auf der Karte, inklusive der Marker für die Stationen und der Route.
 * @param {object} tour Das Tour-Objekt, das angezeigt werden soll.
 */
async function renderTourOnMap(tour) {
  if (!window.editTourMap) return;

  clearTourMap(); // Zuerst die alte Tour von der Karte entfernen.

  const group = L.featureGroup().addTo(editTourMap);

  const stationsMap = await ensureStationsLoaded();

  (tour.waypoints || []).forEach(wp => {
    if (!Number.isFinite(wp.lat) || !Number.isFinite(wp.lng)) return;
    const st = stationsMap.get(wp.stationName);
    if (!st) return; // Station nicht gefunden, kein Marker anzeigen.
    const popupHtml = `<div style="font-size:13px;line-height:1.25">
        <div style="font-weight:700;font-size:14px;margin-bottom:2px;">${st.name}</div>
        ${st.description ? `<div>${st.description}</div>` : ``}
        ${st.url ? `<div><a href="${st.url}" target="_blank" rel="noopener">Mehr...</a></div>` : ``}
        </div>`;
    L.marker([wp.lat, wp.lng]).bindPopup(popupHtml).addTo(group);
  });

  let lineLatLngs = [];
  if (tour.routeGeojson?.geometry?.type === "LineString" &&
      Array.isArray(tour.routeGeojson.geometry.coordinates)) {
    lineLatLngs = tour.routeGeojson.geometry.coordinates
      .map(c => Array.isArray(c) && c.length >= 2 ? L.latLng(c[1], c[0]) : null)
      .filter(Boolean);
  }

  if (lineLatLngs.length > 1) {
    L.polyline(lineLatLngs, { color: "#1E88E5", weight: 5, opacity: 0.9 }).addTo(group);
    editTourMap.fitBounds(group.getBounds(), { padding: [30, 30] });
  }

  addStoredSegmentPopups(tour, lineLatLngs);

  currentTourLayer = group;
}

/**
 * Fügt den einzelnen Routensegmenten Tooltips mit Längenangaben hinzu.
 * @param {object} tour Das Tour-Objekt.
 * @param {Array<L.LatLng>} lineLatLngs Die Koordinaten der Route.
 */
function addStoredSegmentPopups(tour, lineLatLngs) {
  const segData = tour.routeGeojson?.properties?.segmentData;
  if (!Array.isArray(segData) || !segData.length || !lineLatLngs.length) return;

  currentSegmentPopupsLayer = L.layerGroup().addTo(editTourMap);

  segData.forEach((seg, idx) => {
    const { startIdx, endIdx, distance } = seg;
    if (!Number.isFinite(startIdx) || !Number.isFinite(endIdx)) return;
    if (!lineLatLngs[startIdx] || !lineLatLngs[endIdx]) return;
    const slice = lineLatLngs.slice(startIdx, endIdx + 1);
    if (slice.length < 2) return;
    const km = (distance / 1000).toFixed(2) + " km";
    const pl = L.polyline(slice, {
      color: '#1976D2',
      weight: 7,
      opacity: 0.25,
      interactive: false
    }).addTo(currentSegmentPopupsLayer);
    pl.bindTooltip(`Abschnitt ${idx + 1}: ${km}`, {
      permanent: true,
      direction: 'center',
      className: 'segment-tooltip'
    });
  });
}

/**
 * Wrapper-Funktion, die eine Tour anhand ihres Namens sucht und die Anzeige auf der Karte startet.
 * @param {string} name Der Name der anzuzeigenden Tour.
 */
function showTourOnMap(name) {
  const row = Array.from(document.querySelectorAll("#tour-table-body tr"))
    .find(r => {
        try { return JSON.parse(r.dataset.tour).name === name; } catch { return false; }
    });
  let tour = row ? JSON.parse(row.dataset.tour) : null;

  if (!tour) {
    // Fallback, falls die Tour nicht im Tabellen-Dataset gefunden wird.
    fetch("/get-tours")
      .then(r => r.json())
      .then(list => {
        const t = list.find(tt => tt.name === name);
        if (t) {
          if (row) row.dataset.tour = JSON.stringify(t);
          renderTourOnMap(t);
        }
      });
    return;
  }
  renderTourOnMap(tour);
}

/**
 * Löst den Download einer Tour als GeoJSON-Datei aus.
 * @param {string} name Der Name der herunterzuladenden Tour.
 */
function downloadTour(name) {
  fetch('/get-tours')
    .then(res => res.json())
    .then(tours => {
      const tour = tours.find(t => t.name === name);
      if (!tour) return;
      const blob = new Blob([JSON.stringify(tour.routeGeojson, null, 2)], { type: "application/geo+json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${tour.name}_tour.geojson`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
}

/**
 * Löscht eine Tour nach Bestätigung durch den Nutzer.
 * @param {string} name Der Name der zu löschenden Tour.
 */
async function deleteTour(name) {
  if (!confirm("Möchtest du die Tour wirklich löschen?")) return;
  try {
    await fetch("/delete-tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
  } catch (_) {}
  loadTours(); // Lädt die Tabelle neu, um die gelöschte Tour zu entfernen.
}

/**
 * Versetzt eine Tabellenzeile in den Bearbeitungsmodus, indem Text durch Input-Felder ersetzt wird.
 * @param {string} name Der Name der zu bearbeitende Tour.
 */
function editTour(name) {
  const tableBody = document.getElementById("tour-table-body");
  const rows = Array.from(tableBody.querySelectorAll("tr"));
  const row = rows.find(r => {
    try { return JSON.parse(r.dataset.tour).name === name; } catch { return false; }
  });
  if (!row) return;

  // Andere Zeilen im Bearbeitungsmodus zurücksetzen
  rows.forEach(r => {
    if (r !== row && r.querySelector('input')) {
      const data = JSON.parse(r.dataset.tour);
      cancelTourEditing(data.name);
    }
  });

  const tour = JSON.parse(row.dataset.tour);

  // Name und Beschreibung editierbar machen
  row.querySelector("td:nth-child(1)").innerHTML =
    `<input type="text" class="form-control" value="${tour.name}">`;
  row.querySelector("td:nth-child(2)").innerHTML =
    `<input type="text" class="form-control" value="${tour.description || ""}">`;
 
  // Bearbeiten- und Löschen-Buttons durch Speichern- und Abbrechen-Buttons ersetzen
  row.querySelector("td:nth-child(5)").innerHTML =
    `<img src="images/view.png" alt="Anzeigen" style="height:25px;cursor:pointer;" onclick="showTourOnMap('${tour.name}')">
     <img src="images/download.png" alt="Download" style="height:25px;cursor:pointer;" onclick="downloadTour('${tour.name}')">
     <img src="images/save.png" alt="Speichern" style="height:25px;cursor:pointer;" onclick="saveTourChanges('${tour.name}')">
     <img src="images/cancel.png" alt="Abbrechen" style="height:25px;cursor:pointer;" onclick="cancelTourEditing('${tour.name}')">`;
}

/**
 * Speichert die Änderungen an einer Tour, die im Bearbeitungsmodus vorgenommen wurden.
 * @param {string} name Der ursprüngliche Name der Tour, um sie in der DB zu finden.
 */
async function saveTourChanges(name) {
  const tableBody = document.getElementById("tour-table-body");
  const row = Array.from(tableBody.querySelectorAll("tr")).find(r => {
    try { return JSON.parse(r.dataset.tour).name === name; } catch { return false; }
  });
  if (!row) return;

  const original = JSON.parse(row.dataset.tour);
  const inputs = row.querySelectorAll("input");
  if (inputs.length < 2) return;

  const newName = inputs[0].value.trim();
  const newDescription = inputs[1].value.trim();
  if (!newName) {
    alert("Name darf nicht leer sein.");
    return;
  }

  try {
    const res = await fetch("/edit-tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldName: original.name,
        name: newName,
        description: newDescription,
        waypoints: original.waypoints,
        routeGeojson: original.routeGeojson
      })
    });
    const result = await res.json();
    if (!res.ok) {
      alert(result.error || "Fehler beim Speichern der Tour.");
      return;
    }

    // Tabellenzeile mit den neuen Daten aktualisieren
    row.querySelector("td:nth-child(1)").textContent = newName;
    row.querySelector("td:nth-child(2)").textContent = newDescription.trim() ? newDescription : "-";

    // Buttons wiederherstellen
    row.querySelector("td:nth-child(5)").innerHTML =
    `<img src="images/view.png" alt="Anzeigen" style="height:25px;cursor:pointer;" onclick="showTourOnMap('${newName}')">
     <img src="images/download.png" alt="Download" style="height:25px;cursor:pointer;" onclick="downloadTour('${newName}')">
     <img src="images/edit.png" alt="Bearbeiten" style="height:25px;cursor:pointer;" onclick="editTour('${newName}')">
     <img src="images/delete.png" alt="Löschen" style="height:25px;cursor:pointer;" onclick="deleteTour('${newName}')">`;

    // Datensatz im HTML aktualisieren
    row.dataset.tour = JSON.stringify({
      name: newName,
      description: newDescription,
      waypoints: original.waypoints,
      routeGeojson: original.routeGeojson
    });
  } catch (_) {
    alert("Fehler beim Speichern");
  }
}

/**
 * Bricht den Bearbeitungsmodus ab und stellt den ursprünglichen Zustand der Zeile wieder her.
 * @param {string} name Der Name der Tour, deren Bearbeitung abgebrochen wird.
 */
function cancelTourEditing(name) {
  const tableBody = document.getElementById("tour-table-body");
  const row = Array.from(tableBody.querySelectorAll("tr")).find(r => {
    try { return JSON.parse(r.dataset.tour).name === name; } catch { return false; }
  });
  if (!row) return;
  const tour = JSON.parse(row.dataset.tour);

  row.querySelector("td:nth-child(1)").textContent = tour.name;
  row.querySelector("td:nth-child(2)").textContent =
    (tour.description && tour.description.trim()) ? tour.description : "-";

  // Buttons wiederherstellen
  row.querySelector("td:nth-child(5)").innerHTML =
    `<img src="images/view.png" alt="Anzeigen" style="height:25px;cursor:pointer;" onclick="showTourOnMap('${tour.name}')">
     <img src="images/download.png" alt="Download" style="height:25px;cursor:pointer;" onclick="downloadTour('${tour.name}')">
     <img src="images/edit.png" alt="Bearbeiten" style="height:25px;cursor:pointer;" onclick="editTour('${tour.name}')">
     <img src="images/delete.png" alt="Löschen" style="height:25px;cursor:pointer;" onclick="deleteTour('${tour.name}')">`;
}

/**
 * Formatiert die Gesamtdistanz einer Tour für die Anzeige.
 * @param {object} tour Das Tour-Objekt.
 * @returns {string} Die formatierte Distanz (z.B. "12.34 km") oder "-".
 */
function formatTourDistance(tour) {
  const seg = tour.routeGeojson?.properties?.segmentData;
  if (Array.isArray(seg) && seg.length) {
    const total = seg.reduce((sum, s) => sum + (s.distance || 0), 0);
    return (total / 1000).toFixed(2) + " km";
  }
  return "-";
}

/**
 * Formatiert die Gesamtdauer einer Tour für die Anzeige.
 * @param {object} tour Das Tour-Objekt.
 * @returns {string} Die formatierte Dauer (z.B. "1h 23m") oder "-".
 */
function formatTourDuration(tour) {
  const seg = tour.routeGeojson?.properties?.segmentData;
  if (Array.isArray(seg) && seg.length && seg[0].duration !== undefined) {
    const total = seg.reduce((sum, s) => sum + (s.duration || 0), 0);
    const minutes = Math.round(total / 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
  }
  return "-";
}

// Globale Verfügbarkeit der Funktionen für onclick-Handler sicherstellen.
window.editTour = editTour;
window.saveTourChanges = saveTourChanges;
window.cancelTourEditing = cancelTourEditing;
window.showTourOnMap = showTourOnMap;
window.downloadTour = downloadTour;
window.deleteTour = deleteTour;

// Initialisierungslogik, die nach dem Laden des DOMs ausgeführt wird.
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("edit-tour-map")) {
    initMapEditTour();
  }
  if (document.getElementById("tour-table-body")) {
    loadTours();
  }
});