const { execSync } = require('child_process');

/*
  Script to backfill stock data for October and November 2025.
  Usage: node server/scripts/backfill_oct_nov_2025.cjs
*/

// Date range: 2025-10-01 to 2025-11-30
const start = new Date('2025-10-01');
const end = new Date('2025-11-30');

let current = new Date(start);

console.log('Starting Backfill for Oct-Nov 2025...');

const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
let processed = 0;

while (current <= end) {
    // Skip weekends (0=Sun, 6=Sat)
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
        const dateStr = current.toISOString().split('T')[0]; // YYYY-MM-DD
        console.log(`[${processed}/${totalDays}] Processing Date: ${dateStr}`);

        try {
            // Execute fetch_twse.cjs synchronously
            execSync(`node server/scripts/fetch_twse.cjs ${dateStr}`, {
                stdio: 'inherit',
                env: process.env
            });

            // Wait 2 seconds between requests
            const waitTime = 2000;
            const stop = new Date().getTime() + waitTime;
            while (new Date().getTime() < stop);

        } catch (error) {
            console.error(`Failed to fetch for ${dateStr}. Continuing...`);
        }
    }

    // Next day
    current.setDate(current.getDate() + 1);
    processed++;
}

console.log('\nBackfill Complete!');
