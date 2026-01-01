const express = require('express');
const cors = require('cors');
const db = require('./db.cjs');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// API: Get Top 20 Transactions by Value for the latest available date
// Helper to extract last 30 days history
const getStockHistory = (codes) => {
    return new Promise((resolve, reject) => {
        if (codes.length === 0) {
            resolve([]);
            return;
        }
        const placeholders = codes.map(() => '?').join(',');
        // Fetch last 60 records per stock (approx 2-3 months) to ensure 30 trading days
        const sql = `
            SELECT stock_code, date, open_price, high_price, low_price, close_price 
            FROM transactions 
            WHERE stock_code IN (${placeholders}) 
            AND date >= date((SELECT MAX(date) FROM transactions), '-60 days')
            ORDER BY date ASC
        `;
        db.all(sql, codes, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// API: Get Top Transactions by Value with History
app.get('/api/top10', (req, res) => {
    const market = req.query.market; // 'TWSE' or 'TPEx'

    let marketFilter = "";
    let params = [];

    if (market) {
        marketFilter = "AND market = ?";
        params.push(market);
    }

    const sql = `
    SELECT * FROM transactions 
    WHERE date = (SELECT MAX(date) FROM transactions)
    ${marketFilter}
    ORDER BY trade_value DESC 
    LIMIT 100
  `;

    db.all(sql, params, async (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }

        if (!rows || rows.length === 0) {
            res.json({ message: "success", data: [] });
            return;
        }

        try {
            const codes = rows.map(r => r.stock_code);
            // Deduplicate codes just in case
            const uniqueCodes = [...new Set(codes)];

            const historyRows = await getStockHistory(uniqueCodes);

            const stocksWithHistory = rows.map(stock => {
                const stockHistory = historyRows.filter(h => h.stock_code === stock.stock_code);

                // Kline: Last 10 days
                const kline = stockHistory.slice(-10).map(h => ({
                    date: h.date.slice(5).replace('-', '/'),
                    open: h.open_price,
                    high: h.high_price,
                    low: h.low_price,
                    close: h.close_price
                }));

                // Trend: Last 30 days
                const trend = stockHistory.slice(-30).map(h => ({
                    date: h.date.slice(5).replace('-', '/'),
                    price: h.close_price
                }));

                return {
                    ...stock,
                    kline,
                    trend
                };
            });

            res.json({
                message: "success",
                data: stocksWithHistory
            });
        } catch (histErr) {
            console.error("History fetch error:", histErr);
            // Fallback
            res.json({ message: "success", data: rows });
        }
    });
});

// API: Trigger Daily Update Manually
app.post('/api/refresh', (req, res) => {
    console.log("Manual update triggered...");
    exec('node server/scripts/fetch_twse.cjs', { cwd: path.resolve(__dirname, '..') }, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).json({ error: error.message });
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
        res.json({ message: "Update completed", log: stdout });
    });
});

// Simple Daily Scheduler
setInterval(() => {
    const now = new Date();
    // Example: Run at 15:00 (3 PM)
    if (now.getHours() === 15 && now.getMinutes() === 0) {
        console.log("Auto-updating data at 15:00...");
        exec('node server/scripts/fetch_twse.cjs', { cwd: path.resolve(__dirname, '..') }, (err) => {
            if (err) console.error("Auto-update failed", err);
            else console.log("Auto-update finished");
        });
    }
}, 60000);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
