const mongoose = require('mongoose');
const { generatePdfReport } = require('./server/services/reporter');
const fs = require('fs');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://usaija_db_user:6obWuqoVoH4pwScI@cluster0.v0wsqpx.mongodb.net/?appName=Cluster0';

async function testPdf() {
    console.log("Connecting database...", MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.");

    const db = mongoose.connection.db;
    const scan = await db.collection('scans').findOne({ status: 'completed' }, { sort: { _id: -1 } });
    if (!scan) throw new Error("No scan");

    const pages = await db.collection('scanpages').find({ scan_id: scan._id }).toArray();
    console.log(`Found scan: ${scan._id} with ${pages.length} pages.`);

    try {
        console.log("Generating PDF native buffer...");
        const buffer = await generatePdfReport(scan, pages);
        console.log(`Buffer type:`, typeof buffer, `IsBuffer:`, Buffer.isBuffer(buffer));
        console.log(`Buffer length received: ${buffer.length} bytes`);
        if (buffer.length < 1000) {
            console.error("WARNING: Buffer is abnormally small. Likely failed or crashed.");
            console.error("First 50 bytes of buffer:", Buffer.from(buffer).slice(0, 50).toString('utf-8'));
        }

        fs.writeFileSync('./diagnostic_render.pdf', Buffer.from(buffer));
        console.log("Wrote diagnostic_render.pdf successfully.");

        console.log("Testing hex dump...");
        const diskFile = fs.readFileSync('./diagnostic_render.pdf');
        console.log("Hex Signature:", diskFile.slice(0, 10).toString('hex'));
        console.log("ASCII Signature:", diskFile.slice(0, 50).toString('ascii').replace(/\n/g, ' '));

    } catch (err) {
        console.error("Puppeteer crashed during PDF generation:", err);
    }

    await mongoose.disconnect();
}

testPdf();
