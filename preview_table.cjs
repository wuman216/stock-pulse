const db = require('./server/db_adapter.cjs');

async function main() {
    const date = '2026-01-02';
    console.log(`Generating preview for date: ${date}\n`);

    // Helper to get Top Stocks
    async function getTopStocks(market) {
        // 1. Get Top 10 by Value for date
        const sql = `
            SELECT * FROM transactions 
            WHERE date = $1 AND market = $2
            ORDER BY trade_value DESC 
            LIMIT 10
        `;
        const rows = await db.query(sql, [date, market]);
        return rows || [];
    }

    // Helper to get History and metrics
    async function enrichWithMetrics(stocks) {
        // Get history for these stocks
        const codes = stocks.map(s => s.code);
        if (codes.length === 0) return [];

        // Mocking getStockHistory logic roughly or just simplified query
        // We need history <= date for these codes
        const historySql = `
            SELECT * FROM transactions
            WHERE stock_code = ANY($1) AND date <= $2
            ORDER BY date ASC
        `;
        const historyRows = await db.query(historySql, [codes, date]);

        return stocks.map(stock => {
            const stockHistory = historyRows.filter(h => h.stock_code === stock.code);

            // 5-Day Change
            let change5d = "N/A";
            if (stockHistory.length >= 6) {
                const current = stockHistory[stockHistory.length - 1].close_price;
                const prev5 = stockHistory[stockHistory.length - 1 - 5].close_price;
                if (prev5 !== 0) {
                    change5d = (((current - prev5) / prev5) * 100).toFixed(1) + "%";
                }
            }

            // 20-Day Bias
            let bias20 = "N/A";
            if (stockHistory.length >= 20) {
                const last20 = stockHistory.slice(-20);
                const sum20 = last20.reduce((acc, curr) => acc + curr.close_price, 0);
                const ma20 = sum20 / 20;
                const current = stockHistory[stockHistory.length - 1].close_price;
                if (ma20 !== 0) {
                    bias20 = (((current - ma20) / ma20) * 100).toFixed(1) + "%";
                }
            }

            return {
                rank: 0, // Fill later
                code: stock.code,
                name: stock.name,
                price: stock.close_price,
                change: stock.change,
                changePercent: stock.change_percent,
                val: (stock.trade_value / 100000000).toFixed(2), // 億
                turnover: stock.turnover_rate,
                change5d,
                bias20
            };
        });
    }

    try {
        const twse = await getTopStocks('TWSE');
        const enrichedTwse = await enrichWithMetrics(twse);

        const tpex = await getTopStocks('TPEx');
        const enrichedTpex = await enrichWithMetrics(tpex);

        console.log("市場: 上市 (TWSE)");
        printTable(enrichedTwse);
        console.log("\n市場: 上櫃 (TPEx)");
        printTable(enrichedTpex);

    } catch (err) {
        console.error(err);
    } finally {
        // Need to close DB manually? DBAdapter might not export close method directly cleanly based on my memory, 
        // but let's try process.exit
        process.exit(0);
    }
}

function printTable(data) {
    // Header
    const headers = ["排名", "代號", "名稱", "收盤價", "漲跌", "幅度%", "成交值(億)", "週轉率%", "5日漲幅", "20日乖離"];
    console.log(headers.join("\t"));

    data.forEach((row, i) => {
        const line = [
            i + 1,
            row.code,
            row.name,
            row.price,
            row.change,
            row.changePercent + "%",
            row.val,
            row.turnover + "%",
            row.change5d,
            row.bias20
        ];
        console.log(line.join("\t"));
    });
}

main();
