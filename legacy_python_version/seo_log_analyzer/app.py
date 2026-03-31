import streamlit as st
import pandas as pd
import tempfile
import os

from scripts import parser, bot_analyzer, crawl_budget, seo_advanced

st.set_page_config(page_title="SEO Log Analyzer", layout="wide", page_icon="📈")
st.title("SEO Technical Log File Analyzer")
st.markdown("Upload your server `.log` (Common/Combined format) and optionally a `sitemap.xml` to automatically diagnose crawl budgets and detect spoofed bot networks.")

with st.sidebar:
    st.header("File Uploads")
    log_file = st.file_uploader("Upload Server Log (.log, .txt)", type=["log", "txt"])
    sitemap_file = st.file_uploader("Upload Sitemap (.xml) - Optional", type=["xml"])
    
    analyze_btn = st.button("Run SEO Analysis", type="primary")

if analyze_btn and log_file is not None:
    # 1. Save uploaded files to temp
    with st.spinner("Decoding Log Payload..."):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".log") as tmp_log:
            tmp_log.write(log_file.getvalue())
            tmp_log_path = tmp_log.name
            
        sitemap_path = None
        if sitemap_file:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".xml") as tmp_map:
                tmp_map.write(sitemap_file.getvalue())
                sitemap_path = tmp_map.name
                
    st.info("Parsing Common/Combined Logs...")
    df, malformed = parser.parse_log_file(tmp_log_path)
    
    if df.empty:
        st.error("No valid lines parsed. Please ensure the log format matches standard Apache/Nginx format.")
    else:
        st.success(f"Parsed {len(df):,} valid rows cleanly. Ignored {malformed:,} malformed segments.")
        
        with st.spinner("Analyzing Bot Signatures & Running Reverse DNS Check..."):
            df = bot_analyzer.analyze_bots(df)
            
        with st.spinner("Scanning for Crawl Budget Waste..."):
            df, waste_summary = crawl_budget.calculate_crawl_budget_waste(df)
            
        with st.spinner("Running Advanced SEO Modules..."):
            orphans = seo_advanced.get_orphan_pages(df, sitemap_path) if sitemap_path else []
            redirects = seo_advanced.detect_redirect_chains(df)
            large_assets = seo_advanced.audit_large_files(df)
            
        # UI TABS FOR RESULTS
        st.header("Security & Diagnostics")
        col1, col2, col3 = st.columns(3)
        col1.metric("Total Authorized Bots", len(df[df['is_spoofed'] == False]))
        col2.metric("Spoofed Bots Detected", len(df[df['is_spoofed'] == True]), delta_color="inverse")
        col3.metric("Distinct Clean URLs", df['clean_url'].nunique())

        tab1, tab2, tab3 = st.tabs(["Crawl Visualizations", "Bot & Security Audits", "SEO Path Warnings"])
        
        with tab1:
            colA, colB = st.columns(2)
            with colA:
                st.subheader("Traffic by Bot Class")
                st.bar_chart(df['bot_type'].value_counts())
            with colB:
                st.subheader("HTTP Status Dist.")
                status_series = df['status'].value_counts()
                st.bar_chart(status_series)
                
            st.subheader("Top Indexing Paths")
            top_urls = df['clean_url'].value_counts().head(10).reset_index()
            top_urls.columns = ['URL', 'Requests']
            st.dataframe(top_urls, use_container_width=True)

        with tab2:
            st.subheader("Spoofed Bot Details")
            spoofed_df = df[df['is_spoofed'] == True]
            if not spoofed_df.empty:
                st.warning(f"Found {len(spoofed_df)} requests bypassing semantic bot checks! These IPs failed rDNS.")
                st.dataframe(spoofed_df[['ip', 'bot_type', 'timestamp', 'url']].head(100), use_container_width=True)
            else:
                st.success("All verified bot traffic passed mathematical host resolution successfully.")
                
            st.subheader("Top Large Uncompressed Heavy Assets")
            if large_assets:
                for a, h in large_assets.items():
                    st.write(f"- `{a}`: {h} hits (No Gzip/Brotli flag triggered)")
            else:
                st.write("No major static resource violations >100KB found locally.")

        with tab3:
            colC, colD = st.columns(2)
            with colC:
                st.subheader("Crawl Budget Waste")
                if waste_summary:
                    for k, v in waste_summary.items():
                        st.write(f"- `{k}` ({v} hits on dead/blocked paths)")
                else:
                    st.write("No severe crawl waste detected.")
                    
            with colD:
                st.subheader("Redirect Hopping")
                if redirects:
                    for k, v in redirects.items():
                        st.write(f"- `{k}` triggered {v} direct hops")
                else:
                    st.write("No severe chains detected.")
                    
            st.divider()
            st.subheader("Missing Sitemapped Orphans")
            if sitemap_path:
                if orphans:
                    st.warning(f"Detected {len(orphans)} paths crawled successfully but completely missing from your `sitemap.xml`:")
                    for o in orphans:
                        st.code(o)
                else:
                    st.success("No Orphaned paths surfaced against provided sitemap XML.")
            else:
                st.info("Sitemap parsing disabled. Upload an XML sitemap to activate Orphan page mapping.")
                
    # Cleanup temps
    os.remove(tmp_log_path)
    if sitemap_path: os.remove(sitemap_path)
    
elif analyze_btn:
    st.warning("Please upload at least a log file to run the analysis.")
