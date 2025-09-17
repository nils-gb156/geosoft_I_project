"use strict"

// Polyline-Decoder (Umwandlung in Koordinaten Array)

function decodePolyline(str, precision = 5) {
    let index = 0, lat = 0, lng = 0, coordinates = [];
    const factor = Math.pow(10, precision);
    while (index < str.length) {
        let b, shift = 0, result = 0;
        do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        shift = 0; result = 0;
        do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += deltaLat; lng += deltaLng;
        coordinates.push(L.latLng(lat / factor, lng / factor));
    }
    return coordinates;
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
          const r = data.routes[0];
          const latLngs = decodePolyline(r.geometry, 5);
          const distance = r.summary?.distance || 0;
          const totalDuration = r.summary?.duration || 0; // Sekunden (ORS)

          // Indizes der Waypoints im decodierten Linien-Array
          const wpIdx = Array.isArray(r.way_points) ? r.way_points : [];
          // Segmente (ORS enthält distance + duration)
          const segments = Array.isArray(r.segments) ? r.segments : [];
          const segmentData = segments.map((seg, i) => ({
            distance: seg.distance,          // Meter
            duration: seg.duration,          // Sekunden
            startIdx: wpIdx[i],
            endIdx: wpIdx[i + 1]
          })).filter(s =>
            Number.isFinite(s.startIdx) &&
            Number.isFinite(s.endIdx) &&
            Number.isFinite(s.distance) &&
            Number.isFinite(s.duration)
          );

          const routeForLRM = {
            name: 'Bike (ORS)',
            coordinates: latLngs,
            summary: {
              totalDistance: distance,
              totalDuration: totalDuration
            },
            instructions: [],
            waypoints: waypoints.map(wp => ({ latLng: wp.latLng })),
            inputWaypoints: waypoints,
            segmentData
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

window.orsProxyRouter = orsProxyRouter;
