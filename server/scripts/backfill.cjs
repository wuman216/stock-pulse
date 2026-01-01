const { execSync } = require('child_process');

/*
  Script to backfill stock data for December 2025.
  Usage: DATABASE_URL="postgresql://..." node server/scripts/backfill.cjs
*/

// Date range: 2025-12-01 to 2025-12-31
const start = new Date('2025-12-01');
const end = new Date('2025-12-31');

let current = new Date(start);

console.log('Starting Backfill for December 2025...');
console.log('Target DB:', process.env.DATABASE_URL ? 'PostgreSQL (Supabase)' : 'SQLite (Local)');

while (current <= end) {
    // Skip weekends (0=Sun, 6=Sat)
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
        const dateStr = current.toISOString().split('T')[0]; // YYYY-MM-DD
        console.log(`\n---------------------------------`);
        console.log(`Processing Date: ${dateStr}`);

        try {
            // Execute fetch_twse.cjs synchronously to avoid rate limits or DB locks
            // Pass the env vars to the child process
            execSync(`node server/scripts/fetch_twse.cjs ${dateStr}`, {
                stdio: 'inherit',
                env: process.env
            });

            // Wait 3 seconds between requests safely to respect API rate limits
            // TWSE/TPEx might block if too fast
            const waitTime = 3000;
            const stop = new Date().getTime() + waitTime;
            while (new Date().getTime() < stop);

        } catch (error) {
            console.error(`Failed to fetch for ${dateStr}. Continuing...`);
        }
    } else {
        // console.log(`Skipping Weekend: ${current.toISOString().split('T')[0]}`);
    }

    // Next day
    current.setDate(current.getDate() + 1);
}

console.log('\nBackfill Complete!');
