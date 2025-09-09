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
  <td>${tour.description || ""}</td>
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

// Hilfsfunktion: segmentData nachträglich berechnen falls fehlt
function buildSegmentDataFromWaypoints(tour, lineLatLngs) {
  if (!Array.isArray(tour.waypoints) || tour.waypoints.length < 2) return [];
  if (!Array.isArray(lineLatLngs) || lineLatLngs.length < 2) return [];
  const wpIndices = tour.waypoints.map(wp => {
    let bestIdx = -1;
    let bestDist = Infinity;
    lineLatLngs.forEach((p, i) => {
      const d = Math.hypot(p.lat - wp.lat, p.lng - wp.lng);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    return bestIdx;
  });
  const cleaned = [];
  wpIndices.forEach(idx => {
    if (idx >= 0 && (cleaned.length === 0 || idx > cleaned[cleaned.length - 1])) cleaned.push(idx);
  });
  if (cleaned.length < 2) return [];
  const cum = [0];
  for (let i = 1; i < lineLatLngs.length; i++) {
    const d = editTourMap.distance(lineLatLngs[i - 1], lineLatLngs[i]);
    cum.push(cum[cum.length - 1] + d);
  }
  const segments = [];
  for (let i = 0; i < cleaned.length - 1; i++) {
    const s = cleaned[i], e = cleaned[i + 1];
    if (s < 0 || e <= s) continue;
    segments.push({ startIdx: s, endIdx: e, distance: cum[e] - cum[s] });
  }
  return segments;
}

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

function renderTourOnMap(tour) {
  if (!window.editTourMap) return;

  // Alte Layer entfernen
  if (currentTourLayer) {
    currentTourLayer.remove();
    currentTourLayer = null;
  }
  if (currentSegmentPopupsLayer) {
    currentSegmentPopupsLayer.remove();
    currentSegmentPopupsLayer = null;
  }

  const group = L.layerGroup().addTo(editTourMap);

  // Marker
  (tour.waypoints || []).forEach((wp, i) => {
    if (Number.isFinite(wp.lat) && Number.isFinite(wp.lng)) {
      L.marker([wp.lat, wp.lng])
        .bindPopup(`${tour.name}<br>Punkt ${i + 1}`)
        .addTo(group);
    }
  });

  // Linienpunkte
  let lineLatLngs = [];
  if (tour.routeGeojson?.geometry?.type === "LineString" &&
      Array.isArray(tour.routeGeojson.geometry.coordinates)) {
    lineLatLngs = tour.routeGeojson.geometry.coordinates
      .map(c => Array.isArray(c) && c.length >= 2 ? L.latLng(c[1], c[0]) : null)
      .filter(Boolean);
  }

  // Fallback: direkte Verbindung Waypoints
  if (lineLatLngs.length < 2 && Array.isArray(tour.waypoints) && tour.waypoints.length > 1) {
    lineLatLngs = tour.waypoints
      .filter(wp => Number.isFinite(wp.lat) && Number.isFinite(wp.lng))
      .map(wp => L.latLng(wp.lat, wp.lng));
  }

  if (lineLatLngs.length > 1) {
    L.polyline(lineLatLngs, {
      color: "#1E88E5",
      weight: 5,
      opacity: 0.9
    }).addTo(group);
    editTourMap.fitBounds(L.latLngBounds(lineLatLngs), { padding: [30, 30] });
  }

  // Segmente zeichnen (nur noch Tooltips – alter Marker-Label Code entfernt)
  addStoredSegmentPopups(tour, lineLatLngs);

  currentTourLayer = group;
}

function addStoredSegmentPopups(tour, lineLatLngs) {
  currentSegmentPopupsLayer = L.layerGroup().addTo(editTourMap);
  let segData = tour.routeGeojson?.properties?.segmentData;

  // Falls segData fehlt: rekonstruieren
  if (!Array.isArray(segData) || !segData.length) {
    segData = buildSegmentDataFromWaypoints(tour, lineLatLngs);
  }

  if (Array.isArray(segData) && segData.length && Array.isArray(lineLatLngs) && lineLatLngs.length) {
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
    return;
  }

  // Fallback: Waypoints Luftlinie
  if (Array.isArray(tour.waypoints) && tour.waypoints.length > 1) {
    for (let i = 0; i < tour.waypoints.length - 1; i++) {
      const a = tour.waypoints[i], b = tour.waypoints[i + 1];
      if (![a,b].every(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))) continue;
      const slice = [L.latLng(a.lat, a.lng), L.latLng(b.lat, b.lng)];
      const dist = editTourMap.distance([a.lat, a.lng], [b.lat, b.lng]);
      const km = (dist / 1000).toFixed(2) + " km";
      const pl = L.polyline(slice, {
        color: '#455A64',
        weight: 6,
        opacity: 0.35,
        dashArray: '6,6'
      }).addTo(currentSegmentPopupsLayer);
      pl.bindTooltip(`Abschnitt ${i + 1}: ${km}`, {
        permanent: true,
        direction: 'center',
        className: 'segment-tooltip fallback'
      });
    }
  }
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

// Bearbeiten der ausgewählten Tour (nur Namen und Beschreibung)
function editTour(name) {
    const tableBody = document.getElementById("tour-table-body");
    const rows = tableBody.querySelectorAll("tr");

    // Finde die Zeile der aktuellen Tour
    const row = Array.from(rows).find(r => JSON.parse(r.dataset.tour).name === name);
    if (!row) return;

    const tour = JSON.parse(row.dataset.tour);

    // Buttons nur für diese Zeile umwandeln
    row.querySelector("td:nth-child(3)").innerHTML = '<img src="images/view.png" alt="Ansehen" data-action="view" style="height: 25px; cursor: pointer;">';
    row.querySelector("td:nth-child(4)").innerHTML = '<img src="images/download.png" alt="Herunterladen" data-action="download" style="height: 25px; cursor: pointer;">';
    row.querySelector("td:nth-child(5)").innerHTML = `<img src="images/save.png" alt="Speichern" style="height:25px;cursor:pointer;" onclick="saveTourChanges('${name}')">`;
    row.querySelector("td:nth-child(6)").innerHTML = `<img src="images/cancel.png" alt="Abbrechen" style="height:25px;cursor:pointer;" onclick="cancelTour('${name}')">`;

    // Zellen in Input-Felder umwandeln
    row.querySelector("td:nth-child(1)").innerHTML = `<input type="text" class="form-control" value="${tour.name}">`;
    row.querySelector("td:nth-child(2)").innerHTML = `<input type="text" class="form-control" value="${tour.description || ""}">`;
}

// Speichern der Änderungen
async function saveTourChanges(name) {
    const tableBody = document.getElementById("tour-table-body");
    const rows = tableBody.querySelectorAll("tr");
    const row = Array.from(rows).find(r => JSON.parse(r.dataset.tour).name === name);
    if (!row) return;

    const tour = JSON.parse(row.dataset.tour);

    // Inputs auslesen
    const inputs = row.querySelectorAll("input");
    const newName = inputs[0].value.trim();
    const newDescription = inputs[1].value.trim();

    if (!newName || !newDescription) {
        alert("Name und Beschreibung dürfen nicht leer sein.");
        return;
    }

    try {
        const response = await fetch("/edit-tour", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                oldName: tour.name,
                name: newName,
                description: newDescription,
                waypoints: tour.waypoints,
                routeGeojson: tour.routeGeojson
            }),
        });
        const result = await response.json();
        if (!response.ok) {
          alert(result.error || "Fehler beim Speichern der Tour.");
          return;
        }

        // Tabelle wieder normal darstellen
        row.querySelector("td:nth-child(1)").textContent = newName;
        row.querySelector("td:nth-child(2)").textContent = newDescription;

        // Buttons wiederherstellen
        row.querySelector("td:nth-child(3)").innerHTML = '<img src="images/view.png" alt="Anzeigen" style="height:25px;cursor:pointer;" onclick="showTourOnMap(\'' + newName + '\')">';
        row.querySelector("td:nth-child(4)").innerHTML = '<img src="images/download.png" alt="Download" style="height:25px;cursor:pointer;" onclick="downloadTour(\'' + newName + '\')">';
        row.querySelector("td:nth-child(5)").innerHTML = `<img src="images/edit.png" alt="Bearbeiten" style="height:25px;cursor:pointer;" onclick="editTour('${newName}')">`;
        row.querySelector("td:nth-child(6)").innerHTML = '<img src="images/delete.png" alt="Löschen" style="height:25px;cursor:pointer;" onclick="deleteTour(\'' + newName + '\')">';

        // Aktualisiere das tour-Objekt im dataset
        row.dataset.tour = JSON.stringify({
            name: newName,
            description: newDescription,
            waypoints: tour.waypoints,
            routeGeojson: tour.routeGeojson
        });

    } catch (_) {
        alert("Fehler beim Speichern");
    }
}

