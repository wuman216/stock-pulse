const db = require('../db.cjs');

const mockData = [
    { date: '2023-10-27', stock_code: '2330', name: '台積電', trade_volume: 50000000, trade_value: 28000000000 },
    { date: '2023-10-27', stock_code: '2317', name: '鴻海', trade_volume: 30000000, trade_value: 3000000000 },
    { date: '2023-10-27', stock_code: '2454', name: '聯發科', trade_volume: 5000000, trade_value: 4000000000 },
    { date: '2023-10-27', stock_code: '2382', name: '廣達', trade_volume: 15000000, trade_value: 3500000000 },
    { date: '2023-10-27', stock_code: '3231', name: '緯創', trade_volume: 20000000, trade_value: 2000000000 },
    { date: '2023-10-27', stock_code: '3035', name: '智原', trade_volume: 8000000, trade_value: 2500000000 },
    { date: '2023-10-27', stock_code: '3037', name: '欣興', trade_volume: 12000000, trade_value: 1800000000 },
    { date: '2023-10-27', stock_code: '2303', name: '聯電', trade_volume: 40000000, trade_value: 1900000000 },
    { date: '2023-10-27', stock_code: '2603', name: '長榮', trade_volume: 10000000, trade_value: 1200000000 },
    { date: '2023-10-27', stock_code: '2609', name: '陽明', trade_volume: 9000000, trade_value: 800000000 }
];

db.serialize(() => {
    db.run("DELETE FROM transactions", (err) => {
        if (err) console.error("Error clearing table", err);
        else console.log("Table cleared");
    });

    const stmt = db.prepare("INSERT INTO transactions (date, stock_code, name, trade_volume, trade_value) VALUES (?, ?, ?, ?, ?)");

    mockData.forEach((row) => {
        stmt.run(row.date, row.stock_code, row.name, row.trade_volume, row.trade_value);
    });

    stmt.finalize();
    console.log('Mock data seeded.');
});

db.close();
