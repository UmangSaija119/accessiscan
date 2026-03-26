const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');
const http = require('http');

const MONGODB_URI = 'mongodb+srv://usaija_db_user:6obWuqoVoH4pwScI@cluster0.v0wsqpx.mongodb.net/?appName=Cluster0';
const JWT_SECRET = 'accessiscan-dev-secret-key-change-in-production-abc123xyz';

async function main() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('test');

    // Find latest scan
    const scan = await db.collection('scans').findOne({ status: 'completed' }, { sort: { _id: -1 } });
    if (!scan) {
        console.error("No completed scans found!");
        process.exit(1);
    }

    const token = jwt.sign({ id: scan.user_id, email: "test@example.com" }, JWT_SECRET, { expiresIn: '24h' });
    const scanId = scan._id.toString();
    console.log("Fetching PDF for scan ID:", scanId);

    const req = http.get(`http://localhost:3000/api/reports/${scanId}/pdf`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    }, (res) => {
        console.log('Status Code:', res.statusCode);
        console.log('Headers:', res.headers);
        const data = [];
        res.on('data', chunk => data.push(chunk));
        res.on('end', () => {
            const buffer = Buffer.concat(data);
            console.log('Total bytes downloaded:', buffer.length);
            console.log("First 30 bytes (ascii):", buffer.slice(0, 30).toString('ascii').replace(/\n/g, ' '));
        });
    });

    req.on('error', err => console.error("HTTP Error:", err));
    req.end();

    await client.close();
}
main().catch(console.error);
