import socket
from ua_parser import user_agent_parser
import pandas as pd

# Local Cache to prevent repetitive external DNS lookups for same IP
rdns_cache = {}

def get_rdns(ip):
    """ Look up the hostname for an IP using python's socket library. """
    if ip in rdns_cache:
        return rdns_cache[ip]
    try:
        host, _, _ = socket.gethostbyaddr(ip)
        rdns_cache[ip] = host
        return host
    except Exception:
        rdns_cache[ip] = None
        return None

def verify_googlebot(ip, host):
    if not host: return False
    # Reverse lookup ends with verified domains
    if host.endswith('.googlebot.com') or host.endswith('.google.com'):
        # Forward lookup to ensure matching IPs
        try:
            forward_ip = socket.gethostbyname(host)
            return forward_ip == ip
        except Exception:
            return False
    return False

def verify_bingbot(ip, host):
    if not host: return False
    if host.endswith('.search.msn.com'):
        try:
            forward_ip = socket.gethostbyname(host)
            return forward_ip == ip
        except Exception:
            return False
    return False

def classify_bot(user_agent, ip=None):
    parsed = user_agent_parser.Parse(user_agent)
    family = parsed['user_agent']['family'].lower()
    
    bot_type = "Human/Unknown"
    is_spoofed = False
    
    ua_lower = user_agent.lower()
    
    if 'googlebot' in ua_lower:
        bot_type = "Googlebot"
        if ip:
            host = get_rdns(ip)
            if not verify_googlebot(ip, host):
                is_spoofed = True
                bot_type = "Spoofed-Googlebot"
                
    elif 'bingbot' in ua_lower:
        bot_type = "Bingbot"
        if ip:
            host = get_rdns(ip)
            if not verify_bingbot(ip, host):
                is_spoofed = True
                bot_type = "Spoofed-Bingbot"
                
    elif 'gptbot' in ua_lower:
        bot_type = "GPTBot (AI)"
        
    elif 'applebot' in ua_lower:
        bot_type = "Applebot"
        
    elif 'bot' in family or 'spider' in family or 'crawler' in ua_lower:
        bot_type = "Generic-Bot"
        
    return bot_type, is_spoofed

def analyze_bots(df):
    """
    Enriches the dataframe with 'bot_type' and 'is_spoofed' flags.
    """
    bot_types = []
    spoof_flags = []
    
    for _, row in df.iterrows():
        ua = str(row.get('user_agent', ''))
        ip = str(row.get('ip', ''))
        
        bot_type, is_spoofed = classify_bot(ua, ip)
        
        bot_types.append(bot_type)
        spoof_flags.append(is_spoofed)
        
    df['bot_type'] = bot_types
    df['is_spoofed'] = spoof_flags
    return df
