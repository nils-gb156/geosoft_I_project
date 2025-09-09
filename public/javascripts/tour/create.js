"use strict"

const routePlanningMap = L.map('create-tour-map').setView([51, 10], 6);
window.routePlanningMap = routePlanningMap;
let routeLayer;
let previousSelectedNames = new Set();
let segmentPopupLayer = null;
let routeControl = null; // (falls weiter unten nochmals deklariert -> dort entfernen)

// NEU: zentrale Aufräumfunktion
function clearRouteArtifacts() {
  if (routeControl) {
    routePlanningMap.removeControl(routeControl);
    routeControl = null;
  }
  if (segmentPopupLayer) {
    routePlanningMap.removeLayer(segmentPopupLayer);
    segmentPopupLayer = null;
  }
}
// global verfügbar
window.clearRouteArtifacts = clearRouteArtifacts;



/**
 * Initialisiert die Karte beim Laden der Webseite.
 */
function initMapCreateTour() {

  // OSM
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(routePlanningMap);
}

async function loadStationsOnMap() {
  if (routeLayer) routePlanningMap.removeLayer(routeLayer);
  try {
    const response = await fetch('/get-stations');
    const stations = await response.json();

    const selectedNames = Array.from(document.querySelectorAll(".station-checkbox:checked"))
      .map(cb => cb.value);

    const selectedStations = stations.filter(station => selectedNames.includes(station.name));

    // GeoJSON Layer erstellen
    routeLayer = L.layerGroup();

    // Reihenfolge wie angeklickt (selectionOrder), gefiltert auf aktuell ausgewählt
    const orderedNames = selectionOrder.filter(name => selectedNames.includes(name));
    const nameToIndex = new Map(orderedNames.map((n, i) => [n, i]));
    const byName = new Map(stations.map(s => [s.name, s]));

    const popupHtml = (name, description) => {
      const i = nameToIndex.get(name);
      const num = (i !== undefined) ? (i + 1) : '?';
      return `<div>
    <div style="font-weight:700;font-size:14px">#${num}</div>
    <div><b>${name}</b></div>
    ${description ? `<div>${description}</div>` : ``}
  </div>`;
    };

    // Marker/Layer in der Reihenfolge zeichnen
    orderedNames.forEach(name => {
      const station = byName.get(name);
      if (!station || !station.geojson) return;

      // Prüfe, ob FeatureCollection oder einzelnes Feature
      let feature;
      if (station.geojson.type === "FeatureCollection") {
        feature = station.geojson.features?.[0];
      } else if (station.geojson.type === "Feature") {
        feature = station.geojson;
      }

      if (!feature || !feature.geometry) {
        return;
      }

      const c = bboxCenterOfGeometry(feature.geometry);

      if (feature.geometry.type === "Point") {
        L.geoJSON(feature, {
          pointToLayer: (_feature, latlng) => L.marker(latlng)
        })
          .bindPopup(popupHtml(station.name, station.description))
          .addTo(routeLayer);
      } else {
        L.geoJSON(feature)
          .bindPopup(popupHtml(station.name, station.description))
          .addTo(routeLayer);

        if (c) {
          L.marker([c[1], c[0]])
            .bindPopup(popupHtml(station.name, station.description))
            .addTo(routeLayer);
        }
      }
    });

    routeLayer.addTo(routePlanningMap);


    // Route aktualisieren/entfernen, falls Marker entfernt werden 
    const roundtrip = document.getElementById('check-roundtour')?.checked;
    const waypoints = buildWaypointsFromChecked({ closeLoop: roundtrip });

    if (routeControl) {
      if (waypoints.length >= 2) {
        routeControl.setWaypoints(waypoints);
      } else {
        // < 2 -> Route + Segmente entfernen
        clearRouteArtifacts();
      }
    }

    previousSelectedNames = new Set(selectedNames);

  } catch (error) {
    console.error("Fehler beim Laden der Stationen für die Karte:", error);
  }
}

