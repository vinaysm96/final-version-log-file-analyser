import { conn } from './index';

// Pre-define the case strings for the grouped datasets
const FILE_TYPE_CASE_GROUPED = `
    CASE
        WHEN url ILIKE '%.js' THEN 'JavaScript'
        WHEN url ILIKE '%.css' THEN 'CSS'
        WHEN url SIMILAR TO '%.(png|jpg|jpeg|gif|svg|ico|webp)' THEN 'Image'
        WHEN url SIMILAR TO '%.(json|xml|txt)' THEN 'Data'
        ELSE 'HTML'
    END
`;

const CLEAN_URL_FILE_TYPE_CASE_GROUPED = `
    CASE    
        WHEN lower(clean_url) ILIKE '%.js' THEN 'JavaScript'
        WHEN lower(clean_url) ILIKE '%.css' THEN 'CSS'
        WHEN lower(clean_url) SIMILAR TO '%.(png|jpg|jpeg|gif|svg|ico|webp)' THEN 'Image'
        WHEN lower(clean_url) SIMILAR TO '%.(json|xml|txt)' THEN 'Data'
        ELSE 'HTML'
    END
`;

const CRAWL_FREQ_CASE_GROUPED = `
    CASE 
        WHEN total_hits <= 1 THEN 'Once'
        WHEN date_diff('second', min_ts, max_ts) / (total_hits - 1) < 3600 
            THEN 'Every ' || CAST(ROUND((date_diff('second', min_ts, max_ts) / (total_hits - 1)) / 60) AS INTEGER) || ' mins'
        WHEN date_diff('second', min_ts, max_ts) / (total_hits - 1) < 86400 
            THEN 'Every ' || CAST(ROUND((date_diff('second', min_ts, max_ts) / (total_hits - 1)) / 3600) AS INTEGER) || ' hours'
        ELSE CAST(ROUND((date_diff('second', min_ts, max_ts) / (total_hits - 1)) / 86400) AS INTEGER) || ' days once'
    END
`;

export const getInconsistentStats = async () => {
    if (!conn) throw new Error("DB not connected");

    const resultCase = await conn.query(`
    WITH grouped AS (
        SELECT 
            lower(url) as clean_url, 
            list(DISTINCT url) as variants,
            count(*) as total_hits,
            min(timestamp) as min_ts,
            max(timestamp) as max_ts
        FROM logs
        GROUP BY 1
        HAVING count(DISTINCT url) > 1
    )
    SELECT 
        clean_url,
        variants,
        total_hits,
        ${CLEAN_URL_FILE_TYPE_CASE_GROUPED} as file_type,
        ${CRAWL_FREQ_CASE_GROUPED} as crawl_frequency
    FROM grouped
    ORDER BY total_hits DESC
    LIMIT 100
  `);

    const resultSlash = await conn.query(`
    WITH grouped AS (
        SELECT 
            CASE WHEN url LIKE '%/' AND length(url) > 1 THEN substring(url, 1, length(url)-1) ELSE url END as clean_url,
            list(DISTINCT url) as variants,
            count(*) as total_hits,
            min(timestamp) as min_ts,
            max(timestamp) as max_ts
        FROM logs
        GROUP BY 1
        HAVING count(DISTINCT url) > 1
    )
    SELECT 
        clean_url,
        variants,
        total_hits,
        ${CLEAN_URL_FILE_TYPE_CASE_GROUPED} as file_type,
        ${CRAWL_FREQ_CASE_GROUPED} as crawl_frequency
    FROM grouped
    ORDER BY total_hits DESC
    LIMIT 100
  `);

    return {
        caseIssues: resultCase.toArray().map(r => r.toJSON()),
        slashIssues: resultSlash.toArray().map(r => r.toJSON())
    };
};

export const getOrphanStats = async () => {
    if (!conn) throw new Error("DB not connected");
    const result = await conn.query(`
        WITH grouped AS (
            SELECT 
                url, 
                count(*) as total_hits,
                min(timestamp) as min_ts,
                max(timestamp) as max_ts
            FROM logs
            WHERE status = 200
            GROUP BY url
            HAVING count(*) < 5
        )
        SELECT
            url,
            total_hits as hits,
            ${FILE_TYPE_CASE_GROUPED} as file_type,
            ${CRAWL_FREQ_CASE_GROUPED} as crawl_frequency
        FROM grouped
        ORDER BY hits ASC
        LIMIT 50
    `);
    return result.toArray().map(r => r.toJSON());
};

export const getErrorStats = async () => {
    if (!conn) throw new Error("DB not connected");
    const result = await conn.query(`
        WITH grouped AS (
            SELECT 
                url, 
                status, 
                count(*) as total_hits,
                min(timestamp) as min_ts,
                max(timestamp) as max_ts
            FROM logs 
            WHERE status >= 400
            GROUP BY url, status
        )
        SELECT
            url,
            status,
            total_hits as hits,
            ${FILE_TYPE_CASE_GROUPED} as file_type,
            ${CRAWL_FREQ_CASE_GROUPED} as crawl_frequency
        FROM grouped
        ORDER BY hits DESC
        LIMIT 50
    `);
    return result.toArray().map(r => r.toJSON());
};

export const getSitemapURLs = async () => {
    if (!conn) throw new Error("DB not connected");
    
    // Google Sitemap Standard rules:
    // - Only HTML paths (ignoring CSS/JS/images)
    // - Do not include query parameters from UTMs
    // - MOST IMPORTANTLY: If a URL threw a 404 or 500 recently, do NOT include it, even if it was 200 before.
    const result = await conn.query(`
        WITH clean_urls AS (
            SELECT 
                CASE 
                    WHEN url LIKE '%?%' THEN split_part(url, '?', 1)
                    ELSE url 
                END as base_url,
                timestamp,
                status
            FROM logs
            WHERE method = 'GET'
        ),
        ranked AS (
            SELECT 
                base_url,
                status,
                timestamp,
                ROW_NUMBER() OVER(PARTITION BY base_url ORDER BY timestamp DESC) as rn
            FROM clean_urls
        )
        SELECT 
            base_url as clean_url,
            timestamp as lastmod
        FROM ranked
        WHERE rn = 1 
          AND status = 200 
          AND base_url NOT SIMILAR TO '%.(js|css|png|jpg|jpeg|gif|svg|ico|webp|json|xml|txt|woff|woff2|ttf|eot)$'
        ORDER BY base_url ASC
    `);
    return result.toArray().map(r => r.toJSON());
};

export const getRobotsSuggestions = async () => {
    if (!conn) throw new Error("DB not connected");
    const result = await conn.query(`
        WITH grouped AS (
            SELECT 
                regexp_extract(url, '\\\\?([^=]+)=', 1) as param_name,
                count(*) as total_hits,
                count(DISTINCT split_part(url, '?', 1)) as unique_pages_affected,
                min(timestamp) as min_ts,
                max(timestamp) as max_ts
            FROM logs
            WHERE url LIKE '%?%=' 
              AND status = 200
            GROUP BY 1
            HAVING count(*) > 2
        )
        SELECT
            param_name,
            total_hits as hits,
            unique_pages_affected,
            ${CRAWL_FREQ_CASE_GROUPED} as crawl_frequency
        FROM grouped
        ORDER BY hits DESC
        LIMIT 20
    `);
    return result.toArray().map(r => r.toJSON());
};

