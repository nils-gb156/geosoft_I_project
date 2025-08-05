const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const host = 'localhost';

// Statische Dateien aus /public bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Routen einbinden
const pagesRouter = require('./routes/pages');

app.use('/', pagesRouter);

// Server starten
app.listen(port, host);

console.log(`Server läuft auf http://${host}:${port}`);
