"use strict"

// Diese Datei verwaltet die Funktionalität zur Erstellung von Touren.
// Sie initialisiert die Karte, lädt Stationen, berechnet Routen und speichert neue Touren.

const routePlanningMap = L.map('create-tour-map').setView([51, 10], 6);
window.routePlanningMap = routePlanningMap; // Globale Verfügbarkeit der Karte

// Globale Variablen zur Verwaltung von Karten-Layern und -Steuerelementen.
let routeLayer; // Layer für Stations-Marker und -Geometrien
let segmentPopupLayer = null; // Layer für die Tooltips der Routensegmente
let routeControl = null; // Das Leaflet Routing Machine Control

// Initialisiert die globale Variable für die Auswahlreihenfolge der Stationen.
window.selectionOrder = Array.isArray(window.selectionOrder) ? window.selectionOrder : [];

/**
 * Zentrale Aufräumfunktion, die alle Routen-Artefakte von der Karte entfernt.
 * Wird aufgerufen, bevor eine neue Route berechnet oder die Ansicht zurückgesetzt wird.
 */
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
window.clearRouteArtifacts = clearRouteArtifacts; // Global verfügbar machen

/**
 * Initialisiert die Basiskarte mit einem OpenStreetMap-Tile-Layer.
 */
function initMapCreateTour() {
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(routePlanningMap);
}

/**
 * Lädt die ausgewählten Stationen auf die Karte, zeigt Marker und Geometrien an
 * und passt den Kartenausschnitt an.
 */
async function loadStationsOnMap() {
  // Alte Layer entfernen, um die Karte sauber zu halten.
  if (routeLayer) {
    routePlanningMap.removeLayer(routeLayer);
    routeLayer = null;
  }

  try {
    const response = await fetch('/get-stations');
    const stations = await response.json();
    const stationsByName = new Map(stations.map(s => [s.name, s]));

    // Holt die aktuell ausgewählten Stationen in der korrekten Klick-Reihenfolge.
    const selectedNames = Array.from(document.querySelectorAll(".station-checkbox:checked")).map(cb => cb.value);
    const orderedNames = (window.selectionOrder || []).filter(name => selectedNames.includes(name));
    const nameToIndex = new Map(orderedNames.map((n, i) => [n, i]));

    // L.featureGroup wird verwendet, da es die getBounds()-Methode bereitstellt, die für das Zoomen benötigt wird.
    routeLayer = L.featureGroup();

    // Zeichnet Marker und Geometrien für jede ausgewählte Station.
    orderedNames.forEach(name => {
      const station = stationsByName.get(name);
      if (!station) return;

      let feature = null;
      if (station.geojson?.type === 'FeatureCollection') {
        feature = station.geojson.features?.[0];
      } else if (station.geojson?.type === 'Feature') {
        feature = station.geojson;
      }
      if (!feature?.geometry) return;

      const indexInTour = nameToIndex.get(name);
      const popupHtml = `<div style="font-size:13px;line-height:1.25">
        <div style="font-weight:700;font-size:14px;margin-bottom:2px;">#${indexInTour + 1} ${station.name}</div>
        ${station.description ? `<div>${station.description}</div>` : ''}
        ${station.url ? `<div><a href="${station.url}" target="_blank" rel="noopener">Mehr...</a></div>` : ''}
      </div>`;

      const geoJsonLayer = L.geoJSON(feature).bindPopup(popupHtml);
      geoJsonLayer.addTo(routeLayer);

      // Wenn die Geometrie kein Punkt ist (z.B. ein Polygon), wird zusätzlich ein Marker im Zentrum gesetzt.
      if (feature.geometry.type !== "Point") {
        const center = bboxCenterOfGeometry(feature.geometry);
        if (center) {
          L.marker([center[1], center[0]]).bindPopup(popupHtml).addTo(routeLayer);
        }
      }
    });

    routeLayer.addTo(routePlanningMap);

    // Passt den Kartenausschnitt an die ausgewählten Stationen an.
    if (routeLayer.getLayers().length > 0) {
      const bounds = routeLayer.getBounds();
      if (orderedNames.length === 1) {
        routePlanningMap.setView(bounds.getCenter(), 13); // Fester Zoom bei nur einer Station.
      } else {
        routePlanningMap.fitBounds(bounds, { padding: [50, 50] }); // Zoom auf alle Stationen.
      }
    }

    // Aktualisiert die Route basierend auf den neuen Gegebenheiten.
    const roundtrip = document.getElementById('check-roundtour')?.checked;
    const waypoints = buildWaypointsFromChecked({ closeLoop: roundtrip });

    if (routeControl) {
      // Deaktiviert vorübergehend den automatischen Zoom des Routing-Controls, um Konflikte zu vermeiden.
      const originalFit = routeControl.options.fitSelectedRoutes;
      routeControl.options.fitSelectedRoutes = false;

      if (waypoints.length >= 2) {
        routeControl.setWaypoints(waypoints);
      } else {
        clearRouteArtifacts(); // Entfernt die Route, wenn weniger als 2 Wegpunkte vorhanden sind.
      }

      // Setzt die Zoom-Option nach einer kurzen Verzögerung zurück.
      setTimeout(() => {
        if (routeControl) {
          routeControl.options.fitSelectedRoutes = originalFit;
        }
      }, 100);
    }

  } catch (error) {
    console.error("Fehler in loadStationsOnMap:", error);
  }
}

