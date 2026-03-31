import pandas as pd
import re

def calculate_crawl_budget_waste(df, robots_txt_rules=None):
    """
    Identifies URLs that bots crawl frequently indicating wasted crawl budget.
    Waste indicators:
    - 404/410 errors (dead pages)
    - 3xx redirect loops or long hops (handled partly in seo_advanced.py, but marked here)
    - Query parameters leading to infinite loops/duplication (if not canonicalized)
    - Paths like /wp-admin/, /cdn-cgi/ etc.
    """
    waste_patterns = [
        re.compile(r'/wp-admin/?'),
        re.compile(r'/wp-includes/?'),
        re.compile(r'\?replytocom='),
        re.compile(r'\?sort='),     # Faceted navigation
        re.compile(r'\?filter='),
    ]

    def is_waste(row):
        # Only care about bots wasting budget
        if 'Bot' not in row.get('bot_type', '') and 'Applebot' not in row.get('bot_type', ''):
            return False

        status = row.get('status', 200)
        
        # Dead ends
        if status in [404, 410, 500, 503]:
            return True
            
        url = str(row.get('url', ''))
        
        # Matching known waste paths
        for pattern in waste_patterns:
            if pattern.search(url):
                return True
                
        return False

    df['is_crawl_waste'] = df.apply(is_waste, axis=1)

    # Summarize waste
    waste_summary = []
    if not df.empty and 'is_crawl_waste' in df.columns:
        waste_df = df[df['is_crawl_waste'] == True]
        if not waste_df.empty:
            waste_summary = waste_df['clean_url'].value_counts().head(20).to_dict()

    return df, waste_summary
