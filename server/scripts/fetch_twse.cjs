const axios = require('axios');
const db = require('../db_adapter.cjs');

// CLI args for date: node fetch_twse.cjs 2025-12-30
// CLI args for date: node fetch_twse.cjs 2025-12-30
const args = process.argv.slice(2);

// Calculate "Today" in Taipei Time (UTC+8)
// This ensures that even if running on a UTC machine, we get the correct Calendar Day in Taiwan.
const getTaipeiDate = () => {
    const d = new Date();
    // Taiwan is UTC+8
    // If it's 07:00 UTC (15:00 Taipei), d is 07:00 UTC.
    // We want the date component of Taipei time.
    // Using a simple offset method:
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000); // UTC time in ms
    const taipeiOffset = 8 * 60 * 60 * 1000;
    return new Date(utc + taipeiOffset);
};

const now = getTaipeiDate();
// Ensure we don't subtract a day anymore. 
// We want "Today" because the script runs at 15:00 PM on trading day.

const inputDate = args[0] ? new Date(args[0]) : now;

// Format dates
const year = inputDate.getFullYear();
const month = String(inputDate.getMonth() + 1).padStart(2, '0');
const day = String(inputDate.getDate()).padStart(2, '0');

const dateStrTWSE = `${year}${month}${day}`;
const minguoYear = year - 1911;
const dateStrTPEx = `${minguoYear}/${month}/${day}`;
const dbDate = `${year}-${month}-${day}`;

