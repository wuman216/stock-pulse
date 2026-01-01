const db = require('../db.cjs');

// Mock data generator for 2025-12-31
// Since this date is in the future for TWSE, we simulate the data.

const stocks = [
    { code: '2330', name: '台積電', basePrice: 1080 },
    { code: '2317', name: '鴻海', basePrice: 220 },
    { code: '2454', name: '聯發科', basePrice: 1350 },
    { code: '3231', name: '緯創', basePrice: 120 },
    { code: '2646', name: '星宇航空', basePrice: 35 },
    { code: '3450', name: '聯鈞', basePrice: 240 },
    { code: '2354', name: '鴻準', basePrice: 75 },
    { code: '3661', name: '世芯-KY', basePrice: 1900 },
    { code: '4919', name: '新唐', basePrice: 100 },
    { code: '3013', name: '晟銘電', basePrice: 170 },
    { code: '2382', name: '廣達', basePrice: 320 },
    { code: '2486', name: '一詮', basePrice: 130 },
    { code: '3037', name: '欣興', basePrice: 175 },
    { code: '2495', name: '普安', basePrice: 42 },
    { code: '3533', name: '嘉澤', basePrice: 1800 },
    { code: '8249', name: '菱光', basePrice: 70 },
    { code: '6442', name: '光聖', basePrice: 500 },
    { code: '3017', name: '奇鋐', basePrice: 680 },
    { code: '2345', name: '智邦', basePrice: 610 },
    { code: '6415', name: '矽力*-KY', basePrice: 550 },
    { code: '2308', name: '台達電', basePrice: 400 },
    { code: '2881', name: '富邦金', basePrice: 90 },
    { code: '2303', name: '聯電', basePrice: 55 },
    { code: '2603', name: '長榮', basePrice: 210 },
    { code: '2609', name: '陽明', basePrice: 70 }
];

const generateOHLC = (base) => {
    const volatility = base * 0.05; // 5% volatility
    const open = Math.round((base + (Math.random() - 0.5) * volatility) * 10) / 10;
    const close = Math.round((base + (Math.random() - 0.5) * volatility) * 10) / 10;
    const high = Math.round((Math.max(open, close) + Math.random() * volatility * 0.5) * 10) / 10;
    const low = Math.round((Math.min(open, close) - Math.random() * volatility * 0.5) * 10) / 10;
    return { open, high, low, close };
};

const date = '2025-12-30';

console.log(`Seeding simulation data for ${date}...`);

db.serialize(() => {
    // Clear future data if exists so 12-30 becomes the latest
    db.run("DELETE FROM transactions WHERE date = '2025-12-31'");

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO transactions 
        (date, stock_code, name, open_price, high_price, low_price, close_price, trade_volume, trade_value) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.run("BEGIN TRANSACTION");

    stocks.forEach(stock => {
        const prices = generateOHLC(stock.basePrice);

        // Random volume between 5,000,000 and 50,000,000 (roughly)
        // Adjust for price to keep realistic values (High price stocks have lower volume usually)
        const volumeFactor = 1000 / stock.basePrice;
        const volume = Math.floor((Math.random() * 10000 + 5000) * 1000 * volumeFactor);

        // Calculated Trade Value
        const value = Math.floor(volume * prices.close);

        stmt.run(
            date,
            stock.code,
            stock.name,
            prices.open,
            prices.high,
            prices.low,
            prices.close,
            volume,
            value
        );
    });

    db.run("COMMIT", (err) => {
        if (err) console.error("Commit failed", err);
        else console.log('Simulation data upserted successfully.');
    });

    stmt.finalize();
});
