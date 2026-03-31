# Log File Analyser - Architecture & Implementation Plan

## Project Overview
An offline-capable, browser-based log file analyser designed for SEO teams and developers. It processes large server logs (Apache/Nginx/IIS) locally using DuckDB-WASM without uploading data to external servers.

## Architecture

### Tech Stack
- **Frontend**: React 19 + Vite (TypeSafe)
- **Styling**: TailwindCSS (for "Rich Aesthetics" as per system prompt) + Recharts (Visualization)
- **Database**: DuckDB-WASM (High-performance in-browser SQL engine)
- **Parsing**: Custom Regex-based streaming parser with auto-format detection
- **State Management**: React Context + Local State

### Data Flow
1. **Ingestion**: 
   - User drags & drops large `.log` / `.gz` files.
   - File is read in **chunks** (5MB-10MB) via `FileReader` API.
2. **Parsing & Enrichment**:
   - Each chunk is processed by `logParser.ts`.
   - Format is auto-detected on the first chunk.
   - **User-Agent Classification**: UA strings are matched against known bot signatures (Googlebot, Bingbot, etc.) to populate `bot_name`.
   - **Status Code & SEO Metrics**: Metrics are extracted.
3. **Storage**:
   - Parsed structured data is bulk-inserted into DuckDB-WASM.
   - Data persists only in browser memory (session) or IndexedDB (optional persistence).
4. **Analysis & Reporting**:
   - The UI queries DuckDB using SQL for complex aggregations (e.g., "Top 404s by Bot", "Crawl Budget Waste").
   - Results are rendered in Tables and Recharts.

## Feature List

### 1. Log Parsing & Detection
- [ ] Auto-detect **Apache Combined**, **Nginx**, and **IIS W3C** formats.
- [ ] Parse: IP, Timestamp, Method, URL, Status, Size, Referrer, User Agent, Response Time.
- [ ] Handle `.gz` compression (using `DecompressionStream` if supported or library).

### 2. Bot & User Agent Analysis
- [ ] `BotClassifier`: Identify Googlebot (Desktop/Mobile), Bing, Yandex, Ahrefs, Semrush, etc.
- [ ] Distinguish "Fake Bots" (User-Agent claims Googlebot but IP pattern doesn't match - *Note: IP verification requires DNS which is hard offline, will rely on UA + basic IP range checks if possible, or mark as "Unverified"*).

### 3. SEO Reports
- [ ] **Crawl Overview**: Hits, Unique URLs, Bandwidth.
- [ ] **Status Codes**: Breakdown of 2xx, 3xx, 4xx, 5xx.
- [ ] **Redirect Chains**: recursive queries to find hops.
- [ ] **Crawl Budget Waste**: Identify low-value parameters crawling.
- [ ] **Indexability**: Cross-reference with standard "noindex" patterns (if provided) or high-frequency 404s.

### 4. Visualization & UI
- [ ] **Dashboard**: Grid layout with key metrics.
- [ ] **Data Grid**: Virtualized table for browsing millions of logs.
- [ ] **Charts**: 
    - Daily/Hourly Crawl Volume.
    - Status Code Distribution (Donut).
    - Bot Market Share (Pie).

## Implementation Strategy

1. **Refine DB Schema**: Add specific columns for `bot_name`, `bot_type` (Search Engine vs Tool), `crawl_depth`.
2. **Enhance Parser**: Implement `BotDetector` class and Regex library for multiple formats.
3. **Build Queries**: specific SQL queries for the required reports.
4. **Develop UI**: specialized components for "Overview", "Bots", "Resources", "Errors".

## Task Checklist: SEO Log File Analyser

### Phase 1: Foundation & Data Intake
- [ ] Initialize Project (React + Vite + TypeScript + TailwindCSS)
- [ ] Setup Basic UI Layout (Sidebar, Drag & Drop Zone)
- [ ] Implement File Streaming/Chunking Reader
- [ ] Implement Basic Log Parser (Common/Combined Log Format)
- [ ] Setup DuckDB-WASM for local analysis
- [ ] Verify Data Loading into DuckDB

### Phase 2: Core Analysis & Filtering
- [ ] Create Timezone Selector & Handling
- [ ] Implement Core Filters (Date, Status Code, Method)
- [ ] Build "Filter Stack" UI
- [ ] fast filtering via DuckDB queries

### Phase 3: Bot Detection & Classification
- [ ] Implement User-Agent Parsing (Browser vs Bot)
- [ ] Add Known Bot Database (Googlebot, Bingbot, etc.)
- [ ] Implement Verification Logic (Placeholder for DNS check or list match)

### Phase 4: Dashboards & Visualizations
- [ ] Build "Crawl Metrics" Dashboard
- [ ] Implement Hit Counts & Status Code Distribution Charts
- [ ] Implement Response Time Histograms

### Phase 5: SEO Specific Reports
- [ ] Indexable vs Non-indexable logic
- [ ] Redirect Chain Discovery
- [ ] Orphan Crawl & 404 Reports

### Phase 6: Advanced & Polish
- [ ] URL Normalization Controls
- [ ] Export Functionality (CSV)
- [ ] Performance Optimization (Large file handling)