const fetchStockData = async () => {
    console.log(`Fetch Target: ${dbDate} (TWSE: ${dateStrTWSE}, TPEx: ${dateStrTPEx})`);

    let allTransactions = [];

    // --- 0. Fetch TWSE Company Info (for Shares Outstanding) ---
    // API: https://openapi.twse.com.tw/v1/opendata/t187ap03_L
    let twseSharesMap = {};
    try {
        console.log("[Info] Fetching TWSE Shares Outstanding...");
        const resInfo = await axios.get("https://openapi.twse.com.tw/v1/opendata/t187ap03_L");
        if (Array.isArray(resInfo.data)) {
            resInfo.data.forEach(info => {
                const code = info.公司代號;
                const capital = parseInt(info.實收資本額 || "0", 10);
                const parValueStr = info.普通股每股面額 || "10";
                // Simple parsing for par value, usually "新台幣 10.0000元" -> 10. Default to 10 if failed.
                let parValue = 10;
                const match = parValueStr.match(/(\d+(\.\d+)?)/);
                if (match) parValue = parseFloat(match[1]);

                if (capital > 0) {
                    // Shares = Capital / ParValue
                    const shares = Math.floor(capital / parValue);
                    twseSharesMap[code] = shares;
                }
            });
        }
        console.log(`[Info] Loaded shares info for ${Object.keys(twseSharesMap).length} companies.`);
    } catch (e) {
        console.error("[Warning] Failed to fetch TWSE shares info:", e.message);
    }

    // --- 1. Fetch TWSE (Listed) ---
    try {
        const urlTWSE = `https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date=${dateStrTWSE}&type=ALLBUT0999`;
        console.log(`[TWSE] GET ${urlTWSE}`);

        const res = await axios.get(urlTWSE, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = res.data;

        if (data.stat === 'OK') {
            let table = null;
            if (data.tables) {
                table = data.tables.find(t => t.fields && t.fields.includes('證券代號') && t.fields.includes('收盤價'));
            } else if (data.data9) {
                table = { fields: data.fields9, data: data.data9 };
            }

            if (table) {
                // Fields: "證券代號", "證券名稱", "成交股數", "成交筆數", "成交金額", "開盤價", "最高價", "最低價", "收盤價", "漲跌(+/-)", "漲跌價差", ...
                const idxCode = table.fields.indexOf('證券代號');
                const idxName = table.fields.indexOf('證券名稱');
                const idxVol = table.fields.indexOf('成交股數');
                const idxOpen = table.fields.indexOf('開盤價');
                const idxHigh = table.fields.indexOf('最高價');
                const idxLow = table.fields.indexOf('最低價');
                const idxClose = table.fields.indexOf('收盤價');
                const idxSign = table.fields.indexOf('漲跌(+/-)'); // Contains <p ...>+</p> sometimes
                const idxDiff = table.fields.indexOf('漲跌價差');

                table.data.forEach(item => {
                    const code = item[idxCode];
                    if (code.length === 4) {
                        const vol = parseInt(item[idxVol].replace(/,/g, ''), 10);
                        const parsePrice = (v) => (!v || v.includes('--')) ? 0 : parseFloat(v.replace(/,/g, ''));
                        const close = parsePrice(item[idxClose]);

                        // Parse Change
                        let change = 0;
                        if (idxDiff !== -1 && idxSign !== -1) {
                            const diff = parseFloat(item[idxDiff].replace(/,/g, ''));
                            const signStr = item[idxSign];
                            // Sign might be formatted HTML with color, check for '-'
                            const isNegative = signStr.includes('-') || signStr.includes('green');
                            change = isNegative ? -diff : diff;
                        }

                        // Parse Change Percent
                        // Formula: change / (close - change) * 100
                        let changePercent = 0;
                        if (close > 0) {
                            const prevClose = close - change;
                            if (prevClose > 0) {
                                changePercent = (change / prevClose) * 100;
                            }
                        }

                        // Turnover Rate Calculation
                        let turnoverRate = 0;
                        let shares = twseSharesMap[code] || 0;
                        // Determine shares if invalid?
                        if (shares > 0) {
                            turnoverRate = (vol / shares) * 100;
                        }

                        allTransactions.push({
                            market: 'TWSE',
                            date: dbDate,
                            code: code,
                            name: item[idxName],
                            vol: vol,
                            val: vol * close,
                            open: parsePrice(item[idxOpen]),
                            high: parsePrice(item[idxHigh]),
                            low: parsePrice(item[idxLow]),
                            close: close,
                            change: change,
                            change_percent: changePercent.toFixed(2),
                            turnover_rate: parseFloat(turnoverRate.toFixed(2)),
                            shares_outstanding: shares
                        });
                    }
                });
                console.log(`[TWSE] Parsed ${allTransactions.length} records.`);
            }
        } else {
            console.log(`[TWSE] Stat: ${data.stat}`);
        }
    } catch (e) {
        console.error(`[TWSE] Error: ${e.message}`);
    }

    // --- 2. Fetch TPEx (OTC) ---
    try {
        const urlTPEx = `https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date=${dateStrTPEx}&id=&response=json`;
        console.log(`[TPEx] GET ${urlTPEx}`);

        const res = await axios.get(urlTPEx, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110' }
        });

        let data = res.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { }
        }

        let aaData = null;
        if (data.tables) {
            const table = data.tables.find(t => t.fields && t.fields.includes('代號') && t.fields.includes('收盤'));
            if (table) aaData = table.data;
        } else if (data.aaData) {
            aaData = data.aaData;
        }

        if (aaData && aaData.length > 0) {
            let tpexCount = 0;
            aaData.forEach(item => {
                const code = item[0];
                const name = item[1];

                if (code.length === 4) {
                    const parseVal = (v) => (!v || v === '---' || v === '--') ? 0 : parseFloat(String(v).replace(/,/g, ''));

                    const close = parseVal(item[2]);
                    const changeStr = String(item[3]); // Usually "+0.35" or "-0.10"
                    const change = parseFloat(changeStr.replace(/,/g, ''));

                    const open = parseVal(item[4]);
                    const high = parseVal(item[5]);
                    const low = parseVal(item[6]);
                    const vol = parseInt(item[8].replace(/,/g, ''), 10);

                    // TPEx has shares at column 15 (index 15) usually
                    // fields: 代號, 名稱, 收盤, 漲跌, 開盤, 最高, 最低, 均價, 成交股數, 成交金額, 成交筆數, 最後買價, 最後買量, 最後賣價, 最後賣量, 發行股數, 次日漲停價, ...
                    // Let's assume index 15 is shares.
                    const shares = item[15] ? parseInt(item[15].replace(/,/g, ''), 10) : 0;

                    let changePercent = 0;
                    if (close > 0) {
                        const prevClose = close - change;
                        if (prevClose > 0) {
                            changePercent = (change / prevClose) * 100;
                        }
                    }

                    // Calc turnover rate
                    let turnoverRate = 0;
                    if (shares > 0) {
                        turnoverRate = (vol / shares) * 100;
                    }

                    allTransactions.push({
                        market: 'TPEx',
                        date: dbDate,
                        code: code,
                        name: name,
                        vol: vol,
                        val: vol * close,
                        open: open,
                        high: high,
                        low: low,
                        close: close,
                        change: change,
                        change_percent: changePercent.toFixed(2),
                        turnover_rate: parseFloat(turnoverRate.toFixed(2)),
                        shares_outstanding: shares
                    });
                    tpexCount++;
                }
            });
            console.log(`[TPEx] Parsed ${tpexCount} records.`);
        } else {
            console.log(`[TPEx] No data found.`);
        }

    } catch (e) {
        console.error(`[TPEx] Error: ${e.message}`);
    }

    // --- 3. Save All to DB ---
    const finalData = allTransactions
        .filter(item => !isNaN(item.val) && item.val > 0)
        .map(item => ({
            ...item,
            vol: Math.round(item.vol),
            val: Math.round(item.val)
        }));
    console.log(`Saving ${finalData.length} records to DB...`);

    try {
        await db.bulkInsert(finalData);
        console.log("DB Update Complete.");
    } catch (err) {
        console.error("DB Insert Error:", err);
        process.exit(1);
    } finally {
        db.close();
    }
};

fetchStockData();
