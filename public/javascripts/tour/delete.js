"use strict"

function cancelTourCreation() {
  if (window.routeControl) {
    window.routePlanningMap.removeControl(window.routeControl);
    window.routeControl = null;
  }
  if (window.routeLayer) {
    window.routePlanningMap.removeLayer(window.routeLayer);
    window.routeLayer = null;
  }
  document.querySelectorAll("#stations-table-body input[type='checkbox']").forEach(cb => {
    cb.checked = false;
  });
  const roundtripEl = document.getElementById("check-roundtour");
  if (roundtripEl) roundtripEl.checked = false;
  if (window.selectionOrder) window.selectionOrder = [];
  loadStationsOnMap();
}
window.cancelTourCreation = cancelTourCreation;

// Warte bis das HTML-Element existiert
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("edit-tour-map")) {
    initMapEditTour();
  }
})