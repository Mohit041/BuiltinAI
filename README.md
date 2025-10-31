#  Smart Table Extractor with AI

A powerful Chrome extension that transforms web table data extraction and analysis using Chrome's built-in AI. Extract tables, query them with natural language, generate visualizations, and analyze charts with AI vision capabilities—all running locally on your device.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Chrome](https://img.shields.io/badge/Chrome-139%2B-green.svg)
![AI](https://img.shields.io/badge/AI-Gemini%20Nano-purple.svg)

## Key Features

### Core Capabilities
- **Smart Table Extraction**: Select any table on a webpage with intuitive rectangle selection
- **AI-Powered Metadata Generation**: Automatically generates intelligent descriptions and data types
- **Natural Language Queries**: Ask questions about your data in plain English
- **AI Chart Visualization**: Auto-generate beautiful charts from query results
- **Chart Insights**: Analyze any chart/graph with AI vision to extract insights
- **Multi-format Export**: Download as CSV or JSON


##  API Usage & Feature Mapping

### Chrome Built-in AI APIs

####  Prompt API 


**Used in:**

1. **AI Metadata Generation**
  - Purpose: Generates intelligent table descriptions, column metadata, data types, and sample values
  - File: `src/content/ai-metadata-generator.js`

2. **Natural Language to SQL Conversion**
  - Purpose: Converts user questions into SQL queries with context from metadata
  - File: `src/content/sql-query.js` → `generateSQLFromQuestion()`

3. **Query Results Analysis**
  - Purpose: Analyzes SQL query results and generates human-readable insights
  - File: `src/content/sql-query.js` → `analyzeResults()`

4. **Chart Type Selection**
  - Purpose: Intelligently selects the best chart type based on data
  - File: `src/content/chart-generator.js` → `selectChartTypeWithAI()`

#### 2. **Multimodal Prompt API (Vision)**


**Used in:**
- **Chart Insights (Vision Analysis)**
  - Purpose: Analyzes screenshots of charts/graphs to extract insights, patterns, and findings
  - File: `src/content/content.js` → `analyzeChartWithVisionAPI()`
  - Input: Image File object + text prompt
  - Method: `session.append()` with multimodal content array
  - Output: JSON with summary, analysis points, and key findings


##  Prerequisites

### Required Software
- **Google Chrome 139+** or **Chrome Canary** (for AI features)
- Operating System: Windows, macOS, or Linux

### Chrome Flags Setup (Critical for AI Features)

1. **Enable Prompt API for Gemini Nano**
   - Navigate to: `chrome://flags/#prompt-api-for-gemini-nano`
   - Set to: **"Enabled"**

2. **Enable Optimization Guide**
   - Navigate to: `chrome://flags/#optimization-guide-on-device-model`
   - Set to: **"Enabled BypassPerfRequirement"**

3. **Restart Chrome** completely

4. **Download AI Model**
   - Navigate to: `chrome://components/`
   - Find: **"Optimization Guide On Device Model"**
   - Click: **"Check for update"**
   - Wait for ~2GB model download to complete





### Project Structure
```
smart-table-extractor/
├── manifest.json                    
├── src/
│   ├── background/
│   │   └── background.js           
│   └── content/
│       ├── content.js              # Main content script (UI + orchestration)
│       ├── ai-metadata-generator.js # AI metadata generation
│       ├── sql-query.js            # SQL query manager
│       └── chart-generator.js      # Chart generation with AI
├── lib/
│   ├── sql-wasm.js                 
│   ├── sql-wasm.wasm               
│   ├── chart.umd.js                
│   └── html2canvas.min.js         
├── LICENSE                         
├── README.md                      
└── TESTING.md                       
```

##  Usage Guide

### Step 1: Extract Table
1. Click extension icon on any webpage with tables
2. Click **"▢ Select Table Region"**
3. Draw a rectangle around the table you want to extract
4. Click **"◉ Preview Selected Data"** to verify

### Step 2: Query with Natural Language
1. Click **"▶ Query Using Natural Language"**
2. Type questions like your data
3. Click **"▷ Execute Query"**
4. View AI-generated insights and raw data

### Step 4: Visualize Data
1. After querying, click **"▦ Visualize Data using AI"**
2. AI automatically selects best chart type
3. Interactive Chart.js visualization appears

### Step 5: Analyze Charts (Vision AI)
1. Click **"◎ Analyze Chart or Image"**
2. Draw rectangle around any chart/graph on the page
3. AI vision analyzes the image and provides:
   - Summary
   - Detailed analysis
   - Key findings

### Export Options
- **CSV**: Click "▤ Download as CSV"
- **Metadata JSON**: Click "▼ Download as JSON"



### Key Components

1. **AI Metadata Generator** (`ai-metadata-generator.js`)
   - Analyzes table structure using Prompt API
   - Generates intelligent descriptions
   - Identifies data types from values

2. **SQL Query Manager** (`sql-query.js`)
   - Converts natural language to SQL via Prompt API
   - Executes queries in SQL.js
   - Analyzes results with AI

3. **Chart Generator** (`chart-generator.js`)
   - AI-powered chart type selection
   - Renders with Chart.js
   - Handles multiple chart types

4. **Content Script** (`content.js`)
   - Modern gradient UI with smooth animations
   - Rectangle selection tool for tables and charts
   - Vision analysis orchestration



## License

This project is licensed under the **MIT License** - see the LICENSE file for details.

```
MIT License

Copyright (c) 2025 Mohith Charan and Riya Narayan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

