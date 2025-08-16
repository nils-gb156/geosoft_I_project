const express = require('express');
const path = require('path');
const router = express.Router();
const db = require('../db/database');

// neue Station in MongoDB speichern
router.post('/save-station', async (req, res) => {
    const { name, description, url, geojson } = req.body;

    if (!name || !description || !geojson) {
        return res.status(400).json({error: "Name, Beschreibung oder GeoJSON fehlt"});
    }

    try {
        const parsed = typeof geojson === 'string' ? JSON.parse(geojson) : geojson;
        const collection = db.getDb().collection('stations');

        // Prüfe auf vorhandene Namen
        const exists = await collection.findOne({name: name});

        if (exists) {
             return res.status(409).json({ error: "Station mit diesem Namen existiert bereits." });
        }

        const result = await collection.insertOne({
            name: name,
            description: description,
            url: url,
            geojson: parsed,
            created: new Date()
        });

        res.status(201).json({ message: "Station gespeichert", id: result.insertedId });
    }
    catch (error) {
        console.error("Fehler beim Speichern der Station:", error);
        res.status(500).json({ error: "Fehler beim Speichern der Station." });
    }
})

// Auflisten aller Stationen aus MongoDB
router.get('/get-stations', async (req, res) => {
    try {
        const collection = db.getDb().collection('stations');

        const stations = await collection
            .find({}, { projection: { name: 1, description: 1, url: 1, geojson: 1 } })
            .toArray();

        res.json(stations);
    } catch (error) {
        console.error("Fehler beim Laden der Stationen:", error);
        res.status(500).json({ error: "Fehler beim Laden der Stationen." });
    }
})

// Löschen einer Route aus MongoDB
router.post('/delete-station', async (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Keine Station angegeben." });
    }

    try {
        const collection = db.getDb().collection('stations');
        const result = await collection.deleteOne({ name: name });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Station nicht gefunden." });
        }

        res.status(200).json({ message: "Station erfolgreich gelöscht." });

    } catch (error) {
        console.error("Fehler beim Löschen der Station:", error);
        res.status(500).json({ error: "Fehler beim Löschen der Station" });
    }
});

module.exports = router;