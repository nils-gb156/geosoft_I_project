"use strict"

/**
 * Bricht den Prozess der Tourerstellung ab und setzt alle zugehörigen UI-Elemente und Daten zurück.
 * Diese Funktion wird aufgerufen, wenn der Benutzer auf "Abbrechen" klickt.
 */
function cancelTourCreation() {
  // Entfernt alle Routenlinien und Segment-Popups von der Karte.
  clearRouteArtifacts();

  // Entfernt die Marker und Geometrien der ausgewählten Stationen von der Karte.
  if (routeLayer) {
    routePlanningMap.removeLayer(routeLayer);
    routeLayer = null;
  }

  // Setzt alle Checkboxen in der Stationstabelle zurück (entfernt die Haken).
  document.querySelectorAll("#stations-table-body input.station-checkbox[type='checkbox']")
    .forEach(cb => { cb.checked = false; });

  // Setzt das globale Array für die Auswahlreihenfolge der Stationen hart zurück.
  if (Array.isArray(window.selectionOrder)) {
    window.selectionOrder.length = 0;
  }
  
  // Setzt die Checkbox für die Rundtour zurück.
  const roundEl = document.getElementById("check-roundtour");
  if (roundEl) roundEl.checked = false;

  // Leert die Eingabefelder für den Tournamen und die Beschreibung.
  const nameInput = document.getElementById("tour-name");
  if (nameInput) nameInput.value = "";
  const descInput = document.getElementById("tour-description");
  if (descInput) descInput.value = "";

  // Lädt die Kartenansicht der Stationen neu, um die visuellen Änderungen zu übernehmen (leere Karte).
  if (typeof loadStationsOnMap === "function") {
    loadStationsOnMap();
  }
}
// Macht die Funktion global verfügbar, damit sie vom onclick-Handler im HTML aufgerufen werden kann.
window.cancelTourCreation = cancelTourCreation;
