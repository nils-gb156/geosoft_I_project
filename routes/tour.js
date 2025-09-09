const express = require('express');
const path = require('path');
const router = express.Router();
const db = require('../db/database');

//API-Key
const ORS_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImIwMDE0MTI2YTczYTQwNTY5YzA5ODY5Yjg4NzFkODAzIiwiaCI6Im11cm11cjY0In0="

// Route-Handler: nimmt Koordinaten entgegen, ruft ORS an und gibt die Route zurück
router.post('/route-bike', async (req, res) => {
  try {
    const { coordinates, elevation = false } = req.body || {};

    // --- 1) Eingabe prüfen ---
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ error: 'Mindestens zwei Koordinaten nötig.' });
    }
    const valid = coordinates.every(c =>
      Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])
    );
    if (!valid) {
      return res.status(400).json({ error: 'Koordinatenformat muss [[lon,lat], ...] sein.' });
    }

    // --- 2) Anfrage an OpenRouteService ---
    const orsRes = await fetch('https://api.openrouteservice.org/v2/directions/cycling-regular', {
      method: 'POST',
      headers: {
        'Authorization': ORS_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ coordinates, elevation })
    });

    if (!orsRes.ok) {
      // Fehler von ORS ins Log schreiben und ans Frontend weitergeben
      const errText = await orsRes.text();
      console.error(`ORS Fehler (${orsRes.status}):`, errText);
      return res.status(orsRes.status).json({ error: 'ORS Anfrage fehlgeschlagen' });
    }

    // --- 3) Erfolgreiche Antwort weiterreichen ---
    const data = await orsRes.json();
    return res.json(data);

  } catch (err) {
    // Unerwarteter interner Fehler
    console.error('Backend-Fehler /route-bike:', err);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// Tour speichern
router.post('/save-tour', async (req, res) => {
  const { name, description, waypoints, routeGeojson } = req.body;
  if (!name || !Array.isArray(waypoints) || !routeGeojson) {
    return res.status(400).json({ error: "Ungültige Daten" });
  }
  try {
    const dbInstance = db.getDb();
    await dbInstance.collection('tours').insertOne({ name, description, waypoints, routeGeojson });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Speichern der Tour" });
  }
});

// Alle Touren laden
router.get('/get-tours', async (req, res) => {
  try {
    const dbInstance = db.getDb();
    const tours = await dbInstance.collection('tours').find().toArray();
    res.json(tours);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Touren" });
  }
});

// Tour löschen
router.post('/delete-tour', async (req, res) => {
  const { name } = req.body;
  try {
    const dbInstance = db.getDb();
    await dbInstance.collection('tours').deleteOne({ name });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Löschen der Tour" });
  }
});

// Tour bearbeiten
router.post('/edit-tour', async (req, res) => {
  const { oldName, name, description, waypoints, routeGeojson } = req.body;
  try {
    const dbInstance = db.getDb();
    await dbInstance.collection('tours').updateOne(
      { name: oldName },
      { $set: { name, description, waypoints, routeGeojson } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Bearbeiten der Tour" });
  }
});

module.exports = router;