console.log('--- Startup Diagnostics ---');
console.log('CWD:', process.cwd());
console.log('DATABASE_URL exists in env:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
    console.log('DATABASE_URL is set.');
}
console.log('---------------------------');

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const db = require('./db_adapter.cjs');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 3. Security: Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { message: "Too many requests, please try again later." }
});

// Apply rate limiting to all requests that match /api/
app.use('/api/', apiLimiter);

// Load futures list
const futuresPath = path.resolve(__dirname, 'data/futures.json');
let futuresSet = new Set();
try {
    if (fs.existsSync(futuresPath)) {
        const raw = fs.readFileSync(futuresPath, 'utf-8');
        const arr = JSON.parse(raw);
        futuresSet = new Set(arr);
        console.log(`[Init] Loaded ${futuresSet.size} futures targets.`);
    } else {
        console.log("[Init] Futures list not found at", futuresPath);
    }
} catch (e) {
    console.error("[Init] Failed to load futures list:", e);
}

// Helper: Calculate date N days ago
const getDaysAgo = (baseDateStr, days) => {
    const d = new Date(baseDateStr);
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
};

// API: Get Top 20 Transactions by Value for the latest available date
// Helper to extract last history
const getStockHistory = async (codes, latestDate) => {
    if (codes.length === 0) return [];

    // Calculate cutoff date in JS to avoid DB-specific SQL (SQLite vs PG)
    // Fetch 90 days to ensure enough data for 60-day trend
    const cutoffDate = getDaysAgo(latestDate, 90);

    const placeholders = codes.map(() => '?').join(',');
    const sql = `
        SELECT stock_code, date, open_price, high_price, low_price, close_price 
        FROM transactions 
        WHERE stock_code IN (${placeholders}) 
        AND date >= ?
        AND date <= ?
        ORDER BY date ASC
    `;

    const params = [...codes, cutoffDate, latestDate];
    return await db.query(sql, params);
};

// API: Get Top Transactions by Value with History
app.get('/api/top10', async (req, res) => {
    const _start = Date.now();
    const market = req.query.market; // 'TWSE' or 'TPEx'

    // 5. Security: Input Validation
    if (market && !['TWSE', 'TPEx'].includes(market)) {
        return res.status(400).json({ error: 'Invalid market type. Must be TWSE or TPEx.' });
    }

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
        const _hStart = Date.now();
        const historyRows = await getStockHistory(uniqueCodes, latestDate);
        console.log(`[Perf] History Fetch: ${Date.now() - _hStart}ms`);

        // Optimize: Group history by stock_code to avoid O(N*M) filtering
        const historyMap = new Map();
        historyRows.forEach(h => {
            if (!historyMap.has(h.stock_code)) {
                historyMap.set(h.stock_code, []);
            }
            historyMap.get(h.stock_code).push(h);
        });

        // 4. Transform data
        const stocksWithHistory = rows.map(stock => {
            const stockHistory = historyMap.get(stock.stock_code) || [];

            // Kline: Last 20 days
            const kline = stockHistory.slice(-20).map(h => ({
                date: h.date.slice(5).replace('-', '/'),
                open: h.open_price,
                high: h.high_price,
                low: h.low_price,
                close: h.close_price
            }));

            // Trend: Last 60 days
            const trend = stockHistory.slice(-60).map(h => ({
                date: h.date.slice(5).replace('-', '/'),
                price: h.close_price
            }));

            // Calculate 5-Day Change
            let change5d = null;
            if (stockHistory.length >= 6) {
                const current = stockHistory[stockHistory.length - 1].close_price;
                const prev5 = stockHistory[stockHistory.length - 1 - 5].close_price;
                if (prev5 !== 0) {
                    change5d = ((current - prev5) / prev5) * 100;
                }
            }

            // Calculate 20-Day MA Bias
            let bias20 = null;
            if (stockHistory.length >= 20) {
                const last20 = stockHistory.slice(-20);
                const sum20 = last20.reduce((acc, curr) => acc + curr.close_price, 0);
                const ma20 = sum20 / 20;
                const current = stockHistory[stockHistory.length - 1].close_price;
                if (ma20 !== 0) {
                    bias20 = ((current - ma20) / ma20) * 100;
                }
            }

            return {
                ...stock,
                change_5d: change5d,
                bias_20: bias20,
                kline,
                trend,
                has_futures: futuresSet.has(stock.stock_code)
            };
        });

        console.log(`[Perf] API Top10: ${Date.now() - _start}ms`);
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
    // 1. Security: Authentication
    const apiKey = req.headers['x-api-key'];
    if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(403).json({ error: 'Forbidden: Invalid or missing API Key' });
    }

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
