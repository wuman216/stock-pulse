const db = require('../db_adapter.cjs');

async function verify() {
    // 2025-11-28 is what we just backfilled
    const date = '2025-11-28';
    console.log(`Verifying counts for ${date}...`);
    try {
        // Query counts grouped by market
        // Note: db_adapter automatically handles ? -> $1 replacement for PG
        const rows = await db.query(`
            SELECT market, count(*) as count 
            FROM transactions 
            WHERE date = ?
            GROUP BY market
        `, [date]);

        console.log('Result:', JSON.stringify(rows, null, 2));

        // Simple check
        let twseCount = 0;
        let tpexCount = 0;
        if (Array.isArray(rows)) {
            rows.forEach(r => {
                const count = parseInt(r.count, 10);
                if (r.market === 'TWSE') twseCount = count;
                if (r.market === 'TPEx') tpexCount = count;
            });
        }

        console.log(`TWSE Count: ${twseCount} (> 500 expected)`);
        console.log(`TPEx Count: ${tpexCount} (> 500 expected)`);

        if (twseCount > 500 && tpexCount > 500) {
            console.log("Verification PASSED ✅");
        } else {
            console.log("Verification FAILED ❌");
        }

    } catch (e) {
        console.error("Verification Error:", e);
    } finally {
        db.close();
    }
}

verify();
