"use strict"

/**
 * Löscht die angegeben Station aus MongoDB.
 * @param {*} name Name der Station
 * @returns 
 */
async function deleteStation(name) {
    if (!confirm("Möchtest du die Station wirklich löschen?")) return;

    // Anfrage an Server senden
    try {
        const response = await fetch("/delete-station", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name
            }),
        })

        if (!response.ok) {
            if (response.status === 404) {
                alert(`Station existiert nicht.`);
            } else {
                throw new Error("Fehler beim Löschen");
            }
            return;
        }

        loadStations();
    }
    catch (error) {
        console.error("Löschen fehlgeschlagen:", error);
        alert("Fehler beim Löschen");
    }
}