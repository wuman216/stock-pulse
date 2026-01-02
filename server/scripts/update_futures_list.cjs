const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const ODS_URL = 'https://www.taifex.com.tw/file/taifex/CHINESE/2/2_stockinfo.ods';
const OUT_FILE = path.resolve(__dirname, '../data/futures.json');

const updateFuturesList = async () => {
    console.log(`Downloading ODS from ${ODS_URL}...`);
    try {
        const response = await axios.get(ODS_URL, { responseType: 'arraybuffer' });
        const data = new Uint8Array(response.data);

        console.log("Parsing ODS...");
        const workbook = XLSX.read(data, { type: 'array' });

        // Assuming the first sheet has the data
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Look for 4-digit stock codes
        // The structure usually has columns like: [No, Symbol, Name, ...]
        // We will scan all cells for strings that look like stock codes (4 digits)
        // and filter for known patterns if needed.

        const codes = new Set();

        jsonData.forEach(row => {
            row.forEach(cell => {
                if (typeof cell === 'string' || typeof cell === 'number') {
                    const val = String(cell).trim();
                    // Regex for 4 digit stock code (strictly 4 digits, maybe check against TWSE range/TPEx range but basic is 4 digits)
                    // Note: Some ETFs are 5 digits or start with 00.
                    // Common Stocks: 1101, 2330.
                    // Futures can be on ETFs too (0050).

                    if (/^[0-9A-Z]{4,6}$/.test(val)) {
                        // Check if it looks like a stock code.
                        // Taifex file usually has a dedicated column "證券代號" or similar.
                        // Let's rely on column headers if possible?
                        // But headers might vary.
                        // Scanning is safer if the file is simple list.
                        // However, we might pick up line numbers?
                        // Let's assume codes are unique-ish and valid if they match our DB.
                        // But here we are just building a list.

                        // Let's actually look at row content.
                        // Usually: [ "1101", "台泥", ... ]
                        // If a row has a number then a name, it's likely a row.
                    }
                }
            });
        });

        // Better approach: Find header row index
        let codeColIndex = -1;
        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            for (let j = 0; j < row.length; j++) {
                const cell = String(row[j]).trim();
                // Common headers: "標的證券代號", "證券代號", "Stock Symbol"
                if (cell.includes("代號") || cell.includes("Symbol")) {
                    codeColIndex = j;
                    break;
                }
            }
            if (codeColIndex !== -1) break;
        }

        if (codeColIndex === -1) {
            console.log("Could not identify 'Code' column, using fallback scan...");
            jsonData.forEach(row => {
                row.forEach(cell => {
                    const val = String(cell).trim();
                    // Strict 4-6 chars
                    if (/^[0-9][0-9A-Z]{3,5}$/.test(val)) {
                        codes.add(val);
                    }
                });
            });
        } else {
            console.log(`Found Code Column at index ${codeColIndex}`);
            jsonData.forEach((row, idx) => {
                if (idx === 0) return; // Skip potential header row if it was row 0
                if (row[codeColIndex]) {
                    const val = String(row[codeColIndex]).trim();
                    if (/^[0-9][0-9A-Z]{3,5}$/.test(val)) {
                        codes.add(val);
                    }
                }
            });
        }

        const uniqueCodes = Array.from(codes).sort();
        console.log(`Found ${uniqueCodes.length} futures targets.`);

        fs.writeFileSync(OUT_FILE, JSON.stringify(uniqueCodes, null, 2));
        console.log(`Saved to ${OUT_FILE}`);

    } catch (e) {
        console.error("Error updating futures list:", e.message);
    }
};

updateFuturesList();
