const axios = require('axios');

const debugTPEx = async () => {
    const url = `https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?l=zh-tw&d=114/12/31`;
    console.log(`Fetching ${url}...`);

    try {
        const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        let data = res.data;
        if (typeof data === 'string') data = JSON.parse(data);

        if (data.tables) {
            console.log(`Found ${data.tables.length} tables.`);
            data.tables.forEach((t, i) => {
                console.log(`Table ${i}: ${t.title} (${t.data.length} rows)`);
                // Check for 8299 in this table
                const found = t.data.find(row => row[0] === '8299');
                if (found) {
                    console.log(`  -> Found 8299 in Table ${i}:`, found);
                } else {
                    console.log(`  -> 8299 NOT in Table ${i}`);
                }
            });
        } else if (data.aaData) {
            console.log("Found aaData (Old format?)");
            const found = data.aaData.find(row => row[0] === '8299');
            if (found) console.log("Found 8299 in aaData:", found);
        } else {
            console.log("No tables or aaData found.");
            console.log("Keys:", Object.keys(data));
        }

    } catch (e) {
        console.error(e);
    }
};

debugTPEx();
