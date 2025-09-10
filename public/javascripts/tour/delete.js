"use strict"

// bricht die Tourerstellung ab
function cancelTourCreation() {
    // zentrale Aufräumfunktion nutzt jetzt auch Segment-Tooltips
    if (window.clearRouteArtifacts) {
        window.clearRouteArtifacts();
    } else

        if (window.routeLayer) {
            window.routePlanningMap.removeLayer(window.routeLayer);
            window.routeLayer = null;
        }

    document.querySelectorAll("#stations-table-body input[type='checkbox']").forEach(cb => cb.checked = false);
    const roundtripEl = document.getElementById("check-roundtour");
    if (roundtripEl) roundtripEl.checked = false;
    if (window.selectionOrder) window.selectionOrder = [];
    loadStationsOnMap();
}
window.cancelTourCreation = cancelTourCreation;
