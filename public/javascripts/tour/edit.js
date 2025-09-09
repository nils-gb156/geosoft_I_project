"use strict"

const editTourMap = L.map('edit-tour-map').setView([51, 10], 6);

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


// Lädt die Touren aus der Datenbank und fügt sie in die Tabelle ein
async function loadTours() {
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
  <td>
    <img src="images/view.png" alt="Anzeigen" style="height:25px;cursor:pointer;" onclick="showTourOnMap('${tour.name}')">
  </td>
  <td>
    <img src="images/download.png" alt="Download" style="height:25px;cursor:pointer;" onclick="downloadTour('${tour.name}')">
  </td>
  <td>
    <img src="images/edit.png" alt="Bearbeiten" style="height:25px;cursor:pointer;" onclick="editTour('${tour.name}')">
  </td>
  <td>
    <img src="images/delete.png" alt="Löschen" style="height:25px;cursor:pointer;" onclick="deleteTour('${tour.name}')">
  </td>
`;
      row.dataset.tour = JSON.stringify(tour);
      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error("Fehler beim Laden der Touren:", error);
  }
}
window.loadTours = loadTours;

// Zeigt die Route und Marker der ausgewählten Tour auf der Karte an
let currentTourLayer;

function showTourOnMap(name) {
  const row = Array.from(document.querySelectorAll("#tour-table-body tr"))
    .find(r => {
      try { return JSON.parse(r.dataset.tour).name === name; } catch { return false; }
    });

  let tour = row ? JSON.parse(row.dataset.tour) : null;

  if (!tour) {
    console.warn("Tour nicht im DOM gefunden – Fallback /get-tours");
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

  const group = L.layerGroup().addTo(editTourMap);

  // Marker
  (tour.waypoints || []).forEach((wp, i) => {
    if (Number.isFinite(wp.lat) && Number.isFinite(wp.lng)) {
      L.marker([wp.lat, wp.lng])
        .bindPopup(`${tour.name}<br>Punkt ${i + 1}`)
        .addTo(group);
    }
  });

  let lineLatLngs = [];

  // Primär: gespeichertes GeoJSON
  if (tour.routeGeojson?.geometry?.type === "LineString" &&
      Array.isArray(tour.routeGeojson.geometry.coordinates)) {

    lineLatLngs = tour.routeGeojson.geometry.coordinates
      .map(c => Array.isArray(c) && c.length >= 2 ? L.latLng(c[1], c[0]) : null)
      .filter(Boolean);
  }

  // Fallback: aus Waypoints rekonstruieren
  if (lineLatLngs.length < 2 && Array.isArray(tour.waypoints) && tour.waypoints.length > 1) {
    lineLatLngs = tour.waypoints
      .filter(wp => Number.isFinite(wp.lat) && Number.isFinite(wp.lng))
      .map(wp => L.latLng(wp.lat, wp.lng));
    console.info("Fallback: Linie aus Waypoints erzeugt (kein gültiges routeGeojson).");
  }

  if (lineLatLngs.length > 1) {
    L.polyline(lineLatLngs, {
      color: "#1E88E5",
      weight: 5,
      opacity: 0.9
    }).addTo(group);

    editTourMap.fitBounds(L.latLngBounds(lineLatLngs), { padding: [30, 30] });
  } else {
    console.warn("Keine Liniengeometrie darstellbar (Route fehlt oder <2 Punkte).");
  }

  currentTourLayer = group;
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
  await fetch("/delete-tour", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
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

    } catch (error) {
        console.error("Speichern fehlgeschlagen:", error);
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