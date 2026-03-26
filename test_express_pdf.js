const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());

app.get('/pdf', (req, res) => {
    const pdfBuffer = fs.readFileSync('diagnostic_render.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="test.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(Buffer.from(pdfBuffer));
});

const server = app.listen(3002, async () => {
    console.log("Server listening on 3002. Fetching locally...");
    try {
        const response = await fetch('http://localhost:3002/pdf');
        const pdfBytes = await response.arrayBuffer();
        fs.writeFileSync('client_received.pdf', Buffer.from(pdfBytes));
        console.log("Written client_received.pdf. Length:", pdfBytes.byteLength);

        server.close();
    } catch (err) {
        console.error(err);
        server.close();
    }
});
