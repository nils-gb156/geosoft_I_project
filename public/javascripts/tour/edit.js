"use strict"

const editTourMap = L.map('edit-tour-map').setView([51, 10], 6);

/**
 * Initialisiert die Karte beim Laden der Webseite.
 */
function initMapEditTour() {
    // OSM
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(editTourMap);
}

// Warte bis das HTML-Element existiert
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("edit-tour-map")) {
    initMapEditTour();
  }
})