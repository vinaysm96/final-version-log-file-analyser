import { conn } from './index';

export interface OverviewStats {
    total_hits: number;
    unique_urls: number;
    total_bandwidth: number;
    avg_response_time: number;
}

export const getOverviewStats = async (): Promise<OverviewStats> => {
    if (!conn) throw new Error("DB not connected");
    const result = await conn.query(`
        SELECT 
            COUNT(*) as total_hits,
            COUNT(DISTINCT url) as unique_urls,
            SUM(size) as total_bandwidth,
            AVG(response_time) as avg_response_time
        FROM logs
    `);
    const row = result.toArray()[0];
    return {
        total_hits: Number(row.total_hits || 0),
        unique_urls: Number(row.unique_urls || 0),
        total_bandwidth: Number(row.total_bandwidth || 0),
        avg_response_time: Number(row.avg_response_time || 0)
    };
};

export const getBotStats = async () => {
    if (!conn) throw new Error("DB not connected");
    const result = await conn.query(`
        SELECT 
            bot_name, 
            bot_type,
            count(*) as hits,
            count(distinct url) as unique_urls,
            sum(size) as bandwidth
        FROM logs
        WHERE bot_type != 'user' AND bot_type != 'unknown'
        GROUP BY bot_name, bot_type
        ORDER BY hits DESC
    `);
    return result.toArray().map(r => r.toJSON());
};

export const getStatusCodeStats = async () => {
    if (!conn) throw new Error("DB not connected");
    const result = await conn.query(`
        SELECT 
            status,
            count(*) as count
        FROM logs
        GROUP BY status
        ORDER BY count DESC
    `);
    return result.toArray().map(r => r.toJSON());
};

export const getCrawlBudgetWaste = async () => {
    // Identify URLs crawled excessively
    if (!conn) throw new Error("DB not connected");
    const result = await conn.query(`
        SELECT 
            url,
            count(*) as hits,
            bot_name
        FROM logs
        WHERE bot_type = 'search_engine'
        GROUP BY url, bot_name
        HAVING count(*) > 5
        ORDER BY hits DESC
        LIMIT 50
    `);
    return result.toArray().map(r => r.toJSON());
};

export const getTimeSeriesData = async (interval: 'hour' | 'day' = 'day') => {
    if (!conn) throw new Error("DB not connected");
    // DuckDB date_trunc
    const trunc = interval === 'day' ? 'day' : 'hour';
    const result = await conn.query(`
        SELECT 
            date_trunc('${trunc}', timestamp) as date,
            bot_type,
            count(*) as hits
        FROM logs
        GROUP BY 1, 2
        ORDER BY 1
    `);
    return result.toArray().map(r => ({
        date: new Date(r.date).toISOString(),
        bot_type: r.bot_type,
        hits: Number(r.hits)
    }));
};

export const getBotPaths = async (botName: string) => {
    if (!conn) throw new Error("DB not connected");
    // Retrieve top 100 unique URLs crawled by a specific bot
    const result = await conn.query(`
        SELECT 
            url,
            count(*) as hits,
            max(timestamp) as last_crawled
        FROM logs
        WHERE bot_name = '${botName.replace(/'/g, "''")}'
        GROUP BY url
        ORDER BY hits DESC
        LIMIT 100
    `);
    return result.toArray().map(r => r.toJSON());
};

export const getBotActivityTimetable = async () => {
    if (!conn) throw new Error("DB not connected");
    // Generate a schedule of when bots are most active
    const result = await conn.query(`
        SELECT
            bot_name,
            dayname(timestamp) as day_of_week,
            count(*) as hits
        FROM logs
        WHERE bot_type != 'user' AND bot_type != 'unknown'
        GROUP BY bot_name, dayname(timestamp)
        ORDER BY bot_name ASC, hits DESC
    `);
    return result.toArray().map(r => r.toJSON());
};
