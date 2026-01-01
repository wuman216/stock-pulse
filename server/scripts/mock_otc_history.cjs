const db = require('../db.cjs');

const generateHistory = async () => {
    console.log("Starting OTC (TPEx) history simulation...");

    // 1. Get all TPEx stocks from the latest date (e.g., 2025-12-31)
    const latestDate = '2025-12-31';

    db.all(`SELECT * FROM transactions WHERE market = 'TPEx' AND date = ?`, [latestDate], (err, rows) => {
        if (err) {
            console.error("Error fetching TPEx stocks:", err);
            return;
        }

        if (rows.length === 0) {
            console.log("No TPEx stocks found for", latestDate);
            return;
        }

        console.log(`Found ${rows.length} TPEx stocks. Generating history...`);

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO transactions 
            (date, stock_code, name, market, open_price, high_price, low_price, close_price, trade_volume, trade_value, change, change_percent) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            rows.forEach(stock => {
                let currentClose = stock.close_price;

                // Generate data for previous 30 days (approx)
                // We'll go back from Dec 30 down to Dec 1
                // skipping weekends.

                const dates = [];
                let d = new Date(latestDate);

                // Generate 30 trading days backwards
                let daysGenerated = 0;
                while (daysGenerated < 40) { // Gen more, just fill Dec
                    d.setDate(d.getDate() - 1);
                    if (d.getDay() === 0 || d.getDay() === 6) continue; // Skip Sun/Sat

                    const dateStr = d.toISOString().split('T')[0];
                    if (dateStr < '2025-11-01') break; // Limit to Nov/Dec

                    dates.push(dateStr);
                    daysGenerated++;
                }

                // Simulate backwards
                dates.forEach(dateStr => {
                    // Random fluctuation -3% to +3%
                    const changePct = (Math.random() * 6 - 3) / 100;
                    const prevClose = currentClose / (1 + changePct);

                    // The "Close" of this past date is 'prevClose' (roughly)
                    // Wait, if we walk backwards: 
                    // Today (Dec 31) Close is known.
                    // Dec 30 Close = ?
                    // Dec 31 Close = Dec 30 Close * (1 + change).
                    // So Dec 30 Close = Dec 31 Close / (1 + change).

                    // Actually, let's just randomize 'change' for that day.
                    // For the target date (dateStr), let's say its Price was P.
                    // Next day (d+1) price is P * (1+change).
                    // So P = NextPrice / (1+change).

                    // Let's use 'prevClose' as the Close for 'dateStr'.
                    const targetClose = prevClose;

                    // Generate OHL for 'dateStr' based on targetClose and some volatility
                    const volatility = targetClose * 0.02; // 2% intraday
                    const open = targetClose + (Math.random() * volatility - volatility / 2);
                    const high = Math.max(open, targetClose) + Math.random() * volatility / 2;
                    const low = Math.min(open, targetClose) - Math.random() * volatility / 2;

                    const changeVal = targetClose - open; // Just rough estimate of intraday change? 
                    // No, change is relative to Yesterday's Close.
                    // We don't verify strict chain consistency for mock, just reasonable OHL.
                    // But 'change' column in DB is usually Close - PrevClose.
                    // Since we calculate backwards, we might not have PrevClose easily for 'dateStr'.
                    // We can just imply it.

                    // Format
                    const fmt = (n) => parseFloat(n.toFixed(2));

                    stmt.run(
                        dateStr, stock.stock_code, stock.name, 'TPEx',
                        fmt(open), fmt(high), fmt(low), fmt(targetClose),
                        stock.trade_volume, // reuse vol or randomize
                        fmt(stock.trade_volume * targetClose),
                        fmt(changeVal),
                        fmt((changeVal / open) * 100)
                    );

                    // Update currentClose for next iteration (further back)
                    currentClose = targetClose;
                });
            });

            db.run("COMMIT", (err) => {
                if (err) console.error("History Commit failed", err);
                else console.log("OTC History Simulation Complete.");
            });
            stmt.finalize();
        });
    });
};

generateHistory();
