# 🚀 SEO Log Analyzer 

**An insanely fast, privacy-first, client-side log analysis web application built for technical SEOs and site administrators.**

Stop uploading gigabytes of sensitive server logs to third-party dashboards and paying expensive API fees. **SEO Log Analyzer** processes massive HTTP log files directly inside your browser on your local hardware using the power of DuckDB WebAssembly (WASM).

## ✨ Key Features

*   **🔒 Absolute Privacy:** 100% of data processing utilizing DuckDB-WASM happens locally in your browser. No server logs are ever transmitted to an external server.
*   **⚡ Blazing Fast Architecture:** Built with React, Vite, and high-performance pre-compiled Regex engines, it easily chunks, parses, and persists thousands of log lines per second with extremely low memory footprints (easily handling 10GB+ files).
*   **💽 OPFS Persistence:** Upload an enormous log file once and it automatically syncs into your browser's local sandbox storage using the Origin Private File System (OPFS). View the data for days without ever needing to re-upload.
*   **🤖 Granular Bot Intelligence:** Identifies top search-engine crawlers (Googlebot, Bingbot, Yandex), tracks their uniquely hit URLs, and provides a daily **Bot Activity Timetable** tracking the exact crawl schedules for your domains.
*   **🛠️ Deep SEO Compliance Auditing:**
    *   **Trailing Slash & Case Inconsistencies:** Automatically flags spider-traps and canonical problems (e.g. tracking `domain.com/path` vs `domain.com/path/`).
    *   **Crawl Budget Waste:** Automatically generates specific `robots.txt` blocker parameters to prevent bots from spending their time endlessly bouncing on useless `?utm=` URLs.
*   **🗺️ Clean XML Sitemap Generator:** Exports ultra-clean, strict Google-compliant XML Sitemaps. The algorithm ensures all 404/5xx error pages are completely stripped (verifying the absolute *latest* status code returned by your server), outputting `lastmod`, `changefreq` and `priority` perfectly formatted to get immediately submitted to Search Console.

## 🛠️ Stack and Underlying Technologies

- **React 19 & Vite** for rapid tooling and high-end interactive UI.
- **DuckDB-WASM** for sophisticated, lightning-fast SQL querying right inside the JavaScript thread.
- **TailwindCSS & Lucide Icons** for a responsive, modern component architecture.
- **Recharts** for intuitive graphical reporting on traffic trends and status codes.

## 📥 Local Installation

If you would like to run your own local instance of the application or compile it into a build file:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/seo-log-analyzer.git

# 2. Enter the project directory
cd seo-log-analyzer

# 3. Install dependencies
npm install

# 4. Spin up the local dev server
npm run dev
```

For production builds, simply type `npm run build` and you can host the generated files cleanly packaged in the `/dist` directory via any major web hosting platform.

## 📜 Legacy Version

Historically, this project began as a Python Command-Line utility. If you are ever interested in referencing the old scripts, you can locate them completely intact inside the `legacy_python_version/` module directory at the root of the project.

## 🛡️ License

This application is built entirely upon highly permissive open-source frameworks. The codebase itself is licensed under the standard *MIT License*.

You are legally permitted to clone, distribute, use, commercially modify, or embed this software entirely free of charge with zero royalties required.
