console.log('--- Startup Diagnostics ---');
console.log('CWD:', process.cwd());
console.log('DATABASE_URL exists in env:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
    console.log('DATABASE_URL prefix:', process.env.DATABASE_URL.substring(0, 15) + '...');
}
console.log('---------------------------');

const express = require('express');
const cors = require('cors');
const db = require('./db_adapter.cjs');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper: Calculate date N days ago
const getDaysAgo = (baseDateStr, days) => {
    const d = new Date(baseDateStr);
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
};

// API: Get Top 20 Transactions by Value for the latest available date
// Helper to extract last 30 days history
const getStockHistory = async (codes, latestDate) => {
    if (codes.length === 0) return [];

    // Calculate cutoff date in JS to avoid DB-specific SQL (SQLite vs PG)
    const cutoffDate = getDaysAgo(latestDate, 60);

    const placeholders = codes.map(() => '?').join(',');
    // Fetch last 60 records per stock to ensure enough trading days
    const sql = `
        SELECT stock_code, date, open_price, high_price, low_price, close_price 
        FROM transactions 
        WHERE stock_code IN (${placeholders}) 
        AND date >= ?
        ORDER BY date ASC
    `;

    const params = [...codes, cutoffDate];
    return await db.query(sql, params);
};

// API: Get Top Transactions by Value with History
app.get('/api/top10', async (req, res) => {
    const market = req.query.market; // 'TWSE' or 'TPEx'

    try {
        let latestDate = req.query.date;

        if (!latestDate) {
            // 1. Get latest date if not provided
            const dateRes = await db.query("SELECT MAX(date) as max_date FROM transactions");
            if (!dateRes || dateRes.length === 0 || !dateRes[0].max_date) {
                return res.json({ message: "success", data: [] });
            }
            latestDate = dateRes[0].max_date;
        }

        // 2. Build query
        let marketFilter = "";
        let params = [latestDate];

        if (market) {
            marketFilter = "AND market = ?";
            params.push(market);
        }

        const sql = `
            SELECT * FROM transactions 
            WHERE date = ?
            ${marketFilter}
            ORDER BY trade_value DESC 
            LIMIT 100
        `;

        const rows = await db.query(sql, params);

        if (!rows || rows.length === 0) {
            return res.json({ message: "success", data: [] });
        }

        const codes = rows.map(r => r.stock_code);
        const uniqueCodes = [...new Set(codes)];

        // 3. Fetch History
        const historyRows = await getStockHistory(uniqueCodes, latestDate);

        // 4. Transform data
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

    } catch (err) {
        console.error("API Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get all distinct dates available in DB
app.get('/api/available-dates', async (req, res) => {
    try {
        const rows = await db.query("SELECT DISTINCT date FROM transactions ORDER BY date DESC");
        const dates = rows.map(r => r.date);
        res.json({ message: "success", data: dates });
    } catch (err) {
        console.error("Available Dates Error:", err);
        res.status(500).json({ error: err.message });
    }
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

// Serve static files from the React app
const distPath = path.resolve(__dirname, '../dist');
console.log('Serving static files from:', distPath);

// Check if dist exists (debugging for Render)
const fs = require('fs');
if (fs.existsSync(distPath)) {
    console.log('Dist directory exists.');
    console.log('Contents:', fs.readdirSync(distPath));
} else {
    console.error('Dist directory NOT found at:', distPath);
}

app.use(express.static(distPath));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
