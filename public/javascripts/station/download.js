/**
 * Läd die Station als GeoJSON Datei herunter.
 * @param {*} station 
 */
function downloadStation(station) { 
    const name = `${station.name}_station.geojson`;
    const geojson = station.geojson;

    // Blob erzeugen
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });

    // Download-Link erzeugen und klicken
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}