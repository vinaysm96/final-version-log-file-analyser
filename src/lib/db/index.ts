import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import duckdb_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_worker_eh from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

// Multi-threaded bundle for cross-origin isolated environments
import duckdb_wasm_coi from '@duckdb/duckdb-wasm/dist/duckdb-coi.wasm?url';
import duckdb_worker_coi from '@duckdb/duckdb-wasm/dist/duckdb-browser-coi.worker.js?url';
import duckdb_worker_pthread from '@duckdb/duckdb-wasm/dist/duckdb-browser-coi.pthread.worker.js?url';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: duckdb_worker,
    },
    eh: {
        mainModule: duckdb_wasm_eh,
        mainWorker: duckdb_worker_eh,
    },
    coi: {
        mainModule: duckdb_wasm_coi,
        mainWorker: duckdb_worker_coi,
        pthreadWorker: duckdb_worker_pthread,
    },
};


export let db: duckdb.AsyncDuckDB | null = null;
export let conn: duckdb.AsyncDuckDBConnection | null = null;
export let isOPFSActive = false;

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
        isOPFSActive = true;
    } catch (e) {
        console.warn("OPFS persistence unavailable. Using in-memory DB.", e);
        isOPFSActive = false;
    }

    conn = await db.connect();

    // Initialize PRAGMAs for massive datasets to prevent V8 OOM crashes
    try {
        await conn.query(`
            SET preserve_insertion_order=false;
            SET threads=1;
        `);
        // Only set temp_directory and memory_limit if we have a real persistent OPFS file system.
        // Otherwise, setting them on an in-memory DB triggers "Cannot perform IO in in-memory database - CreateBlock!" crashes.
        if (isOPFSActive) {
             await conn.query("SET temp_directory='seologanalyzer.tmp'");
             await conn.query("SET memory_limit='2GB'");
        }
    } catch (e) {
        console.warn("Could not set advanced memory PRAGMAs, continuing anyway.", e);
    }

    // Initialize Tables without dropping existing ones
    try {
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
      response_time INTEGER,
      file_name VARCHAR
    );
    CREATE OR REPLACE VIEW active_logs AS SELECT * FROM logs;

    CREATE TABLE IF NOT EXISTS gsc_data (
      query VARCHAR,
      page VARCHAR,
      clicks INTEGER,
      impressions INTEGER,
      ctr DOUBLE,
      position DOUBLE,
      file_name VARCHAR,
      dataset_group VARCHAR
    );
  `);
    } catch (e) {
        console.error("DuckDB Boot Failure (likely OPFS Corruption/OOM):", e);
        try {
            // Attempt brutal OPFS wipe to unbrick the app
            const dir = await navigator.storage.getDirectory();
            await dir.removeEntry('seologanalyzer.db', { recursive: true });
            console.warn("OPFS File System wiped. Refresh the page to boot a fresh DB.");
        } catch (wipeErr) {
            console.error("Failed to wipe OPFS:", wipeErr);
        }
        throw e;
    }

    // Perform migrations for fields added in subsequent versions
    const newColumns = [
        { name: 'file_name', type: 'VARCHAR' },
        { name: 'bot_name', type: 'VARCHAR' },
        { name: 'bot_type', type: 'VARCHAR' },
        { name: 'response_time', type: 'INTEGER' }
    ];

    for (const col of newColumns) {
        try {
            await conn.query(`ALTER TABLE logs ADD COLUMN ${col.name} ${col.type};`);
        } catch (e) {
            // column likely exists
        }
    }

    console.log("DuckDB initialized!");
    return { db, conn };
};

export const insertLogs = async (logs: any[]) => {
    if (!conn) throw new Error("DB Connection not ready");

    const tableName = 'temp_streamed_chunk';

    // Use fast native JSON serialization (V8 C++) rather than slow JS map/join string permutations
    const jsonStr = JSON.stringify(logs);

    await db!.registerFileText(tableName + '.json', jsonStr);

    // Insert safely by explicitly mapping and casting columns to prevent missing-key JSON errors
    await conn.query(`
        INSERT INTO logs (ip, timestamp, method, url, status, size, referrer, user_agent, bot_name, bot_type, response_time, file_name)
        SELECT 
            CAST(ip AS VARCHAR),
            TRY_CAST(timestamp AS TIMESTAMP),
            CAST(method AS VARCHAR),
            CAST(url AS VARCHAR),
            TRY_CAST(status AS INTEGER),
            TRY_CAST(size AS BIGINT),
            CAST(referrer AS VARCHAR),
            CAST(user_agent AS VARCHAR),
            CAST(bot_name AS VARCHAR),
            CAST(bot_type AS VARCHAR),
            TRY_CAST(response_time AS INTEGER),
            CAST(file_name AS VARCHAR)
        FROM read_json('${tableName}.json', columns={
            'ip': 'VARCHAR',
            'timestamp': 'VARCHAR',
            'method': 'VARCHAR',
            'url': 'VARCHAR',
            'status': 'VARCHAR',
            'size': 'VARCHAR',
            'referrer': 'VARCHAR',
            'user_agent': 'VARCHAR',
            'bot_name': 'VARCHAR',
            'bot_type': 'VARCHAR',
            'response_time': 'VARCHAR',
            'file_name': 'VARCHAR'
        })
    `);

    // Cleanup
    await db!.registerFileText(tableName + '.json', '');
}

export const insertGSCLogs = async (logs: any[], datasetGroup: string) => {
    if (!conn) throw new Error("DB Connection not ready");

    const tableName = 'temp_gsc_chunk';
    
    // Add dataset group to all records
    const logsWithGroup = logs.map(l => ({...l, dataset_group: datasetGroup}));
    const jsonStr = JSON.stringify(logsWithGroup);

    await db!.registerFileText(tableName + '.json', jsonStr);

    await conn.query(`
        INSERT INTO gsc_data (query, page, clicks, impressions, ctr, position, file_name, dataset_group)
        SELECT 
            CAST(query AS VARCHAR),
            CAST(page AS VARCHAR),
            TRY_CAST(clicks AS INTEGER),
            TRY_CAST(impressions AS INTEGER),
            TRY_CAST(ctr AS DOUBLE),
            TRY_CAST(position AS DOUBLE),
            CAST(file_name AS VARCHAR),
            CAST(dataset_group AS VARCHAR)
        FROM read_json('${tableName}.json', columns={
            'query': 'VARCHAR',
            'page': 'VARCHAR',
            'clicks': 'VARCHAR',
            'impressions': 'VARCHAR',
            'ctr': 'VARCHAR',
            'position': 'VARCHAR',
            'file_name': 'VARCHAR',
            'dataset_group': 'VARCHAR'
        })
    `);

    await db!.registerFileText(tableName + '.json', '');
}

export const getUploadedFiles = async () => {
    if (!conn) return [];
    try {
        const res = await conn.query(`SELECT DISTINCT file_name FROM logs WHERE file_name IS NOT NULL;`);
        return res.toArray().map(r => r.toJSON().file_name);
    } catch {
        return [];
    }
}

export const updateActiveDataset = async (files: string[]) => {
    if (!conn) return;
    if (!files || files.length === 0) {
        await conn.query(`CREATE OR REPLACE VIEW active_logs AS SELECT * FROM logs;`);
    } else {
        const fileList = files.map(f => `'${f}'`).join(',');
        await conn.query(`CREATE OR REPLACE VIEW active_logs AS SELECT * FROM logs WHERE file_name IN (${fileList});`);
    }
}

// ... existing code ...

export interface LogFilter {
    startDate?: Date;
    endDate?: Date;
    statusCodes?: number[];
    statusRange?: [number, number]; // e.g. [400, 499] for 4xx
    methods?: string[];
    search?: string;
    limit?: number;
    offset?: number;
}

export const queryLogs = async (filter: LogFilter) => {
    if (!conn) throw new Error("DB Connection not ready");

    let query = `
        SELECT l.*
        FROM active_logs l
        WHERE 1=1
    `;
    const params: any[] = [];

    if (filter.startDate) {
        query += ` AND l.timestamp >= ?`;
        params.push(filter.startDate.toISOString());
    }

    if (filter.endDate) {
        query += ` AND l.timestamp <= ?`;
        params.push(filter.endDate.toISOString());
    }

    if (filter.statusCodes && filter.statusCodes.length > 0) {
        const codes = filter.statusCodes.join(',');
        query += ` AND l.status IN (${codes})`;
    }

    if (filter.statusRange) {
        query += ` AND l.status BETWEEN ${filter.statusRange[0]} AND ${filter.statusRange[1]}`;
    }

    if (filter.methods && filter.methods.length > 0) {
        const methods = filter.methods.map(m => `'${m}'`).join(',');
        query += ` AND l.method IN (${methods})`;
    }

    if (filter.search) {
        query += ` AND (l.url ILIKE ? OR l.user_agent ILIKE ?)`;
        params.push(`%${filter.search}%`);
        params.push(`%${filter.search}%`);
    }

    query += ` ORDER BY l.timestamp DESC`;
    if (filter.limit !== -1) {
        query += ` LIMIT ? OFFSET ?`;
        params.push(filter.limit || 100);
        params.push(filter.offset || 0);
    }

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
        FROM active_logs
    `);
    return result.toArray()[0].toJSON();
};

