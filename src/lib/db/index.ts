import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import duckdb_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_worker_eh from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: duckdb_worker,
    },
    eh: {
        mainModule: duckdb_wasm_eh,
        mainWorker: duckdb_worker_eh,
    },
};


export let db: duckdb.AsyncDuckDB | null = null;
export let conn: duckdb.AsyncDuckDBConnection | null = null;

export const initDB = async () => {
    if (db) return { db, conn };

    // Select bundle based on browser support
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

    const worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger();

    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    // Try to mount OPFS for persistent storage across page loads
    try {
        await db.open({ path: 'opfs://seologanalyzer.db' });
        console.log("OPFS Persistent Storage Enabled");
    } catch (e) {
        console.warn("OPFS persistence unavailable. Using in-memory DB.", e);
    }

    conn = await db.connect();

    // Initialize Tables without dropping existing ones
    await conn.query(`
    CREATE TABLE IF NOT EXISTS logs (
      ip VARCHAR,
      timestamp TIMESTAMP,
      method VARCHAR,
      url VARCHAR,
      status INTEGER,
      size BIGINT,
      referrer VARCHAR,
      user_agent VARCHAR,
      bot_name VARCHAR,
      bot_type VARCHAR,
      response_time INTEGER
    );
  `);

    console.log("DuckDB initialized!");
    return { db, conn };
};

export const insertLogs = async (logs: any[]) => {
    if (!conn) throw new Error("DB Connection not ready");

    const tableName = 'temp_streamed_chunk';

    // Use fast native JSON serialization (V8 C++) rather than slow JS map/join string permutations
    const jsonStr = JSON.stringify(logs);

    await db!.registerFileText(tableName + '.json', jsonStr);

    // Insert directly from the robust read_json memory virtual file with explicit schema definition
    await conn.query(`
        INSERT INTO logs 
        SELECT *
        FROM read_json_auto('${tableName}.json', columns={
            'ip': 'VARCHAR', 
            'timestamp': 'TIMESTAMP', 
            'method': 'VARCHAR', 
            'url': 'VARCHAR', 
            'status': 'INTEGER', 
            'size': 'BIGINT', 
            'referrer': 'VARCHAR', 
            'user_agent': 'VARCHAR', 
            'bot_name': 'VARCHAR', 
            'bot_type': 'VARCHAR', 
            'response_time': 'INTEGER'
        });
    `);

    // Cleanup
    await db!.registerFileText(tableName + '.json', '');
}

// ... existing code ...

export interface LogFilter {
    startDate?: Date;
    endDate?: Date;
    statusCodes?: number[];
    methods?: string[];
    search?: string;
    limit?: number;
    offset?: number;
}

export const queryLogs = async (filter: LogFilter) => {
    if (!conn) throw new Error("DB Connection not ready");

    let query = `SELECT * FROM logs WHERE 1=1`;
    const params: any[] = [];

    if (filter.startDate) {
        query += ` AND timestamp >= ?`;
        params.push(filter.startDate.toISOString());
    }

    if (filter.endDate) {
        query += ` AND timestamp <= ?`;
        // Add one day to include the end date fully if it's just a date, but assuming exact timestamp
        params.push(filter.endDate.toISOString());
    }

    if (filter.statusCodes && filter.statusCodes.length > 0) {
        // DuckDB WASM doesn't support array params easily in prepared statements yet for IN clause
        // We construct the string safely since they are numbers
        const codes = filter.statusCodes.join(',');
        query += ` AND status IN (${codes})`;
    }

    if (filter.methods && filter.methods.length > 0) {
        const methods = filter.methods.map(m => `'${m}'`).join(',');
        query += ` AND method IN (${methods})`;
    }

    if (filter.search) {
        // rudimentary search
        query += ` AND (url ILIKE ? OR user_agent ILIKE ?)`;
        params.push(`%${filter.search}%`);
        params.push(`%${filter.search}%`);
    }

    query += ` ORDER BY timestamp DESC`;
    if (filter.limit !== -1) {
        query += ` LIMIT ? OFFSET ?`;
        params.push(filter.limit || 100);
        params.push(filter.offset || 0);
    }

    // Prepare statement
    const stmt = await conn.prepare(query);
    const result = await stmt.query(...params);

    return result.toArray().map(row => row.toJSON());
};

export const getStats = async () => {
    if (!conn) throw new Error("DB Connection not ready");
    const result = await conn.query(`
        SELECT 
            COUNT(*) as total_hits,
            COUNT(DISTINCT ip) as unique_ips,
            COUNT(DISTINCT url) as unique_urls,
            AVG(size) as avg_size
        FROM logs
    `);
    return result.toArray()[0].toJSON();
};

