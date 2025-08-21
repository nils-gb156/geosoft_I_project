"use-strict"

const routePlanningMap = L.map('map-routes').setView([51, 10], 6);
let routeLayer;
let previousSelectedNames = new Set();


/**
 * Initialisiert die Karte beim Laden der Webseite.
 */
function initMapFileInput() {

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
    routeLayer = L.layerGroup(); // leere Gruppe

    selectedStations.forEach(station => {
      if (station.geojson) {
        L.geoJSON(station.geojson)
          .bindPopup(`<b>${station.name}</b><br>${station.description}`)
          .addTo(routeLayer);
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

document.getElementById("select-all").addEventListener("change", loadStationsOnMap);

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

// --- Funktion zum Erstellen der Fahrradroute aus ausgewählten Stationen ---
function createBikeRouteFromSelectedStations() {
  const checked = document.querySelectorAll("#stations-table-body input[type='checkbox']:checked");
  const waypoints = Array.from(checked).map(cb => {
    const lat = parseFloat(cb.dataset.lat);
    const lng = parseFloat(cb.dataset.lng);
    return (!isNaN(lat) && !isNaN(lng)) ? L.Routing.waypoint(L.latLng(lat, lng)) : null;
  }).filter(Boolean);

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
    lineOptions: { styles: [{ weight: 5, opacity: 0.9 }] },
    createMarker: () => null
  }).addTo(routePlanningMap);



}


// Warte bis das HTML-Element existiert
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("map-routes")) {
    initMapFileInput();
  }
})
