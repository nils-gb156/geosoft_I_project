"use strict"

const routePlanningMap = L.map('create-tour-map').setView([51, 10], 6);
window.routePlanningMap = routePlanningMap;
let routeLayer;
let previousSelectedNames = new Set();



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
  // Vorherige Marker entfernen
  if (routeLayer) {
    routePlanningMap.removeLayer(routeLayer);
  }

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
        console.warn('Station ohne Geometrie:', station.name);
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
    const waypoints = buildWaypointsFromChecked();

    if (routeControl) {
      if (waypoints.length >= 2) {
        // nur Waypoints updaten -> Segment des entfernten Markers verschwindet
        routeControl.setWaypoints(waypoints);
      } else {
        // < 2 Marker -> Route komplett entfernen
        routePlanningMap.removeControl(routeControl);
        routeControl = null;
      }
    }

    previousSelectedNames = new Set(selectedNames);

  } catch (error) {
    console.error("Fehler beim Laden der Stationen für die Karte:", error);
  }
}


// --- Custom Router für Leaflet Routing Machine (spricht mit Backend /route-bike) ---
const orsProxyRouter = {
  _pendingController: null,
  supportsHeadings: () => false,

  route(waypoints, callback, context) {
    // Abbrechen falls noch eine Anfrage läuft
    if (orsProxyRouter._pendingController) {
      try { orsProxyRouter._pendingController.abort(); } catch (_) { }
      orsProxyRouter._pendingController = null;
    }

    // Waypoints in ORS-Format (lon, lat) umwandeln
    const coords = waypoints.map(wp => [wp.latLng.lng, wp.latLng.lat]);

    const controller = new AbortController();
    orsProxyRouter._pendingController = controller;

    // Anfrage ans eigene Backend
    fetch('/route-bike', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: coords }),
      signal: controller.signal
    })
      .then(async res => {
        if (!res.ok) throw new Error(`Backend ${res.status}`);
        const data = await res.json();

        // ORS liefert encodierte Polyline -> decodieren
        if (data?.routes && typeof data.routes[0]?.geometry === 'string') {
          const latLngs = decodePolyline(data.routes[0].geometry, 5);
          const distance = data.routes[0].summary?.distance || 0;
          const duration = data.routes[0].summary?.duration || 0;

          const routeForLRM = {
            name: 'Bike (ORS)',
            coordinates: latLngs,
            summary: { totalDistance: distance, totalTime: duration },
            instructions: [],
            waypoints: waypoints.map(wp => ({ latLng: wp.latLng })),
            inputWaypoints: waypoints
          };

          return callback.call(context, null, [routeForLRM]);
        }

        throw new Error('Unerwartetes ORS-Format');
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        callback.call(context, err);
      })
      .finally(() => {
        if (orsProxyRouter._pendingController === controller) {
          orsProxyRouter._pendingController = null;
        }
      });
  }
};

let routeControl = null;

// --- Funktion zum Erstellen der Fahrradtour aus ausgewählten Stationen ---
function createBikeTourFromSelectedStations() {

  const waypoints = buildWaypointsFromChecked();

  if (waypoints.length < 2) {
    alert("Mindestens zwei Stationen wählen.");
    return;
  }

  // Falls schon eine Route existiert → entfernen
  if (routeControl) {
    routePlanningMap.removeControl(routeControl);
    routeControl = null;
  }

  // Routing-Control mit ORS-Router
  routeControl = L.Routing.control({
    waypoints,
    router: orsProxyRouter,
    showAlternatives: false,
    draggableWaypoints: false,
    addWaypoints: false,
    routeWhileDragging: false,
    addWaypoints: false,
    fitSelectedRoutes: true,
    show: false,
    lineOptions: { styles: [{ weight: 5, opacity: 0.9}] },
    createMarker: () => null
  }).addTo(routePlanningMap);



}


// Warte bis das HTML-Element existiert
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("create-tour-map")) {
    initMapCreateTour();
  }
})

/**
 * Speichert die berechnete Tour (Stationen und Routen zwischen den Stationen) in MongoDB.
 */
function saveTour() {

}

/**
 * Bricht die Erstellung der Tour ab und setzt alle Änderungen zurück. 
 */
function cancelTourCreation() {

}
