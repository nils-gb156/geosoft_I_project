"use strict"

/**
 * Sichtbarkeit der Container für Stationserstellung umschalten.
 * @param {Event} event
 * @param {string} tab
 */
function changeRider(event, tab) {
    event.preventDefault(); // verhindert Scroll nach oben

    // Alle Container ausblenden
    document.getElementById("fileupload").style.display = "none";
    document.getElementById("mapdraw").style.display = "none";
    document.getElementById("textfield").style.display = "none";
    document.getElementById("geocode").style.display = "none";

    // Alle Tabs deaktivieren
    document.getElementById("fileupload-nav").className = "nav-link text-dark";
    document.getElementById("mapdraw-nav").className = "nav-link text-dark";
    document.getElementById("textfield-nav").className = "nav-link text-dark";
    document.getElementById("geocode-nav").className = "nav-link text-dark";

    // Gewählten Container anzeigen
    document.getElementById(tab).style.display = "block";

    // Aktiven Tab hervorheben
    document.getElementById(tab + "-nav").className = "nav-link text-dark active";

    // Timeout für Karten
    if (tab === "mapdraw" && drawMap) {
        setTimeout(() => {
            drawMap.invalidateSize();
        }, 200);
    }

    if (tab === "fileupload" && fileuploadMap) {
        setTimeout(() => {
            fileuploadMap.invalidateSize();
        }, 200);
    }

    if (tab === "geocode" && geocodeMap) {
        setTimeout(() => {
            geocodeMap.invalidateSize();
        }, 200);
    }

}

/**
 * Prüft, ob es sich um ein gültiges GeoJSON Feature oder FeatureCollection mit Point handelt.
 * @param {*} geojson 
 * @returns {boolean}
 */
function isValidGeoJSONPoint(geojson) {
    const validType = "Point";

    if (geojson.type === "FeatureCollection") {
        return geojson.features.every(feature =>
            feature.geometry && feature.geometry.type === validType
        );

    } else if (geojson.type === "Feature") {
        return geojson.geometry && geojson.geometry.type === validType;

    } else {
        return false;
    }
}

/**
 * Prüft, ob es sich um ein gültiges GeoJSON Feature oder FeatureCollection mit Polygon handelt.
 * @param {*} geojson 
 * @returns {boolean}
 */
function isValidGeoJSONPolygon(geojson) {
    const validType = "Polygon";

    if (geojson.type === "FeatureCollection") {
        return geojson.features.every(feature =>
            feature.geometry && feature.geometry.type === validType
        );

    } else if (geojson.type === "Feature") {
        return geojson.geometry && geojson.geometry.type === validType;

    } else {
        return false;
    }
}

/**
 * Prüft, ob eine GeoJSON Feature oder FeatureCollection aus genau einem Feaature besteht.
 * @param {*} geojson 
 * @returns {boolean}
 */
function hasExactlyOneFeature(geojson) {
    if (geojson.type === "Feature") {
        return true;
    }
    if (geojson.type === "FeatureCollection") {
        return Array.isArray(geojson.features) && geojson.features.length === 1;
    }
    return false;
}


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

// Alle Koordinaten einer GeoJSON-Geometry durchlaufen

function eachCoordInGeometry(geom, cb) {
  if (!geom) return;
  if (geom.type === 'GeometryCollection') {
    (geom.geometries || []).forEach(g => eachCoordInGeometry(g, cb));
    return;
  }
  function dive(coords) {
    if (!coords) return;
    if (typeof coords[0] === 'number') cb(coords); else coords.forEach(dive);
  }
  if (geom.type === 'Point') cb(geom.coordinates);
  else dive(geom.coordinates);
}

// Mitte der Bounding Box für beliebige Geometrien (hier für Mittelpunktbestimmung des Polygons)

function bboxCenterOfGeometry(geom) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  eachCoordInGeometry(geom, ([lng, lat]) => {
    if (!isFinite(lng) || !isFinite(lat)) return;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  if (!isFinite(minLng)) return null;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2]; // [lng, lat]
}

// Funktion baut Waypoints aus aktuell gecheckten Checkboxen

function buildWaypointsFromChecked() {
  const checkedBoxes = Array.from(document.querySelectorAll("#stations-table-body input[type='checkbox']:checked"));
  const checkedSet = new Set(checkedBoxes.map(cb => cb.value));
  const byNameCb = new Map(checkedBoxes.map(cb => [cb.value, cb]));

  const orderedNames = selectionOrder.filter(name => checkedSet.has(name));

  return orderedNames.map(name => {
    const cb = byNameCb.get(name);

    let lat = parseFloat(cb?.dataset?.lat);
    let lng = parseFloat(cb?.dataset?.lng);

    //BBox-Mitte aus GeoJSON (für Polygone)
    if (!(isFinite(lat) && isFinite(lng))) {
      const station = window.stationsByName?.get(name);
      const f0 = station?.geojson?.features?.[0];
      const center = f0 ? bboxCenterOfGeometry(f0.geometry) : null; 
      if (center) {
        lng = center[0];
        lat = center[1];
      }
    }

    return (isFinite(lat) && isFinite(lng))
      ? L.Routing.waypoint(L.latLng(lat, lng))
      : null;
  }).filter(Boolean);
}
