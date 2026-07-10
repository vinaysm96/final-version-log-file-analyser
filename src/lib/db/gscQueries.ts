import { conn } from './index';

export const getGSCSummary = async () => {
    if (!conn) throw new Error("DB Connection not ready");
    const result = await conn.query(`
        SELECT 
            dataset_group,
            SUM(clicks) as total_clicks,
            SUM(impressions) as total_impressions,
            AVG(position) as avg_position,
            COUNT(DISTINCT query) as unique_queries,
            COUNT(DISTINCT page) as unique_pages
        FROM gsc_data
        GROUP BY dataset_group
    `);
    return result.toArray().map(r => r.toJSON());
};

export const getPinToPinComparison = async (brandRegex?: string) => {
    if (!conn) throw new Error("DB Connection not ready");
    
    // We assume 'Group A' is baseline and 'Group B' is recent
    const brandFilter = brandRegex ? `AND (a.query SIMILAR TO '%(${brandRegex})%' OR b.query SIMILAR TO '%(${brandRegex})%')` : '';
    
    const query = `
        WITH GroupA AS (
            SELECT query, page, clicks as clicks_a, impressions as imp_a, position as pos_a, ctr as ctr_a
            FROM gsc_data WHERE dataset_group = 'Group A'
        ),
        GroupB AS (
            SELECT query, page, clicks as clicks_b, impressions as imp_b, position as pos_b, ctr as ctr_b
            FROM gsc_data WHERE dataset_group = 'Group B'
        )
        SELECT 
            COALESCE(a.query, b.query) as query,
            COALESCE(a.page, b.page) as page,
            COALESCE(a.clicks_a, 0) as clicks_a,
            COALESCE(b.clicks_b, 0) as clicks_b,
            (COALESCE(b.clicks_b, 0) - COALESCE(a.clicks_a, 0)) as click_diff,
            COALESCE(a.imp_a, 0) as imp_a,
            COALESCE(b.imp_b, 0) as imp_b,
            (COALESCE(b.imp_b, 0) - COALESCE(a.imp_a, 0)) as imp_diff,
            a.pos_a, b.pos_b,
            a.ctr_a, b.ctr_b
        FROM GroupA a
        FULL OUTER JOIN GroupB b ON a.query = b.query AND a.page = b.page
        WHERE 1=1 ${brandFilter}
        ORDER BY ABS((COALESCE(b.clicks_b, 0) - COALESCE(a.clicks_a, 0))) DESC NULLS LAST
        LIMIT 500
    `;
    const result = await conn.query(query);
    return result.toArray().map(r => r.toJSON());
};

export const getOpportunities = async (datasetGroup: string = 'Group B') => {
    if (!conn) throw new Error("DB Connection not ready");
    
    const quickWins = await conn.query(`
        SELECT query, page, clicks, impressions, position, ctr, 'Quick Win' as type
        FROM gsc_data 
        WHERE dataset_group = '${datasetGroup}' 
        AND position BETWEEN 5 AND 15 
        AND impressions > 100
        ORDER BY impressions DESC LIMIT 100
    `);

    const ctrIssues = await conn.query(`
        SELECT query, page, clicks, impressions, position, ctr, 'Low CTR' as type
        FROM gsc_data 
        WHERE dataset_group = '${datasetGroup}' 
        AND impressions > 100 
        AND ctr < 0.02 
        AND position < 10
        ORDER BY impressions DESC LIMIT 100
    `);

    const deadWeight = await conn.query(`
        SELECT query, page, clicks, impressions, position, ctr, 'Dead Weight' as type
        FROM gsc_data 
        WHERE dataset_group = '${datasetGroup}' 
        AND impressions > 500 
        AND position > 20
        ORDER BY impressions DESC LIMIT 100
    `);

    return {
        quickWins: quickWins.toArray().map(r => r.toJSON()),
        ctrIssues: ctrIssues.toArray().map(r => r.toJSON()),
        deadWeight: deadWeight.toArray().map(r => r.toJSON())
    };
};

export const getCannibalization = async (datasetGroup: string = 'Group B') => {
    if (!conn) throw new Error("DB Connection not ready");
    const result = await conn.query(`
        WITH QueryCounts AS (
            SELECT query, COUNT(DISTINCT page) as page_count, SUM(clicks) as total_clicks
            FROM gsc_data
            WHERE dataset_group = '${datasetGroup}'
            GROUP BY query
            HAVING COUNT(DISTINCT page) > 1 AND SUM(clicks) > 0
        )
        SELECT g.query, g.page, g.clicks, g.impressions, g.position, q.page_count
        FROM gsc_data g
        JOIN QueryCounts q ON g.query = q.query
        WHERE g.dataset_group = '${datasetGroup}'
        ORDER BY q.total_clicks DESC, g.query, g.clicks DESC
        LIMIT 500
    `);
    return result.toArray().map(r => r.toJSON());
};
