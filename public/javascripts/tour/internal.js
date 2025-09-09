"use strict"

loadStations();

let selectionOrder = []; // Reihenfolge der angehakten Stationen

/**
 * Läd alle Stationen aus MongoDB und stellt sie in der Tabelle dar.
 */
async function loadStations() {
  try {
    const response = await fetch('/get-stations');
    const stations = await response.json();

    window.stationsByName = new Map(stations.map(s => [s.name, s]));

    const tableBody = document.getElementById("stations-table-body");
    tableBody.innerHTML = "";

    stations.forEach(station => {

      const row = document.createElement("tr");

      // Prüfen, ob GeoJSON & Koordinaten vorhanden sind
      let lat = "";
      let lng = "";
      if (
        station.geojson &&
        station.geojson.features &&
        station.geojson.features.length > 0 &&
        station.geojson.features[0].geometry &&
        station.geojson.features[0].geometry.type === "Point"
      ) {
        const coords = station.geojson.features[0].geometry.coordinates;
        lng = coords[0];
        lat = coords[1];
      }

      row.innerHTML = `
                <td>
                    <input class="form-check-input station-checkbox" 
                           type="checkbox" 
                           value="${station.name}" 
                           data-lat="${lat}" 
                           data-lng="${lng}">
                </td>
                <td>${station.name}</td>
                <td>${station.description}</td>       
            `;

      tableBody.appendChild(row);

      // Checkbox-Event
      const checkbox = row.querySelector(".station-checkbox");
      checkbox.addEventListener("change", (e) => {
        const name = e.target.value;
        const checked = e.target.checked;

        if (e.target.checked) {
          if (!selectionOrder.includes(name)) selectionOrder.push(name);
        } else {
          const i = selectionOrder.indexOf(name);
          if (i !== -1) selectionOrder.splice(i, 1);
        }

        loadStationsOnMap();

        if (checked && window.routePlanningMap) {
          // Bei Punkten
          let lat = parseFloat(e.target.dataset.lat);
          let lng = parseFloat(e.target.dataset.lng);

          // Bei Polygonen oder Einzel-Feature
          if (!(isFinite(lat) && isFinite(lng))) {
            const st = window.stationsByName?.get(name);
            let center = null;

            // FeatureCollection
            if (st?.geojson?.type === "FeatureCollection") {
              const f0 = st.geojson.features?.[0];
              center = f0 ? bboxCenterOfGeometry(f0.geometry) : null;
            }
            // Einzelnes Feature
            else if (st?.geojson?.type === "Feature") {
              center = st.geojson.geometry ? bboxCenterOfGeometry(st.geojson.geometry) : null;
            }

            if (center) { lng = center[0]; lat = center[1]; }
          }

          if (isFinite(lat) && isFinite(lng)) {
            const targetZoom = Math.max(routePlanningMap.getZoom(), 10);
            routePlanningMap.flyTo([lat, lng], targetZoom, { duration: 0.6 });
          }
        }
      });



    });

  } catch (_) {}
}