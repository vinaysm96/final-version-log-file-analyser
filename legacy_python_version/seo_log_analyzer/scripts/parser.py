import re
import pandas as pd
from urllib.parse import urlparse, urlencode, parse_qsl, urlunparse
from datetime import datetime

# Regular expression to match Combined Log Format (as well as extended formats ending with response times)
COMBINED_LOG_REGEX = re.compile(
    r'(?P<ip>[^\s]+)\s+'                  # IP address
    r'(?P<ident>[^\s]+)\s+'               # Identity
    r'(?P<user>[^\s]+)\s+'                # Remote user
    r'\[(?P<timestamp>[^\]]+)\]\s+'       # Timestamp
    r'"(?P<method>[A-Z]+)\s+'             # HTTP Method
    r'(?P<url>[^\s]+)\s+'                 # URL Path
    r'(?P<http_version>[^"]+)"\s+'        # HTTP Version
    r'(?P<status>[^\s]+)\s+'              # Status code
    r'(?P<size>[^\s]+)\s*'                # Response size
    r'(?:"(?P<referrer>[^"]*)")?\s*'      # Referrer (optional)
    r'(?:"(?P<user_agent>[^"]*)")?\s*'    # User Agent (optional)
    r'(?P<response_time>[^\s]+)?'         # Custom response time (optional, e.g. %T or %D)
)

def clean_url(url):
    """
    Remove tracking parameters like utm_source, gclid, fbclid from URLs to aggregate correctly.
    """
    try:
        parsed_url = urlparse(url)
        query_params = parse_qsl(parsed_url.query, keep_blank_values=True)
        # Filter out common marketing/tracking parameters
        tracking_params = {'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', '_ga'}
        filtered_query = [(k, v) for k, v in query_params if k not in tracking_params]
        
        # Reconstruct URL
        new_query = urlencode(filtered_query)
        clean_parsed = parsed_url._replace(query=new_query)
        return urlunparse(clean_parsed)
    except Exception:
        return url

def parse_log_file(file_path):
    """
    Parse a log file line by line and return a Pandas DataFrame.
    """
    data = []
    malformed_lines = 0
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            match = COMBINED_LOG_REGEX.match(line)
            if match:
                row = match.groupdict()
                
                # Handle "-" size which means 0 usually
                size_str = row['size']
                row['size'] = 0 if size_str == '-' else int(size_str)
                
                # Handle status
                row['status'] = int(row['status'])

                # Handle response time (milliseconds or seconds assumed as float/int)
                rt_str = row['response_time']
                if rt_str and rt_str != '-':
                    try:
                        row['response_time'] = float(rt_str)
                    except ValueError:
                        row['response_time'] = None
                else:
                    row['response_time'] = None
                
                # Clean URL
                row['clean_url'] = clean_url(row['url'])
                
                data.append(row)
            else:
                malformed_lines += 1

    df = pd.DataFrame(data)
    
    if not df.empty:
        # Convert timestamp to datetime
        # Format usually looks like: 10/Oct/2000:13:55:36 -0700
        # We handle this carefully as some logs might have variations
        # Use pandas to_datetime which is robust, or manual parsing for speed
        try:
            df['timestamp_dt'] = pd.to_datetime(df['timestamp'], format='%d/%b/%Y:%H:%M:%S %z', exact=False)
        except Exception as e:
            # Fallback for naive or varied formats
            df['timestamp_dt'] = pd.to_datetime(df['timestamp'], errors='coerce')

    return df, malformed_lines
