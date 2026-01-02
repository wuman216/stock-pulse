const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

// Standardized DB Interface (Adapter Pattern)
class DBAdapter {
    constructor() {
        this.type = process.env.DATABASE_URL ? 'postgres' : 'sqlite';
        console.log(`[DBAdapter] Detected Database Type: ${this.type}`);
        if (this.type === 'sqlite') {
            console.log('[DBAdapter] Fallback to SQLite because DATABASE_URL is missing.');
        } else {
            console.log('[DBAdapter] Using PostgreSQL (DATABASE_URL is set).');
        }

        if (this.type === 'sqlite') {
            const dbPath = path.resolve(__dirname, 'transactions.db');
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) console.error('SQLite connection error:', err);
                else console.log('Connected to SQLite.');
            });
            this.initSQLite();
            this.initPromise = Promise.resolve();
        } else {
            this.client = new Client({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });
            this.initPromise = this.connectAndInitPG();
        }
    }

    async connectAndInitPG() {
        try {
            await this.client.connect();
            console.log('Connected to PostgreSQL.');
            await this.initPG();
        } catch (e) {
            console.error("PG Connection/Init Error:", e);
            throw e;
        }
    }

    initSQLite() {
        this.db.serialize(() => {
            this.db.run(`CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                stock_code TEXT NOT NULL,
                name TEXT NOT NULL,
                market TEXT,
                open_price REAL,
                high_price REAL,
                low_price REAL,
                close_price REAL,
                trade_volume INTEGER,
                trade_value INTEGER,
                change REAL,
                change_percent REAL,
                turnover_rate REAL, 
                shares_outstanding INTEGER,
                UNIQUE(date, stock_code)
            )`);
            // Attempt to add columns for existing tables (ignore errors if exist)
            this.db.run(`ALTER TABLE transactions ADD COLUMN turnover_rate REAL`, (err) => { });
            this.db.run(`ALTER TABLE transactions ADD COLUMN shares_outstanding INTEGER`, (err) => { });
        });
    }

    async initPG() {
        const sql = `
            CREATE TABLE IF NOT EXISTS transactions(
                id SERIAL PRIMARY KEY,
                date TEXT NOT NULL,
                stock_code TEXT NOT NULL,
                name TEXT NOT NULL,
                market TEXT,
                open_price REAL,
                high_price REAL,
                low_price REAL,
                close_price REAL,
                trade_volume BIGINT,
                trade_value BIGINT,
                change REAL,
                change_percent REAL,
                turnover_rate REAL,
                shares_outstanding BIGINT,
                UNIQUE(date, stock_code)
            );
        `;
        try {
            await this.client.query(sql);
            // Attempt migration for existing tables
            await this.client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS turnover_rate REAL');
            await this.client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shares_outstanding BIGINT');
            await this.client.query('CREATE INDEX IF NOT EXISTS idx_stock_date ON transactions (stock_code, date)');
            await this.client.query('CREATE INDEX IF NOT EXISTS idx_date_value ON transactions (date, trade_value DESC)');
            console.log("PG Table 'transactions' ensured/migrated + Indices created.");
        } catch (e) {
            console.error("PG Init Error:", e);
            throw e;
        }
    }

    // Generic Query method (returns rows)
    async query(sql, params = []) {
        await this.initPromise;

        return new Promise((resolve, reject) => {
            if (this.type === 'sqlite') {
                // Determine if SELECT or other
                const cleanSql = sql.trim().toUpperCase();
                if (cleanSql.startsWith('SELECT')) {
                    this.db.all(sql, params, (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                } else {
                    this.db.run(sql, params, function (err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes, lastID: this.lastID });
                    });
                }
            } else {
                // PostgreSQL parameter syntax is $1, $2, not ?
                let paramIndex = 1;
                const parseSql = sql.replace(/\?/g, () => `$${paramIndex++} `);
                this.client.query(parseSql, params).then(res => {
                    resolve(res.rows || { changes: res.rowCount });
                }).catch(reject);
            }
        });
    }

    // Support for bulk insert transaction
    async bulkInsert(data) {
        await this.initPromise;

        // data: array of { date, code, name, market, open, high, low, close, vol, val, change, change_percent }
        if (this.type === 'sqlite') {
            return new Promise((resolve, reject) => {
                this.db.serialize(() => {
                    this.db.run("BEGIN TRANSACTION");
                    const stmt = this.db.prepare(`
                        INSERT OR REPLACE INTO transactions
                (date, stock_code, name, market, open_price, high_price, low_price, close_price, trade_volume, trade_value, change, change_percent, turnover_rate, shares_outstanding)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                    data.forEach(row => {
                        stmt.run(row.date, row.code, row.name, row.market, row.open, row.high, row.low, row.close, row.vol, row.val, row.change, row.change_percent, row.turnover_rate || 0, row.shares_outstanding || 0);
                    });

                    stmt.finalize();
                    this.db.run("COMMIT", (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
        } else {
            // Postgres bulk insert
            try {
                await this.client.query('BEGIN');
                const sql = `
                    INSERT INTO transactions
                (date, stock_code, name, market, open_price, high_price, low_price, close_price, trade_volume, trade_value, change, change_percent, turnover_rate, shares_outstanding)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    ON CONFLICT(date, stock_code) DO UPDATE SET
            name = EXCLUDED.name,
                market = EXCLUDED.market,
                open_price = EXCLUDED.open_price,
                high_price = EXCLUDED.high_price,
                low_price = EXCLUDED.low_price,
                close_price = EXCLUDED.close_price,
                trade_volume = EXCLUDED.trade_volume,
                trade_value = EXCLUDED.trade_value,
                change = EXCLUDED.change,
                change_percent = EXCLUDED.change_percent,
                turnover_rate = EXCLUDED.turnover_rate,
                shares_outstanding = EXCLUDED.shares_outstanding;
            `;

                for (const row of data) {
                    await this.client.query(sql, [
                        row.date, row.code, row.name, row.market,
                        row.open, row.high, row.low, row.close,
                        row.vol, row.val, row.change, row.change_percent,
                        row.turnover_rate || 0, row.shares_outstanding || 0
                    ]);
                }
                await this.client.query('COMMIT');
            } catch (e) {
                await this.client.query('ROLLBACK');
                throw e;
            }
        }
    }

    close() {
        if (this.db) this.db.close();
        if (this.client) this.client.end();
    }
}

const dbAdapter = new DBAdapter();
module.exports = dbAdapter;
