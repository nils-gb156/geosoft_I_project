const { MongoClient } = require("mongodb")

const url = "mongodb://mongo:27017"
const client = new MongoClient(url)
const dbName = "geosoftware_I"
const collectionName = "stations"

let db;

async function connect() {
    const client = new MongoClient(url);
    await client.connect();
    console.log('MongoDB verbunden');

    db = client.db(dbName);
}

// Zugriff auf DB
function getDb() {
    if (!db) {
        throw new Error('DB ist nicht verbunden. Erst connect() aufrufen.');
    }
    return db;
}

module.exports = {
    connect,
    getDb,
};