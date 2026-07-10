import { conn } from './index'

export interface OverviewStats {
    total_hits: number
    unique_urls: number
    unique_ips: number
    total_bandwidth: number
    avg_response_time: number
    error_rate: number
    bot_rate: number
}

const ensureConn = () => {
    if (!conn) throw new Error('DB not connected')
}

/**
 * Overview Stats
 */
export const getOverviewStats = async (): Promise<OverviewStats> => {
    ensureConn()

    const result = await conn!.query(`
    SELECT 
      COUNT(*) AS total_hits,
      COUNT(DISTINCT url) AS unique_urls,
      COUNT(DISTINCT ip) AS unique_ips,
      COALESCE(SUM(size), 0) AS total_bandwidth,
      COALESCE(AVG(response_time), 0) AS avg_response_time,
      ROUND(100.0 * SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS error_rate,
      ROUND(100.0 * SUM(CASE WHEN bot_type NOT IN ('user', 'unknown') THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS bot_rate
    FROM active_logs
  `)

    const row = result.toArray()[0] || {}

    return {
        total_hits: Number(row.total_hits ?? 0),
        unique_urls: Number(row.unique_urls ?? 0),
        unique_ips: Number(row.unique_ips ?? 0),
        total_bandwidth: Number(row.total_bandwidth ?? 0),
        avg_response_time: Number(row.avg_response_time ?? 0),
        error_rate: Number(row.error_rate ?? 0),
        bot_rate: Number(row.bot_rate ?? 0),
    }
}

/**
 * Bot Stats
 */
export const getBotStats = async () => {
    ensureConn()

    const result = await conn!.query(`
    SELECT 
      bot_name,
      bot_type,
      COUNT(*) AS hits,
      approx_count_distinct(url) AS unique_urls,
      COALESCE(SUM(size), 0) AS bandwidth
    FROM active_logs
    WHERE bot_type NOT IN ('user', 'unknown')
    GROUP BY bot_name, bot_type
    ORDER BY hits DESC
    LIMIT 200
  `)

    return result.toArray().map(r => ({
        bot_name: r.bot_name,
        bot_type: r.bot_type,
        hits: Number(r.hits),
        unique_urls: Number(r.unique_urls),
        bandwidth: Number(r.bandwidth)
    }))
}

/**
 * Bot type breakdown (for donut chart)
 */
export const getBotTypeBreakdown = async () => {
    ensureConn()

    const result = await conn!.query(`
    SELECT 
      CASE 
        WHEN bot_type = 'user' THEN 'User'
        WHEN bot_type = 'search_engine' THEN 'Search Engine'
        WHEN bot_type = 'ai_bot' THEN 'AI Bot'
        WHEN bot_type = 'seo_tool' THEN 'SEO Tool'
        WHEN bot_type = 'social' THEN 'Social Media'
        WHEN bot_type = 'monitoring' THEN 'Monitoring'
        ELSE 'Unknown'
      END AS label,
      COUNT(*) AS hits
    FROM active_logs
    GROUP BY bot_type
    ORDER BY hits DESC
  `)

    return result.toArray().map(r => ({
        label: r.label,
        hits: Number(r.hits)
    }))
}

/**
 * Status Code Distribution
 */
export const getStatusCodeStats = async () => {
    ensureConn()

    const result = await conn!.query(`
    SELECT 
      status,
      COUNT(*) AS count
    FROM active_logs
    GROUP BY status
    ORDER BY count DESC
  `)

    return result.toArray().map(r => ({
        status: Number(r.status),
        count: Number(r.count)
    }))
}

/**
 * Crawl Budget Waste
 */
export const getCrawlBudgetWaste = async () => {
    ensureConn()

    const result = await conn!.query(`
    SELECT 
      url,
      COUNT(*) AS hits,
      bot_name
    FROM active_logs
    WHERE bot_type = 'search_engine'
    GROUP BY url, bot_name
    HAVING COUNT(*) > 5
    ORDER BY hits DESC
    LIMIT 50
  `)

    return result.toArray().map(r => ({
        url: r.url,
        hits: Number(r.hits),
        bot_name: r.bot_name
    }))
}

/**
 * Time Series Data
 */
export const getTimeSeriesData = async (interval: 'hour' | 'day' = 'day') => {
    ensureConn()

    const trunc = interval === 'hour' ? 'hour' : 'day'

    const result = await conn!.query(`
    SELECT 
      date_trunc('${trunc}', timestamp) AS date,
      bot_type,
      COUNT(*) AS hits
    FROM active_logs
    GROUP BY 1, 2
    ORDER BY 1 ASC
  `)

    return result.toArray().map(r => ({
        date: new Date(r.date).toISOString(),
        bot_type: r.bot_type,
        hits: Number(r.hits)
    }))
}