// Abbrechen der Bearbeitung
function cancelTour(name) {
    const tableBody = document.getElementById("tour-table-body");
    const rows = tableBody.querySelectorAll("tr");
    const row = Array.from(rows).find(r => JSON.parse(r.dataset.tour).name === name);
    if (!row) return;

    const tour = JSON.parse(row.dataset.tour);

    // Tabelle wieder normal darstellen
    row.querySelector("td:nth-child(1)").textContent = tour.name;
    row.querySelector("td:nth-child(2)").textContent = tour.description || "";

    // Buttons wiederherstellen
    row.querySelector("td:nth-child(3)").innerHTML = '<img src="images/view.png" alt="Anzeigen" style="height:25px;cursor:pointer;" onclick="showTourOnMap(\'' + tour.name + '\')">';
    row.querySelector("td:nth-child(4)").innerHTML = '<img src="images/download.png" alt="Download" style="height:25px;cursor:pointer;" onclick="downloadTour(\'' + tour.name + '\')">';
    row.querySelector("td:nth-child(5)").innerHTML = `<img src="images/edit.png" alt="Bearbeiten" style="height:25px;cursor:pointer;" onclick="editTour('${tour.name}')">`;
    row.querySelector("td:nth-child(6)").innerHTML = '<img src="images/delete.png" alt="Löschen" style="height:25px;cursor:pointer;" onclick="deleteTour(\'' + tour.name + '\')">';

    // Dataset wiederherstellen
    row.dataset.tour = JSON.stringify(tour);
}

window.showTourOnMap = showTourOnMap;
window.downloadTour = downloadTour;
window.deleteTour = deleteTour;
window.editTour = editTour;
window.saveTourChanges = saveTourChanges;
window.cancelTour = cancelTour;

// Warte bis das HTML-Element existiert
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("edit-tour-map")) {
    initMapEditTour();
  }
  if (document.getElementById("tour-table-body")) {
    loadTours();
  }
})