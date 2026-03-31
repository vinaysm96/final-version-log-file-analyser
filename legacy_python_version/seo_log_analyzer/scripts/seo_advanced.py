import os
import xml.etree.ElementTree as ET
import pandas as pd
from urllib.parse import urlparse

def parse_sitemap(sitemap_path):
    """ Extracts paths from a sitemap.xml to compare with local logs """
    urls = set()
    if not os.path.exists(sitemap_path):
        return urls
        
    try:
        tree = ET.parse(sitemap_path)
        root = tree.getroot()
        
        # Determine namespace
        ns = {}
        if '}' in root.tag:
            uri = root.tag.split('}')[0].strip('{')
            ns = {'ns': uri}
            elements = root.findall('.//ns:url/ns:loc', ns)
        else:
            elements = root.findall('.//url/loc')
            
        for loc in elements:
            if loc.text:
                raw_url = loc.text.strip()
                parsed = urlparse(raw_url)
                # Ensure we only compare the path
                urls.add(parsed.path if parsed.path else '/')
    except Exception as e:
        print(f"Error parsing sitemap: {e}")
        
    return urls

def get_orphan_pages(df, sitemap_path):
    """
    Finds URLs crawling successfully but not defined in the sitemap.
    Only considers successful 200 pages.
    """
    sitemap_paths = parse_sitemap(sitemap_path)
    if not sitemap_paths:
        return set()
        
    html_pages = df[
        (df['status'] == 200) &
        (df['clean_url'].str.endswith('.html') | df['clean_url'].str.endswith('/')) &
        (df.get('is_crawl_waste', False) == False)
    ]['clean_url'].unique()
    
    orphans = set(html_pages) - sitemap_paths
    return list(orphans)[:50] # Top 50 orphans

def detect_redirect_chains(df):
    """
    Detect URLs that are frequently generating 301/302 redirects, wasting bot time.
    """
    redirects = df[df['status'].isin([301, 302, 307, 308])]
    if redirects.empty:
        return {}
    
    freq_redirects = redirects['clean_url'].value_counts()
    return freq_redirects[freq_redirects > 5].to_dict()

def audit_large_files(df):
    """
    Flag static resources > 100KB requested frequently by bots without compression cache.
    """
    # Tuple of static resource extensions
    static_extensions = ('.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff2')
    
    df['is_static'] = df['clean_url'].str.lower().apply(lambda x: x.endswith(static_extensions))
    
    large_assets = df[
        (df['size'] > 100000) & 
        (df['is_static'] == True)
    ]
    
    if large_assets.empty:
        return {}
        
    return large_assets['clean_url'].value_counts().head(10).to_dict()
