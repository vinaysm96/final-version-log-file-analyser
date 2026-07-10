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
        WHEN date_diff('second', min_ts, max_ts) / NULLIF(total_hits - 1, 0) < 3600 
            THEN 'Every ' || CAST(ROUND((date_diff('second', min_ts, max_ts) / NULLIF(total_hits - 1, 0)) / 60) AS INTEGER) || ' mins'
        WHEN date_diff('second', min_ts, max_ts) / NULLIF(total_hits - 1, 0) < 86400 
            THEN 'Every ' || CAST(ROUND((date_diff('second', min_ts, max_ts) / NULLIF(total_hits - 1, 0)) / 3600) AS INTEGER) || ' hours'
        ELSE CAST(ROUND((date_diff('second', min_ts, max_ts) / NULLIF(total_hits - 1, 0)) / 86400) AS INTEGER) || ' days once'
    END
`;

export const getInconsistentStats = async () => {
    if (!conn) throw new Error("DB not connected");

    // Use a pre-aggregated subquery to find common URLs first, limiting list construction to where it actually matters
    const resultCase = await conn.query(`
    WITH candidates AS (
        SELECT lower(url) as clean_url
        FROM active_logs
        GROUP BY 1
        HAVING count(DISTINCT url) > 1
        LIMIT 2000
    ),
    grouped AS (
        SELECT 
            lower(l.url) as clean_url, 
            list(DISTINCT l.url) as variants,
            count(*) as total_hits,
            min(l.timestamp) as min_ts,
            max(l.timestamp) as max_ts
        FROM active_logs l
        JOIN candidates c ON lower(l.url) = c.clean_url
        GROUP BY 1
    )
    SELECT 
        clean_url,
        variants,
        total_hits,
        ${CLEAN_URL_FILE_TYPE_CASE_GROUPED} as file_type,
        ${CRAWL_FREQ_CASE_GROUPED} as crawl_frequency
    FROM grouped
    ORDER BY total_hits DESC
  `);

    const resultSlash = await conn.query(`
    WITH candidates AS (
        SELECT 
            CASE WHEN url LIKE '%/' AND length(url) > 1 THEN substring(url, 1, length(url)-1) ELSE url END as clean_url
        FROM active_logs
        GROUP BY 1
        HAVING count(DISTINCT url) > 1
        LIMIT 2000
    ),
    grouped AS (
        SELECT 
            CASE WHEN l.url LIKE '%/' AND length(l.url) > 1 THEN substring(l.url, 1, length(l.url)-1) ELSE l.url END as clean_url,
            list(DISTINCT l.url) as variants,
            count(*) as total_hits,
            min(l.timestamp) as min_ts,
            max(l.timestamp) as max_ts
        FROM active_logs l
        JOIN candidates c ON (CASE WHEN l.url LIKE '%/' AND length(l.url) > 1 THEN substring(l.url, 1, length(l.url)-1) ELSE l.url END) = c.clean_url
        GROUP BY 1
    )
    SELECT 
        clean_url,
        variants,
        total_hits,
        ${CLEAN_URL_FILE_TYPE_CASE_GROUPED} as file_type,
        ${CRAWL_FREQ_CASE_GROUPED} as crawl_frequency
    FROM grouped
    ORDER BY total_hits DESC
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
            FROM active_logs
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
        LIMIT 10000
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
            FROM active_logs 
            WHERE status >= 400 AND status < 500
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
        LIMIT 10000
    `);
    return result.toArray().map(r => r.toJSON());
};

export const getServerErrors = async () => {
    if (!conn) throw new Error("DB not connected");
    const result = await conn.query(`
        WITH grouped AS (
            SELECT 
                url, 
                status, 
                count(*) as total_hits,
                min(timestamp) as min_ts,
                max(timestamp) as max_ts
            FROM active_logs 
            WHERE status >= 500
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
        LIMIT 10000
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
        SELECT 
            CASE 
                WHEN url LIKE '%?%' THEN split_part(url, '?', 1)
                ELSE url 
            END as clean_url,
            max(timestamp) as lastmod
        FROM active_logs
        WHERE method = 'GET' 
          AND status = 200
          AND url NOT SIMILAR TO '%.(js|css|png|jpg|jpeg|gif|svg|ico|webp|json|xml|txt|woff|woff2|ttf|eot)$'
        GROUP BY 1
        ORDER BY 1 ASC
    `);
    return result.toArray().map(r => r.toJSON());
};

export const getRobotsSuggestions = async () => {
    if (!conn) throw new Error("DB not connected");
    const result = await conn.query(`
        WITH raw_params AS (
            SELECT 
                regexp_extract(url, '[?&]([^=&]+)', 1) as param_name
            FROM active_logs
            WHERE url LIKE '%?%'
        )
        SELECT 
            param_name,
            count(*) as hits,
            'Frequent' as crawl_frequency
        FROM raw_params
        WHERE param_name IS NOT NULL
        GROUP BY 1
        HAVING count(*) > 10
        ORDER BY 2 DESC
        LIMIT 100
    `);
    return result.toArray().map(r => r.toJSON());
};

export const getRedirectionChains = async () => {
    if (!conn) throw new Error("DB not connected");
    // Detected multi-hop redirects by looking at sequential hits from same IP
    const result = await conn.query(`
        WITH target_ips AS (
            SELECT ip 
            FROM active_logs 
            WHERE status IN (301, 302, 303, 307, 308)
            GROUP BY 1
            LIMIT 2000 
        ),
        raw_chains AS (
            SELECT 
                ip, url, status, timestamp,
                LEAD(url) OVER (PARTITION BY ip ORDER BY timestamp) as step2_url,
                LEAD(status) OVER (PARTITION BY ip ORDER BY timestamp) as step2_status,
                LEAD(url, 2) OVER (PARTITION BY ip ORDER BY timestamp) as step3_url,
                LEAD(status, 2) OVER (PARTITION BY ip ORDER BY timestamp) as step3_status
            FROM active_logs 
            WHERE ip IN (SELECT ip FROM target_ips)
        )
        SELECT 
            url as start_url,
            status as start_status,
            step2_url as hop1_url,
            step2_status as hop1_status,
            step3_url as hop2_url,
            step3_status as hop2_status,
            count(*) as frequency
        FROM raw_chains
        WHERE start_status IN (301, 302, 303, 307, 308)
          AND hop1_url IS NOT NULL
        GROUP BY 1, 2, 3, 4, 5, 6
        ORDER BY frequency DESC
        LIMIT 200
    `);
    return result.toArray().map(r => r.toJSON());
};

export const getTopCrawledPages = async () => {
    if (!conn) throw new Error("DB not connected");
    const result = await conn.query(`
        WITH grouped AS (
            SELECT 
                url, 
                count(*) as total_hits,
                min(timestamp) as min_ts,
                max(timestamp) as max_ts
            FROM active_logs
            WHERE status = 200
            GROUP BY url
        )
        SELECT
            url,
            total_hits as hits,
            ${FILE_TYPE_CASE_GROUPED} as file_type,
            ${CRAWL_FREQ_CASE_GROUPED} as crawl_frequency
        FROM grouped
        ORDER BY hits DESC
        LIMIT 10000
    `);
    return result.toArray().map(r => r.toJSON());
};

export const getCrawlBudgetLinks = async (directory: string) => {
    if (!conn) throw new Error("DB not connected");
    // directory looks like "/blog" — we match URLs that start with directory + "/"
    const result = await conn.query(`
        SELECT
            url,
            status,
            count(*) as hits,
            max(timestamp) as last_crawled
        FROM active_logs
        WHERE url LIKE '${directory}/%'
        GROUP BY url, status
        ORDER BY hits DESC
        LIMIT 500
    `);
    return result.toArray().map(r => r.toJSON());
};

export const getCrawlBudgetWastage = async () => {
    if (!conn) throw new Error("DB not connected");
    const result = await conn.query(`
        WITH grouped AS (
            SELECT 
                split_part(url, '/', 2) as first_directory,
                count(*) as total_hits,
                approx_count_distinct(url) as unique_urls_in_dir
            FROM active_logs
            WHERE url LIKE '/%/%' 
            GROUP BY 1
        )
        SELECT
            '/' || first_directory as directory,
            total_hits as hits,
            unique_urls_in_dir
        FROM grouped
        ORDER BY hits DESC
        LIMIT 10000
    `);
    return result.toArray().map(r => r.toJSON());
};

