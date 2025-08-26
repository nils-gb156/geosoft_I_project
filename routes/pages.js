const express = require('express');
const path = require('path');
const router = express.Router();

// Standardseite
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Touren-Verwaltungsseite
router.get('/touren', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/tour_administration.html'));
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

module.exports = router;