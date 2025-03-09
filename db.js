require('dotenv').config();
const { MongoClient } = require('mongodb');

// MongoDB URI and client setup
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const databaseName = 'sales-tracker'; // Database name

// Function to connect to the MongoDB database (persistent connection)
async function connectDB() {
    try {
        if (!client.topology || !client.topology.isConnected()) {
            await client.connect(); // Connect to MongoDB
            console.log('Connected to MongoDB!');
        }
        return client.db(databaseName);
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        throw err;
    }
}

// Gracefully close MongoDB client on application exit
process.on('SIGINT', async () => {
    try {
        await client.close();
        console.log('MongoDB client closed');
    } catch (err) {
        console.error('Error closing MongoDB connection:', err);
    }
    process.exit(0);
});

// Exporting functions for usage in server.js
module.exports = {
    connectDB
};
