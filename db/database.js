const { MongoClient } = require("mongodb");

const url = process.env.MONGO_URI || "mongodb://localhost:27017/geosoftware_I";
const client = new MongoClient(url);

let db;

async function connect() {
    await client.connect();
    console.log("MongoDB verbunden:", url);

    db = client.db();
}

// Zugriff auf DB
function getDb() {
    if (!db) {
        throw new Error("DB ist nicht verbunden. Erst connect() aufrufen.");
    }
    return db;
}

module.exports = {
    connect,
    getDb,
};
