const { exec } = require('child_process');
const path = require('path');

// Generating dates from Dec 1, 2025 to Dec 30, 2025 (Dec 31 is already fetched)
const dates = [];
const startDate = new Date(2025, 11, 1); // Dec 1
const endDate = new Date(2025, 11, 30); // Dec 30

for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
    // Skip weekends usually? TWSE returns empty or error for weekends. 
    // Just run it, the script handles "No data" gracefully?
    // Actually the APIs might fail hard or return stat != OK. The script logs errors but continues?
    // Let's add weekends check to save time.
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
        dates.push(new Date(d));
    }
}

console.log(`Scheduled ${dates.length} days to fetch.`);

const runNext = (index) => {
    if (index >= dates.length) {
        console.log("All done!");
        return;
    }

    const d = dates[index];
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    console.log(`[${index + 1}/${dates.length}] Fetching ${dateStr}...`);

    exec(`node server/scripts/fetch_twse.cjs ${dateStr}`, { cwd: path.resolve(__dirname, '../../') }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error fetching ${dateStr}:`, error.message);
        } else {
            // console.log(stdout); // Verbose
        }

        // Wait 3 seconds to be polite to API
        setTimeout(() => runNext(index + 1), 3000);
    });
};

runNext(0);
