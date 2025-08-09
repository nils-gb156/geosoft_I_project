const express = require('express');
const path = require('path');
const router = express.Router();
const db = require('../db/database');

// Standardseite
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/station_administration.html'));
});

// Routen-Verwaltungsseite
router.get('/routen', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/route_administration.html'));
});

// Stationen-Verwaltungsseite
router.get('/stationen', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/station_administration.html'));
});

// Impressumsseite
router.get('/impressum', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/impressum.html'));
});

// Datenschutzseite
router.get('/datenschutz', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/datenschutz.html'));
});

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

module.exports = router;