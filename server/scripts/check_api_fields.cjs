const axios = require('axios');

const check = async () => {
    // Check TWSE
    try {
        const date = '20241230'; // A recent trading day
        const urlTWSE = `https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date=${date}&type=ALLBUT0999`;
        console.log(`Fetching TWSE: ${urlTWSE}`);
        const res = await axios.get(urlTWSE);
        const data = res.data;
        if (data.stat === 'OK') {
            // Find the main table
            const table = data.tables.find(t => t.fields && t.fields.includes('證券代號') && t.fields.includes('收盤價'));
            if (table) {
                console.log("TWSE Fields:", table.fields);
                console.log("TWSE Sample Row:", table.data[0]);
            } else {
                console.log("TWSE Main table not found");
            }
        } else {
            console.log("TWSE Error/Holiday");
        }
    } catch (e) { console.error(e.message); }

    // Check TPEx
    try {
        const date = '113/12/30'; // 2024/12/30
        const urlTPEx = `https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date=${date}&id=&response=json`;
        console.log(`Fetching TPEx: ${urlTPEx}`);
        const res = await axios.get(urlTPEx);
        let data = res.data;
        if (typeof data === 'string') try { data = JSON.parse(data); } catch { }

        let fields = null;
        let row = null;

        if (data.tables) {
            const table = data.tables.find(t => t.fields && t.fields.includes('代號'));
            fields = table.fields;
            row = table.data[0];
        } else if (data.aaData) {
            // TPEx often just sends aaData without fields in some endpoints, but let's check
            fields = "Unknown (aaData)";
            row = data.aaData[0];
        }

        console.log("TPEx Fields:", fields);
        console.log("TPEx Sample Row:", row);

    } catch (e) { console.error(e.message); }
};

check();