/**
 * Erstellt eine Fahrradtour zwischen den ausgewählten Stationen mithilfe des ORS-Routers.
 */
function createBikeTourFromSelectedStations() {
  const roundtrip = document.getElementById('check-roundtour')?.checked;
  const waypoints = buildWaypointsFromChecked({ closeLoop: roundtrip });

  if (waypoints.length < 2) {
    alert("Mindestens zwei Stationen wählen.");
    return;
  }

  clearRouteArtifacts(); // Bereinigt die Karte vor der neuen Berechnung.

  // Initialisiert das Leaflet Routing Control mit dem benutzerdefinierten ORS-Router.
  routeControl = L.Routing.control({
    waypoints,
    router: window.orsProxyRouter,
    showAlternatives: false,
    draggableWaypoints: false,
    addWaypoints: false,
    routeWhileDragging: false,
    fitSelectedRoutes: true,
    show: false, // Die Standard-Anzeige (Wegpunktliste) wird ausgeblendet.
    lineOptions: { styles: [{ weight: 5, opacity: 0.9, color: '#1E88E5' }] },
    createMarker: () => null // Es werden keine Standard-Marker für Wegpunkte erstellt.
  }).addTo(routePlanningMap);

  // Event-Listener, um die Segment-Popups zu entfernen, wenn das Control entfernt wird.
  routeControl.on('remove', () => {
    if (segmentPopupLayer) {
      routePlanningMap.removeLayer(segmentPopupLayer);
      segmentPopupLayer = null;
    }
  });

  // Event-Listener, der nach erfolgreicher Routenberechnung die Segment-Popups hinzufügt.
  routeControl.on('routesfound', e => {
    const r = e.routes[0];
    addSegmentPopups(r);
  });
}

/**
 * Fügt den einzelnen Routensegmenten Tooltips mit Längen- und Dauerangaben hinzu.
 * @param {object} routeObj Das Routenobjekt von Leaflet Routing Machine.
 */
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
    
    // Erstellt eine unsichtbare, dickere Polylinie, um das Hover-Ziel für den Tooltip zu vergrößern.
    const pl = L.polyline(slice, { color: '#1976D2', weight: 7, opacity: 0.25, interactive: false }).addTo(segmentPopupLayer);
    
    // Bindet den Tooltip an die Polylinie.
    pl.bindTooltip(`Abschnitt ${idx + 1}: ${km}`, { permanent: true, direction: 'center', className: 'segment-tooltip' });
  });
}

/**
 * Speichert die berechnete Tour (Name, Beschreibung, Wegpunkte und Route) in der MongoDB-Datenbank.
 */
function saveTour() {
  const name = document.getElementById("tour-name").value.trim();
  const description = document.getElementById("tour-description").value.trim();

  if (!name) { alert("Bitte einen Namen für die Tour eingeben."); return; }
  if (!routeControl) { alert("Bitte zuerst eine Route berechnen."); return; }

  // Holt die Namen der ausgewählten Stationen in der korrekten Reihenfolge.
  const checkedBoxes = Array.from(document.querySelectorAll("#stations-table-body input[type='checkbox']:checked"));
  const selectedNamesOrdered = (window.selectionOrder || []).filter(n => checkedBoxes.some(cb => cb.value === n));

  const roundtrip = document.getElementById('check-roundtour')?.checked;
  const waypointsRaw = routeControl.getWaypoints();

  // Erweitert die Wegpunkte um den Namen der zugehörigen Station.
  const waypoints = waypointsRaw.map((wp, idx) => {
    let stationName = selectedNamesOrdered[idx] || null;
    // Bei einer Rundtour wird der Name der ersten Station für den letzten Wegpunkt verwendet.
    if (roundtrip && idx === waypointsRaw.length - 1 && selectedNamesOrdered.length > 0) {
      stationName = selectedNamesOrdered[0];
    }
    return {
      lat: wp.latLng.lat,
      lng: wp.latLng.lng,
      stationName
    };
  });

  // Erstellt das GeoJSON-Objekt für die Route.
  const routeObj = routeControl._routes?.[0];
  const routeGeojson = routeObj ? {
    type: "Feature",
    properties: {
      segmentData: routeObj.segmentData || []
    },
    geometry: {
      type: "LineString",
      coordinates: routeObj.coordinates.map(ll => [ll.lng, ll.lat])
    }
  } : null;

  // Sendet die Tour-Daten an den Server.
  fetch("/save-tour", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, waypoints, routeGeojson })
  })
    .then(async res => {
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(payload.error || "Fehler beim Speichern der Tour.");
        return;
      }
      alert("Tour gespeichert!");
      
      // Setzt die "Tour erstellen"-Ansicht zurück.
      if (typeof cancelTourCreation === "function") {
        cancelTourCreation();
      }
      // Lädt die Tabelle der bearbeitbaren Touren im Hintergrund neu.
      if (typeof loadTours === "function") {
        loadTours();
      }
    })
    .catch(() => alert("Fehler beim Speichern der Tour."));
}

// Initialisierungslogik, die nach dem Laden des DOMs ausgeführt wird.
document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("create-tour-map");
  if (el) {
    initMapCreateTour();
    if (typeof loadStationsOnMap === "function") {
      loadStationsOnMap();
    }
    // Stellt sicher, dass die Kartengröße nach dem Rendern der Seite korrekt ist.
    setTimeout(() => {
      routePlanningMap.invalidateSize();
    }, 150);
  }
});