/**
 * Hourly traffic heatmap
 */
export const getHourlyHeatmap = async () => {
    ensureConn()

    const result = await conn!.query(`
    SELECT 
      EXTRACT(hour FROM timestamp) AS hour,
      EXTRACT(dow FROM timestamp) AS dow,
      COUNT(*) AS hits
    FROM active_logs
    WHERE bot_type NOT IN ('user', 'unknown')
    GROUP BY hour, dow
    ORDER BY dow ASC, hour ASC
  `)

    return result.toArray().map(r => ({
        hour: Number(r.hour),
        dow: Number(r.dow),
        hits: Number(r.hits)
    }))
}

/**
 * Bot Paths (SAFE)
 */
export const getBotPaths = async (botName: string) => {
    ensureConn()

    const safeBot = botName.replace(/'/g, "''")

    const result = await conn!.query(`
    SELECT 
      url,
      COUNT(*) AS hits,
      MAX(timestamp) AS last_crawled
    FROM active_logs
    WHERE bot_name = '${safeBot}'
    GROUP BY url
    ORDER BY hits DESC
    LIMIT 100
  `)

    return result.toArray().map(r => ({
        url: r.url,
        hits: Number(r.hits),
        last_crawled: r.last_crawled
    }))
}

/**
 * Bot Activity Timetable
 */
export const getBotActivityTimetable = async () => {
    ensureConn()

    const result = await conn!.query(`
    SELECT
      bot_name,
      dayname(timestamp) AS day_of_week,
      COUNT(*) AS hits
    FROM active_logs
    WHERE bot_type NOT IN ('user', 'unknown')
    GROUP BY bot_name, dayname(timestamp)
    ORDER BY bot_name ASC, hits DESC
  `)

    return result.toArray().map(r => ({
        bot_name: r.bot_name,
        day_of_week: r.day_of_week,
        hits: Number(r.hits)
    }))
}

/**
 * Top IPs
 */
export const getTopIPs = async () => {
    ensureConn()

    const result = await conn!.query(`
    SELECT
      ip,
      COUNT(*) AS hits,
      approx_count_distinct(url) AS unique_urls,
      MAX(bot_name) AS bot_name,
      MAX(bot_type) AS bot_type,
      MIN(timestamp) AS first_seen,
      MAX(timestamp) AS last_seen,
      SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS error_hits
    FROM active_logs
    GROUP BY ip
    ORDER BY hits DESC
    LIMIT 200
  `)

    return result.toArray().map(r => ({
        ip: r.ip,
        hits: Number(r.hits),
        unique_urls: Number(r.unique_urls),
        bot_name: r.bot_name,
        bot_type: r.bot_type,
        first_seen: r.first_seen,
        last_seen: r.last_seen,
        error_hits: Number(r.error_hits),
    }))
}

/**
 * Suspicious IPs (high error rate, high frequency, non-user bots)
 */
export const getSuspiciousIPs = async () => {
    ensureConn()

    const result = await conn!.query(`
    SELECT
      ip,
      COUNT(*) AS hits,
      approx_count_distinct(url) AS unique_urls,
      MAX(bot_name) AS bot_name,
      MAX(bot_type) AS bot_type,
      ROUND(100.0 * SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS error_rate,
      MAX(timestamp) AS last_seen
    FROM active_logs
    WHERE bot_type IN ('unknown')
       OR (status >= 400 AND bot_type IN ('unknown', 'user'))
    GROUP BY ip
    HAVING COUNT(*) >= 3
    ORDER BY hits DESC
    LIMIT 100
  `)

    return result.toArray().map(r => ({
        ip: r.ip,
        hits: Number(r.hits),
        unique_urls: Number(r.unique_urls),
        bot_name: r.bot_name,
        bot_type: r.bot_type,
        error_rate: Number(r.error_rate),
        last_seen: r.last_seen,
    }))
}

/**
 * Database size info
 */
export const getDBInfo = async () => {
    ensureConn()

    const result = await conn!.query(`
    SELECT
      COUNT(*) AS total_rows,
      COUNT(DISTINCT file_name) AS total_files,
      MIN(timestamp) AS earliest,
      MAX(timestamp) AS latest
    FROM logs
  `)

    const row = result.toArray()[0]?.toJSON() || {}
    return {
        total_rows: Number(row.total_rows ?? 0),
        total_files: Number(row.total_files ?? 0),
        earliest: row.earliest,
        latest: row.latest,
    }
}