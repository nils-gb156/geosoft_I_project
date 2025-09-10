"use strict"

const editTourMap = L.map('edit-tour-map').setView([51, 10], 6);
window.editTourMap = editTourMap; // <-- WICHTIG: global verfügbar machen

/**
 * Initialisiert die Karte beim Laden der Webseite.
 */
function initMapEditTour() {
  // OSM
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(editTourMap);
}

// Liefert eine leere Karte (bei neuen Touren oder gelöschten Touren sinnvoll)
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

// Lädt die Touren aus der Datenbank und fügt sie in die Tabelle ein
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
  <td><img src="images/view.png" alt="Anzeigen" style="height:25px;cursor:pointer;" onclick="showTourOnMap('${tour.name}')"></td>
  <td><img src="images/download.png" alt="Download" style="height:25px;cursor:pointer;" onclick="downloadTour('${tour.name}')"></td>
  <td><img src="images/edit.png" alt="Bearbeiten" style="height:25px;cursor:pointer;" onclick="editTour('${tour.name}')"></td>
  <td><img src="images/delete.png" alt="Löschen" style="height:25px;cursor:pointer;" onclick="deleteTour('${tour.name}')"></td>
`;
      tableBody.appendChild(row);
    });
  } catch (_) {
    // optional: still keep silent or send to error monitor
  }
}
window.loadTours = loadTours;

// Zeigt die Route und Marker der ausgewählten Tour auf der Karte an
let currentTourLayer;
let currentSegmentPopupsLayer = null;

let stationsCache = null;
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

// Zeigt Tour auf der Karte
async function renderTourOnMap(tour) {
  if (!window.editTourMap) return;

  if (currentTourLayer) { currentTourLayer.remove(); currentTourLayer = null; }
  if (currentSegmentPopupsLayer) { currentSegmentPopupsLayer.remove(); currentSegmentPopupsLayer = null; }

  const group = L.layerGroup().addTo(editTourMap);

  const stationsMap = await ensureStationsLoaded();

  (tour.waypoints || []).forEach(wp => {
    if (!Number.isFinite(wp.lat) || !Number.isFinite(wp.lng)) return;
    const st = stationsMap.get(wp.stationName);
    if (!st) return; // kein Fallback nötig
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
    editTourMap.fitBounds(L.latLngBounds(lineLatLngs), { padding: [30, 30] });
  }

  addStoredSegmentPopups(tour, lineLatLngs);

  currentTourLayer = group;
}

// Nur segmentData nutzen (keine Rekonstruktion, kein Fallback)
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
      opacity: 0.25
    }).addTo(currentSegmentPopupsLayer);
    const midIdx = Math.round(slice.length / 2);
    const mid = slice[midIdx] || slice[0];
    pl.bindTooltip(`Abschnitt ${idx + 1}: ${km}`, {
      permanent: true,
      direction: 'center',
      className: 'segment-tooltip'
    });
  });
}

// Zeigt die Route einer Tour an und lädt bei Bedarf die Tour-Daten
function showTourOnMap(name) {
  const row = Array.from(document.querySelectorAll("#tour-table-body tr"))
    .find(r => {
      try { return JSON.parse(r.dataset.tour).name === name; } catch { return false; }
    });
  let tour = row ? JSON.parse(row.dataset.tour) : null;

  if (!tour) {
    fetch("/get-tours")
      .then(r => r.json())
      .then(list => {
        const t = list.find(tt => tt.name === name);
        if (t) {
          if (row) row.dataset.tour = JSON.stringify(t);
          renderTourOnMap(t);
        } else {
          alert("Tour nicht gefunden.");
        }
      });
    return;
  }
  renderTourOnMap(tour);
}

// Lädt die Tour als GeoJSON-Datei herunter
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

// Löscht die ausgewählte Tour
async function deleteTour(name) {
  if (!confirm("Möchtest du die Tour wirklich löschen?")) return;
  try {
    await fetch("/delete-tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
  } catch (_) {}
  loadTours();
}

// Bearbeiten der ausgewählten Tour (nur Name & Beschreibung; Distanz/Dauer bleiben schreibgeschützt)
function editTour(name) {
  const tableBody = document.getElementById("tour-table-body");
  const rows = tableBody.querySelectorAll("tr");

  const row = Array.from(rows).find(r => {
    try { return JSON.parse(r.dataset.tour).name === name; } catch { return false; }
  });
  if (!row) return;

  const tour = JSON.parse(row.dataset.tour);

  // Spalten:
  // 1 Name | 2 Beschreibung | 3 Distanz | 4 Dauer | 5 View | 6 Download | 7 Edit/Save | 8 Delete/Cancel
  // Nur Name & Beschreibung werden editierbar, Distanz/Dauer bleiben unverändert.
  row.querySelector("td:nth-child(1)").innerHTML =
    `<input type="text" class="form-control" value="${tour.name}">`;
  row.querySelector("td:nth-child(2)").innerHTML =
    `<input type="text" class="form-control" value="${tour.description || ""}">`;

  // View (5) & Download (6) unverändert lassen.
  // Edit (7) -> Save; Delete (8) -> Cancel
  row.querySelector("td:nth-child(7)").innerHTML =
    `<img src="images/save.png" alt="Speichern" style="height:25px;cursor:pointer;" onclick="saveTourChanges('${name}')">`;
  row.querySelector("td:nth-child(8)").innerHTML =
    `<img src="images/cancel.png" alt="Abbrechen" style="height:25px;cursor:pointer;" onclick="cancelTourEditing('${name}')">`;
}

// Speichern der Änderungen (nur Name & Beschreibung)
async function saveTourChanges(name) {
  const tableBody = document.getElementById("tour-table-body");
  const rows = tableBody.querySelectorAll("tr");
  const row = Array.from(rows).find(r => {
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
    const response = await fetch("/edit-tour", {
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
    const result = await response.json();
    if (!response.ok) {
      alert(result.error || "Fehler beim Speichern der Tour.");
      return;
    }

    // Zellen zurücksetzen
    row.querySelector("td:nth-child(1)").textContent = newName;
    row.querySelector("td:nth-child(2)").textContent = newDescription ? newDescription : "-";

    // Aktionen (Spalten 5–8) wiederherstellen
    row.querySelector("td:nth-child(5)").innerHTML =
      `<img src="images/view.png" alt="Anzeigen" style="height:25px;cursor:pointer;" onclick="showTourOnMap('${newName}')">`;
    row.querySelector("td:nth-child(6)").innerHTML =
      `<img src="images/download.png" alt="Download" style="height:25px;cursor:pointer;" onclick="downloadTour('${newName}')">`;
    row.querySelector("td:nth-child(7)").innerHTML =
      `<img src="images/edit.png" alt="Bearbeiten" style="height:25px;cursor:pointer;" onclick="editTour('${newName}')">`;
    row.querySelector("td:nth-child(8)").innerHTML =
      `<img src="images/delete.png" alt="Löschen" style="height:25px;cursor:pointer;" onclick="deleteTour('${newName}')">`;

    // Datensatz aktualisieren (Distanz/Dauer unverändert)
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

// Abbrechen ohne Speichern
function cancelTourEditing(name) {
  const tableBody = document.getElementById("tour-table-body");
  const rows = tableBody.querySelectorAll("tr");
  const row = Array.from(rows).find(r => {
    try { return JSON.parse(r.dataset.tour).name === name; } catch { return false; }
  });
  if (!row) return;

  const tour = JSON.parse(row.dataset.tour);

  row.querySelector("td:nth-child(1)").textContent = tour.name;
  row.querySelector("td:nth-child(2)").textContent =
    (tour.description && tour.description.trim()) ? tour.description : "-";

  // Aktionen (Spalten 5–8) wiederherstellen
  row.querySelector("td:nth-child(5)").innerHTML =
    `<img src="images/view.png" alt="Anzeigen" style="height:25px;cursor:pointer;" onclick="showTourOnMap('${tour.name}')">`;
  row.querySelector("td:nth-child(6)").innerHTML =
    `<img src="images/download.png" alt="Download" style="height:25px;cursor:pointer;" onclick="downloadTour('${tour.name}')">`;
  row.querySelector("td:nth-child(7)").innerHTML =
    `<img src="images/edit.png" alt="Bearbeiten" style="height:25px;cursor:pointer;" onclick="editTour('${tour.name}')">`;
  row.querySelector("td:nth-child(8)").innerHTML =
    `<img src="images/delete.png" alt="Löschen" style="height:25px;cursor:pointer;" onclick="deleteTour('${tour.name}')">`;

  // Dataset wiederherstellen
  row.dataset.tour = JSON.stringify(tour);
}

function formatTourDistance(tour) {
  const seg = tour.routeGeojson?.properties?.segmentData;
  if (Array.isArray(seg) && seg.length) {
    const total = seg.reduce((sum, s) => sum + (s.distance || 0), 0);
    return (total / 1000).toFixed(2) + " km";
  }
  return "-";
}
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

window.showTourOnMap = showTourOnMap;
window.downloadTour = downloadTour;
window.deleteTour = deleteTour;
window.editTour = editTour;
window.saveTourChanges = saveTourChanges;
window.cancelTourEditing = cancelTourEditing;
// Warte bis das HTML-Element existiert
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("edit-tour-map")) {
    initMapEditTour();
  }
  if (document.getElementById("tour-table-body")) {
    loadTours();
  }
})