const express = require('express');
const path = require('path');
const pagesRouter = require('./routes/pages');
const stationRouter = require('./routes/station');
const routeRouter = require('./routes/route');

const app = express();
const mongo = require('./db/database');

mongo.connect().then(() => {
}).catch(err => {
  console.error('MongoDB-Fehler:', err);
  process.exit(1);
});

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', pagesRouter);
app.use('/', stationRouter);
app.use('/', routeRouter);
app.use((req, res, next) => {
  res.status(404).send('Seite nicht gefunden');
});

module.exports = app;