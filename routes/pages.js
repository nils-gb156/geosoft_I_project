const express = require('express');
const path = require('path');
const router = express.Router();
const db = require('../db/database');

// Standardseite
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = router;