import os
import argparse
from datetime import datetime
import matplotlib.pyplot as plt

# Custom Modules
import parser
import bot_analyzer
import crawl_budget
import seo_advanced

def generate_dashboard(df, output_path):
    """
    Generate an SVG/PNG dashboard showing basic diagnostics.
    Visualizing: Crawl Frequency by Bot, Response Codes, Top URLs crawling.
    """
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    fig.suptitle('SEO Log Analyzer Dashboard', fontsize=16)

    # 1. Crawl Frequency by Bot Type
    bot_counts = df['bot_type'].value_counts()
    axes[0, 0].bar(bot_counts.index, bot_counts.values, color=['#4C72B0', '#55A868', '#C44E52', '#8172B2'])
    axes[0, 0].set_title('Request Count by Bot Type')
    axes[0, 0].set_ylabel('Requests')
    axes[0, 0].tick_params(axis='x', rotation=45)

    # 2. Status Code Distribution
    status_counts = df['status'].value_counts()
    axes[0, 1].pie(status_counts.values, labels=status_counts.index, autopct='%1.1f%%',
                   colors=['#55A868', '#C44E52', '#8172B2', '#CCB974'][:len(status_counts)])
    axes[0, 1].set_title('Status Code Distribution')

    # 3. Top Crawled URLs
    top_urls = df['clean_url'].value_counts().head(10)
    axes[1, 0].barh(top_urls.index[::-1], top_urls.values[::-1], color='#4C72B0')
    axes[1, 0].set_title('Top 10 Crawled URLs')
    axes[1, 0].set_xlabel('Hits')

    # 4. Response Time Distribution
    if 'response_time' in df.columns and df['response_time'].notnull().any():
        axes[1, 1].hist(df['response_time'].dropna(), bins=30, color='#C44E52')
        axes[1, 1].set_title('Response Time Histogram (>500ms filtered)')
        axes[1, 1].set_xlabel('Time (ms/sec)')
    else:
        axes[1, 1].text(0.5, 0.5, 'Response Time Not Available', horizontalalignment='center', verticalalignment='center')
        axes[1, 1].set_title('Response Time (N/A)')

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()

def generate_markdown_report(df, waste_summary, orphans, redirects, large_assets, output_path):
    bot_stats = df['bot_type'].value_counts()
    total_lines = len(df)
    
    spoofed_bots = df[df['is_spoofed'] == True]
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("# SEO Technical Log Report\n")
        f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("## 1. Overview\n")
        f.write(f"- Total Valid Requests: {total_lines}\n")
        for bot, cnt in bot_stats.items():
            f.write(f"- {bot}: {cnt}\n")
            
        f.write("\n## 2. Security & Verification\n")
        f.write(f"- Spoofed Bots Detected: {len(spoofed_bots)}\n")
        if not spoofed_bots.empty:
            f.write("  **Top Spoofed IPs:**\n")
            for ip, hits in spoofed_bots['ip'].value_counts().head(5).items():
                f.write(f"  - `{ip}` ({hits} hits)\n")
                
        f.write("\n## 3. Crawl Budget Waste\n")
        if waste_summary:
            f.write("- The following paths are heavily sucking up budget through errors/loops:\n")
            for url, hits in waste_summary.items():
                f.write(f"  - `{url}` ({hits} hits)\n")
        else:
            f.write("- No significant crawl budget waste found.\n")

        f.write("\n## 4. Redirect Chains & Hopping\n")
        if redirects:
            for url, hits in redirects.items():
                f.write(f"  - `{url}` caused {hits} hops\n")
        else:
            f.write("- No redirect chains detected.\n")

        f.write("\n## 5. Large Uncompressed Assets\n")
        if large_assets:
            f.write("- Warning: These assets >100KB are requested heavily by bots. Ensure Gzip/Brotli is enabled:\n")
            for url, hits in large_assets.items():
                f.write(f"  - `{url}` ({hits} hits)\n")
        else:
            f.write("- All static assets seem optimized.\n")
            
        f.write("\n## 6. Orphan Pages\n")
        if orphans:
            f.write("- Crawled by bots but missing from provided Sitemap:\n")
            for url in orphans:
                f.write(f"  - `{url}`\n")
        else:
            f.write("- No orphan pages detected.\n")

def main():
    argp = argparse.ArgumentParser(description="SEO Log Analyzer")
    argp.add_argument("--log", required=True, help="Path to input .log file")
    argp.add_argument("--sitemap", required=False, help="Path to sitemap.xml")
    argp.add_argument("--outdir", default="../reports", help="Output directory for reports")
    
    args = argp.parse_args()
    
    print(f"Parsing Logs: {args.log}")
    df, malformed = parser.parse_log_file(args.log)
    print(f"Parsed {len(df)} lines cleanly. Found {malformed} malformed lines.")
    
    if df.empty:
        print("Empty DataFrame. Exiting.")
        return
        
    print("Enriching with Bot Analytics & Verification...")
    df = bot_analyzer.analyze_bots(df)
    
    print("Calculating Crawl Budget Waste...")
    df, waste_summary = crawl_budget.calculate_crawl_budget_waste(df)
    
    print("Running Advanced SEO Filters...")
    orphans = seo_advanced.get_orphan_pages(df, args.sitemap) if args.sitemap else []
    redirects = seo_advanced.detect_redirect_chains(df)
    large_assets = seo_advanced.audit_large_files(df)
    
    # Save Outputs
    os.makedirs(args.outdir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = os.path.join(args.outdir, f"SEO_Report_{timestamp}.md")
    dash_path = os.path.join(args.outdir, f"Dashboard_{timestamp}.png")
    
    print(f"Generating Output Dashboard -> {dash_path}")
    generate_dashboard(df, dash_path)
    
    print(f"Generating Output Report -> {report_path}")
    generate_markdown_report(df, waste_summary, orphans, redirects, large_assets, report_path)
    
    print("Analysis Complete!")

if __name__ == "__main__":
    main()
