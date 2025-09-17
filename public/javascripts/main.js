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


// Alle Koordinaten einer GeoJSON-Geometry durchlaufen

/**
 * Iteriert über jede Koordinate in einer GeoJSON-Geometrie und führt eine Callback-Funktion aus.
 * Unterstützt verschiedene Geometrietypen, einschließlich GeometryCollection.
 * @param {object} geom Die GeoJSON-Geometrie.
 * @param {function} cb Die Callback-Funktion, die für jede Koordinate aufgerufen wird. Das Koordinatenpaar wird als Argument übergeben.
 */
function eachCoordInGeometry(geom, cb) {
  if (!geom) return;
  if (geom.type === 'GeometryCollection') {
    (geom.geometries || []).forEach(g => eachCoordInGeometry(g, cb));
    return;
  }
  /**
   * Eine rekursive Hilfsfunktion, die in verschachtelte Koordinaten-Arrays eintaucht.
   * @param {Array} coords Das Array von Koordinaten.
   */
  function dive(coords) {
    if (!coords) return;
    // Wenn das erste Element eine Zahl ist, handelt es sich um ein Koordinatenpaar.
    if (typeof coords[0] === 'number') cb(coords); 
    // Andernfalls weiter in die Verschachtelung eintauchen.
    else coords.forEach(dive);
  }
  // Bei einem 'Point' die Koordinaten direkt an den Callback übergeben.
  if (geom.type === 'Point') cb(geom.coordinates);
  // Bei anderen Geometrietypen (LineString, Polygon etc.) die rekursive Funktion starten.
  else dive(geom.coordinates);
}

// Mitte der Bounding Box für beliebige Geometrien (hier für Mittelpunktbestimmung des Polygons)

/**
 * Berechnet den Mittelpunkt der Bounding Box einer beliebigen GeoJSON-Geometrie.
 * Dies ist nützlich, um einen zentralen Punkt für Polygone oder komplexe Geometrien zu finden.
 * @param {object} geom Die GeoJSON-Geometrie.
 * @returns {Array<number>|null} Ein Array mit [longitude, latitude] des Mittelpunkts oder null, wenn keine gültigen Koordinaten gefunden wurden.
 */
function bboxCenterOfGeometry(geom) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  
  // Iteriert über alle Koordinaten, um die äußeren Grenzen (Bounding Box) zu finden.
  eachCoordInGeometry(geom, ([lng, lat]) => {
    if (!isFinite(lng) || !isFinite(lat)) return; // Ungültige Koordinaten überspringen.
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });

  // Wenn keine gültigen Koordinaten gefunden wurden, null zurückgeben.
  if (!isFinite(minLng)) return null;
  
  // Den Mittelpunkt der Bounding Box berechnen.
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2]; // [lng, lat]
}

// Funktion baut Waypoints aus aktuell gecheckten Checkboxen
/**
 * Erstellt eine Liste von Leaflet-Routing-Wegpunkten aus den aktuell ausgewählten Stations-Checkboxes.
 * Die Reihenfolge der Wegpunkte wird durch das globale `window.selectionOrder`-Array bestimmt.
 * @param {object} [opts={}] Optionen für die Wegpunkterstellung.
 * @param {boolean} [opts.closeLoop=false] Wenn true, wird der erste Wegpunkt am Ende hinzugefügt, um eine geschlossene Schleife zu bilden.
 * @returns {Array<L.Routing.waypoint>} Ein Array von Leaflet-Wegpunkten.
 */
function buildWaypointsFromChecked(opts = {}) {
  const closeLoop = !!opts.closeLoop;

  // Alle Checkboxen, die aktuell ausgewählt sind.
  const checkedBoxes = Array.from(document.querySelectorAll("#stations-table-body input[type='checkbox']:checked"));
  const checkedSet = new Set(checkedBoxes.map(cb => cb.value));
  const byNameCb = new Map(checkedBoxes.map(cb => [cb.value, cb]));

  // Filtert die globale Auswahlreihenfolge, um nur die aktuell ausgewählten Stationen zu berücksichtigen.
  const orderedNames = (window.selectionOrder || []).filter(name => checkedSet.has(name));

  // Erstellt die Wegpunkte in der korrekten Reihenfolge.
  const wps = orderedNames.map(name => {
    const cb = byNameCb.get(name);
    let lat = parseFloat(cb?.dataset?.lat);
    let lng = parseFloat(cb?.dataset?.lng);

    // Wenn keine Koordinaten im Checkbox-Dataset vorhanden sind, wird der Mittelpunkt der GeoJSON-Geometrie berechnet.
    if (!(isFinite(lat) && isFinite(lng))) {
      const station = window.stationsByName?.get(name);

      // Unterstützt sowohl FeatureCollection als auch einzelne Feature-Objekte.
      let feature = null;
      if (station?.geojson?.type === "FeatureCollection") {
        feature = station.geojson.features?.[0];
      } else if (station?.geojson?.type === "Feature") {
        feature = station.geojson;
      }

      // Berechnet den Mittelpunkt der Geometrie.
      const center = feature ? bboxCenterOfGeometry(feature.geometry) : null;
      if (center) {
        lng = center[0];
        lat = center[1];
      }
    }

    // Erstellt den Wegpunkt, wenn gültige Koordinaten vorhanden sind.
    return (isFinite(lat) && isFinite(lng))
      ? L.Routing.waypoint(L.latLng(lat, lng))
      : null;
  }).filter(Boolean); // Entfernt alle null-Einträge.

  // Fügt den ersten Wegpunkt am Ende hinzu, um die Route zu schließen.
  if (closeLoop && wps.length >= 2) {
    const first = wps[0];
    wps.push(L.Routing.waypoint(first.latLng));
  }
  return wps;
}

