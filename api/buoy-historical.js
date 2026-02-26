import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

export default async function handler(req, res) {
    // Locate CSV relative to project root
    const filePath = path.join(process.cwd(), 'data', '46042_master_2012_2023.csv');
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Historical data file not found" });
    }

    const results = [];
    const stream = fs.createReadStream(filePath).pipe(csv());

    stream.on('data', (data) => results.push(data));
    stream.on('end', () => {
        res.status(200).json(results);
    });
    stream.on('error', (err) => {
        console.error("CSV error:", err);
        res.status(500).json({ error: "Failed to read CSV" });
    });
}