// --- Funktion zum Erstellen der Fahrradtour ---
function createBikeTourFromSelectedStations() {

  const roundtrip = document.getElementById('check-roundtour')?.checked;
  const waypoints = buildWaypointsFromChecked({ closeLoop: roundtrip });

  if (waypoints.length < 2) {
    alert("Mindestens zwei Stationen wählen.");
    return;
  }

  // Vorher alles bereinigen
  clearRouteArtifacts();

  // Routing-Control mit ORS-Router
  routeControl = L.Routing.control({
    waypoints,
    router: window.orsProxyRouter,
    showAlternatives: false,
    draggableWaypoints: false,
    addWaypoints: false,
    routeWhileDragging: false,
    fitSelectedRoutes: true,
    show: false,
    lineOptions: { styles: [{ weight: 5, opacity: 0.9, color: '#1E88E5' }] },
    createMarker: () => null
  }).addTo(routePlanningMap);

  // Falls das Control entfernt wird -> Segmente ebenfalls weg
  routeControl.on('remove', () => {
    if (segmentPopupLayer) {
      routePlanningMap.removeLayer(segmentPopupLayer);
      segmentPopupLayer = null;
    }
  });

  // Segment-Popups hinzufügen
  routeControl.on('routesfound', e => {
    const r = e.routes[0];
    addSegmentPopups(r);
  });
}

// Segmente als Popup
function addSegmentPopups(routeObj) {
  if (segmentPopupLayer) {
    routePlanningMap.removeLayer(segmentPopupLayer);
    segmentPopupLayer = null;
  }
  if (!routeObj || !Array.isArray(routeObj.segmentData) || !routeObj.segmentData.length) return;
  segmentPopupLayer = L.layerGroup().addTo(routePlanningMap);
  const coords = routeObj.coordinates;
  routeObj.segmentData.forEach((seg, idx) => {
    const { startIdx, endIdx, distance } = seg;
    if (!Number.isFinite(startIdx) || !Number.isFinite(endIdx)) return;
    const slice = coords.slice(startIdx, endIdx + 1).map(ll => L.latLng(ll.lat, ll.lng));
    if (slice.length < 2) return;
    const km = (distance / 1000).toFixed(2) + " km";
    const pl = L.polyline(slice, { color: '#1976D2', weight: 7, opacity: 0.25 }).addTo(segmentPopupLayer);
    const mid = slice[Math.round(slice.length / 2)] || slice[0];
    pl.bindTooltip(`Abschnitt ${idx + 1}: ${km}`, { permanent: true, direction: 'center', className: 'segment-tooltip' });
  });
}


/**
 * Speichert die berechnete Tour (Stationen und Routen zwischen den Stationen) in MongoDB.
 */
function saveTour() {
  const name = document.getElementById("tour-name").value.trim();
  const description = document.getElementById("tour-description").value.trim(); // NEU

  if (!name) {
    alert("Bitte einen Namen für die Tour eingeben.");
    return;
  }
  if (!routeControl) {
    alert("Bitte zuerst eine Route berechnen.");
    return;
  }
  // Hole die Waypoints und Route als GeoJSON
  const waypoints = routeControl.getWaypoints().map(wp => ({
    lat: wp.latLng.lat,
    lng: wp.latLng.lng
  }));
  const routeObj = routeControl._routes?.[0];
  const routeGeojson = routeObj
    ? {
        type: "Feature",
        properties: {
          segmentData: routeObj.segmentData || [] // NEU
        },
        geometry: {
          type: "LineString",
          coordinates: routeObj.coordinates.map(ll => [ll.lng, ll.lat])
        }
      }
    : null;

  fetch("/save-tour", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, waypoints, routeGeojson }) // Beschreibung mitsenden
  })
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        alert("Tour gespeichert!");
        document.getElementById("tour-name").value = "";
        document.getElementById("tour-description").value = "";
        loadTours();
      } else {
        alert(result.error || "Fehler beim Speichern der Tour.");
      }
    })
    .catch(() => alert("Fehler beim Speichern der Tour."));
}

// Warte bis das HTML-Element existiert
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("create-tour-map")) {
    initMapCreateTour();
  }

  const roundtripEl = document.getElementById("check-roundtour"); 
  if (roundtripEl) {
    roundtripEl.addEventListener("change", () => {
      if (!routeControl) return; 

      const wps = buildWaypointsFromChecked({ closeLoop: roundtripEl.checked });
      if (wps.length >= 2) {
        routeControl.setWaypoints(wps);
      } else {
        routePlanningMap.removeControl(routeControl);
        routeControl = null;
      }
    });
  }
})