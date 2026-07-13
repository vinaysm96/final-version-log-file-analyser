# SEO Log Analyzer

**A fast, privacy-first, client-side log analysis web application built for technical SEOs and site administrators.**

Stop uploading gigabytes of sensitive server logs to third-party dashboards and paying expensive API fees. SEO Log Analyzer processes massive HTTP log files directly inside your browser, on your own hardware, using the power of DuckDB WebAssembly (WASM).

## Key Features

**Absolute Privacy**
All data processing happens locally in your browser through DuckDB-WASM. No server logs are ever transmitted to an external server.

**Blazing Fast Architecture**
Built with React, Vite, and high-performance pre-compiled regex engines, the application chunks, parses, and persists thousands of log lines per second with a very low memory footprint, comfortably handling files of 10GB or more.

**OPFS Persistence**
Upload a large log file once, and it syncs automatically into your browser's local sandbox storage using the Origin Private File System (OPFS). Review your data for days without needing to re-upload.

**Granular Bot Intelligence**
Identifies major search engine crawlers, including Googlebot, Bingbot, and Yandex, tracks the URLs they hit, and provides a daily Bot Activity Timetable showing the exact crawl schedule for your domains.

**Deep SEO Compliance Auditing**
- Trailing slash and case inconsistencies: automatically flags spider traps and canonical issues, such as `domain.com/path` versus `domain.com/path/`.
- Crawl budget waste: automatically generates specific robots.txt blocking rules to prevent bots from wasting time on parameterized URLs such as `?utm=`.

**Clean XML Sitemap Generator**
Exports clean, Google-compliant XML sitemaps. The algorithm strips out all 404 and 5xx error pages by verifying the latest status code returned by your server, and outputs properly formatted `lastmod`, `changefreq`, and `priority` values, ready for immediate submission to Search Console.

## Technology Stack

- **React 19 and Vite** for fast tooling and a responsive, interactive interface
- **DuckDB-WASM** for sophisticated, high-performance SQL querying directly inside the browser
- **Tailwind CSS and Lucide Icons** for a clean, modern component design
- **Recharts** for clear, intuitive reporting on traffic trends and status codes

## Local Installation

To run your own local instance or build the project from source:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/seo-log-analyzer.git

# 2. Enter the project directory
cd seo-log-analyzer

# 3. Install dependencies
npm install

# 4. Start the local development server
npm run dev
```

For production builds, run `npm run build`. The generated files will be packaged cleanly in the `/dist` directory, ready to host on any major web hosting platform.

## Legacy Version

This project began as a Python command-line utility. The original scripts remain available for reference in the `legacy_python_version/` directory at the project root.

## License

This application is built on permissive open-source frameworks and is licensed under the MIT License. You are free to clone, distribute, use, modify, or embed this software commercially, at no cost and with no royalties required.
