// src/content/content.js
// Main content script with enhanced modern UI and Chart Insights

let latestTable = null;
let latestMetadata = null;
let sidebar = null;
let selectionOverlay = null;
let selecting = false;
let startX = 0, startY = 0;
let aiGenerator = null;
let isGeneratingMetadata = false;
let sqlManager = null;
let chartGenerator = null;
let latestQueryResults = null;

// Chart Vision Analysis variables
let chartSelectionActive = false;
let chartSelectionOverlay = null;
let chartStartX = 0, chartStartY = 0;

// Initialize AI Generator
function initializeAI() {
  if (!aiGenerator) {
    aiGenerator = new AIMetadataGenerator();
  }
}

// Initialize Chart Generator
function initializeChartGenerator() {
  if (!chartGenerator) {
    chartGenerator = new ChartGenerator();
  }
}

// --- Listen for message from background ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "OPEN_SIDEBAR") {
    initializeAI();
    createSidebar();
  }
});

// --- Table parsing ---
function parseTableElement(table) {
  const rows = Array.from(table.querySelectorAll("tr"));
  const headerRows = rows.filter(r => r.querySelectorAll("th").length > 0);
  const dataRows = rows.filter(r => r.querySelectorAll("td").length > 0);

  const headers = [];
  if (headerRows.length > 0) {
    headerRows.forEach(row => {
      row.querySelectorAll("th").forEach((th, j) => {
        const text = th.innerText.trim();
        if (headers[j]) headers[j] += " / " + text;
        else headers[j] = text;
      });
    });
  } else if (dataRows.length > 0) {
    dataRows[0].querySelectorAll("td").forEach(td => headers.push(td.innerText.trim()));
  }

  const data = dataRows.map(row => {
    const cells = Array.from(row.querySelectorAll("td"));
    const rowData = {};
    cells.forEach((cell, idx) => {
      rowData[headers[idx] || "col" + idx] = cell.innerText.trim();
    });
    return rowData;
  });

  return { headers, data };
}

// --- Enhanced Sidebar with Modern UI ---
function createSidebar() {
  if (document.getElementById("smartTableSidebar")) return;

  sidebar = document.createElement("div");
  sidebar.id = "smartTableSidebar";
  sidebar.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 380px;
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: -4px 0 20px rgba(0,0,0,0.3);
    z-index: 99999;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    overflow-y: auto;
    animation: slideIn 0.3s ease-out;
  `;

  // Add animation keyframes and styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    #smartTableSidebar::-webkit-scrollbar {
      width: 8px;
    }
    #smartTableSidebar::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.1);
    }
    #smartTableSidebar::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.3);
      border-radius: 4px;
    }
    #smartTableSidebar::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,0.5);
    }
    .sidebar-button {
      width: 100%;
      padding: 12px;
      margin-bottom: 8px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .sidebar-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
    .sidebar-button:active {
      transform: translateY(0);
    }
    .sidebar-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .section-card {
      background: rgba(255,255,255,0.95);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #667eea;
      margin: 0 0 12px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      background: #667eea;
      color: white;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
  `;
  document.head.appendChild(style);

  sidebar.innerHTML = `
    <div style="background: rgba(255,255,255,0.15); padding: 20px; backdrop-filter: blur(10px);">
      <h2 style="margin: 0; color: white; font-size: 24px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
        🚀 Smart Table Extractor
      </h2>
      <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 13px;">
        AI-powered data extraction & analysis
      </p>
    </div>
    
    <div style="padding: 16px;">
      <!-- Extract Table Section -->
      <div class="section-card">
        <h3 class="section-title">
          <span>📊</span>
          <span>Extract Table</span>
          <span class="badge">Step 1</span>
        </h3>
        <button id="selectTableBtn" class="sidebar-button" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
          📋 Select Table Region
        </button>
        <button id="previewTableBtn" class="sidebar-button" style="background: #f5f7fa; color: #333;">
          👁️ Preview Selected Data
        </button>
        <!-- Table Preview moved here -->
        <div id="tablePreview" style="margin-top:12px; max-height:300px; overflow:auto; display:none; border:2px solid #667eea; border-radius:12px; padding:12px; background:#fff;"></div>
      </div>
      
      <!-- AI Metadata Section -->
      <div class="section-card">
        <h3 class="section-title">
          <span>🤖</span>
          <span>AI Metadata</span>
          <span class="badge">Step 2</span>
        </h3>
        <button id="generateMetadataBtn" class="sidebar-button" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white;">
          ✨ Generate Smart Metadata
        </button>
        <div id="metadataView" style="margin-top:12px; max-height:250px; overflow:auto; display:none; border:1px solid #e0e0e0; border-radius:8px; padding:8px; background:#fff; font-size:12px;"></div>
      </div>
      
      <!-- Natural Language Query Section -->
      <div class="section-card">
        <h3 class="section-title">
          <span>💬</span>
          <span>Natural Language Query</span>
          <span class="badge">Step 3</span>
        </h3>
        <button id="loadToSQLBtn" class="sidebar-button" style="background: linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%); color: white;">
          💾 Load to SQL Database
        </button>
        <textarea id="nlQueryInput" placeholder="💭 Ask anything about your data...

Examples:
• Show top 10 rows
• What's the average of column X?
• Count unique values in Y
• Filter where Z > 100" style="width:100%; height:90px; margin-bottom:8px; display:none; padding:12px; font-size:13px; border:2px solid #e0e0e0; border-radius:8px; font-family: inherit; resize: vertical;"></textarea>
        <button id="executeNLQueryBtn" class="sidebar-button" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; display:none;">
          🔍 Execute Query
        </button>
        <div id="queryResults" style="margin-top:12px; max-height:400px; overflow:auto; display:none; border:1px solid #e0e0e0; border-radius:8px; padding:8px; background:#fff; font-size:12px;"></div>
        
        <!-- Chart Controls -->
        <div id="chartControls" style="margin-top:12px; display:none;">
          <button id="generateChartBtn" class="sidebar-button" style="background: linear-gradient(135deg, #FA8BFF 0%, #2BD2FF 50%, #2BFF88 100%); color: white;">
            📊 Visualize with AI Chart
          </button>
        </div>
        <div id="chartContainer" style="margin-top:12px; display:none; border:2px solid #667eea; border-radius:12px; padding:16px; background:#fff; max-height:500px; overflow:auto;"></div>
      </div>
      
      <!-- Download Section -->
      <div class="section-card">
        <h3 class="section-title">
          <span>📥</span>
          <span>Export Data</span>
        </h3>
        <button id="downloadCSVBtn" class="sidebar-button" style="background: #2ecc71; color: white;">
          📄 Download as CSV
        </button>
        <button id="downloadMetadataBtn" class="sidebar-button" style="background: #3498db; color: white;">
          📋 Download Metadata JSON
        </button>
      </div>
      
      <!-- Chart Insights Section -->
      <div class="section-card">
        <h3 class="section-title">
          <span>📊</span>
          <span>Chart Insights</span>
          <span class="badge">AI</span>
        </h3>
        <button id="selectChartBtn" class="sidebar-button" style="background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%); color: white;">
          📸 Analyze Chart or Image
        </button>
        <div id="chartAnalysisResults" style="margin-top:12px; max-height:450px; overflow:auto; display:none; border-radius:8px;"></div>
      </div>
      
      <!-- JSON View Section -->
      <div class="section-card">
        <h3 class="section-title">
          <span>🔍</span>
          <span>Raw Data View</span>
        </h3>
        <button id="viewJSONBtn" class="sidebar-button" style="background: #34495e; color: white;">
          { } View JSON Format
        </button>
        <textarea id="jsonView" style="width:100%; height:150px; display:none; font-family:'Courier New', monospace; font-size:11px; margin-top:8px; padding:12px; border:2px solid #e0e0e0; border-radius:8px; background:#f8f9fa; resize: vertical;"></textarea>
      </div>
      
      <!-- Close Button -->
      <button id="closeSidebarBtn" class="sidebar-button" style="background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); color: white; margin-top: 16px; font-weight: 600;">
        ✕ Close Panel
      </button>
    </div>
  `;

  document.body.appendChild(sidebar);

  // Event listeners
  document.getElementById("selectTableBtn").addEventListener("click", enableRectangleSelection);
  document.getElementById("previewTableBtn").addEventListener("click", showPreview);
  document.getElementById("generateMetadataBtn").addEventListener("click", generateMetadata);
  document.getElementById("loadToSQLBtn").addEventListener("click", loadTableToSQL);
  document.getElementById("executeNLQueryBtn").addEventListener("click", executeNaturalLanguageQuery);
  document.getElementById("generateChartBtn").addEventListener("click", generateChartFromResults);
  document.getElementById("downloadCSVBtn").addEventListener("click", downloadCSV);
  document.getElementById("downloadMetadataBtn").addEventListener("click", downloadMetadataJSON);
  document.getElementById("viewJSONBtn").addEventListener("click", toggleJSONView);
  document.getElementById("selectChartBtn").addEventListener("click", startChartSelection);
  document.getElementById("closeSidebarBtn").addEventListener("click", closeSidebar);
}

// --- Rectangle selection ---
function enableRectangleSelection() {
  if (selecting) return;
  selecting = true;

  selectionOverlay = document.createElement("div");
  selectionOverlay.style.position = "absolute";
  selectionOverlay.style.border = "2px dashed #ff9800";
  selectionOverlay.style.background = "rgba(255,152,0,0.1)";
  selectionOverlay.style.zIndex = 99998;
  selectionOverlay.style.pointerEvents = "none";
  document.body.appendChild(selectionOverlay);

  function onMouseDown(e) {
    startX = e.pageX;
    startY = e.pageY;
    selectionOverlay.style.left = startX + "px";
    selectionOverlay.style.top = startY + "px";
    selectionOverlay.style.width = "0px";
    selectionOverlay.style.height = "0px";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e) {
    const x = Math.min(e.pageX, startX);
    const y = Math.min(e.pageY, startY);
    const w = Math.abs(e.pageX - startX);
    const h = Math.abs(e.pageY - startY);
    selectionOverlay.style.left = x + "px";
    selectionOverlay.style.top = y + "px";
    selectionOverlay.style.width = w + "px";
    selectionOverlay.style.height = h + "px";
  }

  function onMouseUp() {
    const rect = selectionOverlay.getBoundingClientRect();
    const tables = Array.from(document.querySelectorAll("table, [role='grid'], .dataTable"))
      .filter(t => t.offsetParent !== null)
      .filter(t => {
        const r = t.getBoundingClientRect();
        return !(r.bottom < rect.top || r.top > rect.bottom || r.right < rect.left || r.left > rect.right);
      });

    if (tables.length > 0) {
      latestTable = parseTableElement(tables[0]);
      alert(`✅ Table selected! ${latestTable.data.length} rows, ${latestTable.headers.length} columns.`);
    } else {
      alert("⚠️ No table detected in selection.");
    }

    cleanup();
  }

  function cleanup() {
    document.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    if (selectionOverlay) selectionOverlay.remove();
    selecting = false;
  }

  document.addEventListener("mousedown", onMouseDown);
}

// --- Preview Table ---
function showPreview() {
  if (!latestTable) return alert("No table selected. Please select a table first.");
  const container = document.getElementById("tablePreview");
  container.style.display = "block";
  container.innerHTML = "";

  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.width = "100%";
  table.style.fontSize = "11px";

  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  latestTable.headers.forEach(h => {
    const th = document.createElement("th");
    th.innerText = h;
    th.style.border = "1px solid #e0e0e0";
    th.style.padding = "8px";
    th.style.background = "#667eea";
    th.style.color = "white";
    th.style.fontWeight = "600";
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  latestTable.data.forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.style.background = idx % 2 === 0 ? "#f8f9fa" : "white";
    latestTable.headers.forEach(h => {
      const td = document.createElement("td");
      td.innerText = row[h] || "";
      td.style.border = "1px solid #e0e0e0";
      td.style.padding = "6px";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.appendChild(table);
}

// --- Download CSV ---
function downloadCSV() {
  if (!latestTable) return alert("No table selected.");
  const { headers, data } = latestTable;
  const rows = [headers, ...data.map(row => headers.map(h => row[h] || ""))];
  const csvContent = rows.map(r => r.map(c => `"${c.replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "table.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// --- Download Metadata JSON ---
function downloadMetadataJSON() {
  if (!latestMetadata) return alert("No metadata available. Generate it first.");
  
  const blob = new Blob([JSON.stringify(latestMetadata, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "metadata.json";
  a.click();
  URL.revokeObjectURL(url);
}

// --- Toggle JSON View ---
function toggleJSONView() {
  if (!latestTable && !latestMetadata) return alert("No data available.");
  const jsonView = document.getElementById("jsonView");
  if (jsonView.style.display === "none") {
    jsonView.value = JSON.stringify(latestMetadata || latestTable, null, 2);
    jsonView.style.display = "block";
  } else {
    jsonView.style.display = "none";
  }
}

// --- Generate AI Metadata ---
async function generateMetadata() {
  if (!latestTable) return alert("No table selected.");
  if (isGeneratingMetadata) return alert("Metadata generation already in progress...");

  isGeneratingMetadata = true;
  const btn = document.getElementById("generateMetadataBtn");
  const originalText = btn.innerText;
  btn.innerText = "⏳ Generating...";
  btn.disabled = true;

  try {
    initializeAI();
    const metadata = await aiGenerator.generateTableMetadata(
      latestTable.headers,
      latestTable.data
    );

    latestMetadata = metadata;
    displayMetadata(metadata);
    document.getElementById("jsonView").value = JSON.stringify(metadata, null, 2);
    alert("✅ Metadata generated successfully!");

  } catch (error) {
    console.error("Error generating metadata:", error);
    alert("❌ Error generating metadata. Please check console.");
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
    isGeneratingMetadata = false;
  }
}

// --- Display Metadata ---
function displayMetadata(metadata) {
  const container = document.getElementById("metadataView");
  container.style.display = "block";
  container.innerHTML = "";

  const descDiv = document.createElement("div");
  descDiv.style.marginBottom = "10px";
  descDiv.style.padding = "12px";
  descDiv.style.background = "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)";
  descDiv.style.borderRadius = "8px";
  descDiv.style.borderLeft = "4px solid #667eea";
  descDiv.innerHTML = `<strong style="color: #667eea;">📋 Table Description:</strong><br><span style="color: #333; font-size: 12px; line-height: 1.6;">${metadata.table_description}</span>`;
  container.appendChild(descDiv);

  const colsDiv = document.createElement("div");
  colsDiv.innerHTML = `<strong style="color: #667eea; font-size: 14px;">📊 Columns (${metadata.column_count}):</strong><hr style="margin:8px 0; border: none; border-top: 2px solid #e0e0e0;">`;

  metadata.columns.forEach(col => {
    const colCard = document.createElement("div");
    colCard.style.marginBottom = "10px";
    colCard.style.padding = "10px";
    colCard.style.border = "1px solid #e0e0e0";
    colCard.style.borderRadius = "8px";
    colCard.style.background = "#f8f9fa";
    colCard.innerHTML = `
      <strong style="color: #667eea;">${col.column_name}</strong> <span style="color:#888; font-size: 11px;">(${col.data_type})</span><br>
      <small style="color: #555; line-height: 1.5;">${col.description}</small><br>
      <em style="color:#999; font-size:10px;">💡 Samples: ${col.sample_values.join(", ")}</em>
    `;
    colsDiv.appendChild(colCard);
  });

  container.appendChild(colsDiv);
}

// --- Load Table to SQL ---
async function loadTableToSQL() {
  if (!latestTable) return alert("No table selected. Please select a table first.");
  
  const btn = document.getElementById("loadToSQLBtn");
  btn.disabled = true;
  btn.innerText = "⏳ Loading...";
  
  try {
    if (sqlManager) {
      console.log("Cleaning up previous SQL database...");
      sqlManager.destroy();
      sqlManager = null;
    }
    
    if (!latestMetadata) {
      btn.innerText = "⏳ Generating metadata...";
      console.log("Auto-generating metadata for better SQL queries...");
      
      initializeAI();
      latestMetadata = await aiGenerator.generateTableMetadata(
        latestTable.headers,
        latestTable.data
      );
      
      displayMetadata(latestMetadata);
      document.getElementById("jsonView").value = JSON.stringify(latestMetadata, null, 2);
      
      console.log("✅ Metadata auto-generated");
    }
    
    btn.innerText = "⏳ Loading to SQL...";
    sqlManager = new SQLQueryManager();
    await sqlManager.initialize();
    await sqlManager.createTableFromJSON(
      latestTable.headers,
      latestTable.data,
      latestMetadata
    );
    
    document.getElementById("nlQueryInput").style.display = "block";
    document.getElementById("executeNLQueryBtn").style.display = "block";
    
    btn.innerText = "✅ Loaded Successfully";
    btn.style.background = "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)";
    alert(`✅ Table loaded to SQL database with AI metadata!\n\n${latestTable.data.length} rows loaded.\n\nEnhanced with:\n• Column descriptions\n• Sample values\n• Data type context\n\nAsk questions now!`);
    
  } catch (error) {
    console.error("Error loading table to SQL:", error);
    alert("❌ Error loading table. Check console for details.");
    btn.innerText = "💾 Load to SQL Database";
    btn.style.background = "linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)";
    btn.disabled = false;
  }
}

// --- Execute Natural Language Query ---
async function executeNaturalLanguageQuery() {
  if (!sqlManager) return alert("Load table to SQL first!");
  
  const question = document.getElementById("nlQueryInput").value.trim();
  if (!question) return alert("Please enter a question.");
  
  const btn = document.getElementById("executeNLQueryBtn");
  const resultsDiv = document.getElementById("queryResults");
  
  btn.disabled = true;
  btn.innerText = "⏳ Querying...";
  resultsDiv.style.display = "block";
  resultsDiv.innerHTML = "<p style='padding:10px;'>🤖 Processing your question and generating insights...</p>";
  
  document.getElementById("chartControls").style.display = "none";
  document.getElementById("chartContainer").style.display = "none";
  
  try {
    const { sql, explanation, results, analysis } = await sqlManager.queryWithNaturalLanguage(question);
    
    latestQueryResults = { question, sql, explanation, results, analysis };
    
    resultsDiv.innerHTML = '';
    
    // Display AI Analysis
    if (analysis) {
      const analysisDiv = document.createElement("div");
      analysisDiv.style.marginBottom = "15px";
      analysisDiv.style.padding = "12px";
      analysisDiv.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
      analysisDiv.style.borderRadius = "8px";
      analysisDiv.style.color = "white";
      analysisDiv.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
      
      analysisDiv.innerHTML = `
        <div style="margin-bottom:12px;">
          <strong style="font-size:14px;">💡 AI Analysis</strong>
        </div>
        
        <div style="background:rgba(255,255,255,0.15); padding:12px; border-radius:6px; margin-bottom:10px;">
          <span style="font-size:13px; line-height:1.5;">${analysis.directAnswer}</span>
        </div>
        
        ${analysis.keyInsights && analysis.keyInsights.length > 0 ? `
        <div style="background:rgba(255,255,255,0.15); padding:12px; border-radius:6px;">
          <strong style="margin-bottom:8px; display:block;">Key Insights:</strong>
          <ul style="margin:0; padding-left:20px; font-size:12px; line-height:1.6;">
            ${analysis.keyInsights.map(insight => `<li style="margin-bottom:6px;">${insight}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
      `;
      
      resultsDiv.appendChild(analysisDiv);
    }
    
    // Display SQL Query Info
    const sqlInfoDiv = document.createElement("div");
    sqlInfoDiv.style.marginBottom = "10px";
    sqlInfoDiv.style.padding = "8px";
    sqlInfoDiv.style.background = "#f8f9fa";
    sqlInfoDiv.style.borderRadius = "8px";
    sqlInfoDiv.style.fontSize = "11px";
    sqlInfoDiv.style.borderLeft = "3px solid #667eea";
    
    sqlInfoDiv.innerHTML = `
      <details>
        <summary style="cursor:pointer; font-weight:bold; color:#667eea;">
          🔍 Query Details (click to expand)
        </summary>
        <div style="margin-top:8px;">
          <strong>Question:</strong> ${question}<br>
          <strong>SQL:</strong> ode style="background:#fff; padding:4px 8px; display:block; margin-top:4px; border-radius:4px;x; font-family: monospace;">${sql}</code>
          ${explanation ? `<strong>Explanation:</strong> ${explanation}` : ''}
        </div>
      </details>
    `;
    
    resultsDiv.appendChild(sqlInfoDiv);
    
    // Display Raw Data Table
    if (results.values.length === 0) {
      const noResultsDiv = document.createElement("div");
      noResultsDiv.style.padding = "16px";
      noResultsDiv.style.color = "#666";
      noResultsDiv.style.textAlign = "center";
      noResultsDiv.style.background = "#f8f9fa";
      noResultsDiv.style.borderRadius = "8px";
      noResultsDiv.innerText = "No results found.";
      resultsDiv.appendChild(noResultsDiv);
    } else {
      const tableContainer = document.createElement("div");
      tableContainer.style.marginTop = "10px";
      
      const tableToggle = document.createElement("details");
      tableToggle.innerHTML = `
        <summary style="cursor:pointer; padding:8px; background:linear-gradient(135deg, #11998e15 0%, #38ef7d15 100%); border-radius:8px; font-weight:bold; color:#11998e; margin-bottom:10px;">
          📊 View Raw Data (${results.values.length} rows)
        </summary>
      `;
      
      const table = document.createElement("table");
      table.style.borderCollapse = "collapse";
      table.style.width = "100%";
      table.style.fontSize = "11px";
      table.style.marginTop = "10px";
      
      const thead = document.createElement("thead");
      const trHead = document.createElement("tr");
      results.columns.forEach(col => {
        const th = document.createElement("th");
        th.innerText = col;
        th.style.border = "1px solid #e0e0e0";
        th.style.padding = "8px";
        th.style.background = "#667eea";
        th.style.color = "white";
        th.style.fontWeight = "600";
        trHead.appendChild(th);
      });
      thead.appendChild(trHead);
      table.appendChild(thead);
      
      const tbody = document.createElement("tbody");
      results.values.forEach((row, idx) => {
        const tr = document.createElement("tr");
        tr.style.background = idx % 2 === 0 ? "#f8f9fa" : "white";
        row.forEach(cell => {
          const td = document.createElement("td");
          td.innerText = cell !== null ? cell : "NULL";
          td.style.border = "1px solid #e0e0e0";
          td.style.padding = "6px";
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      
      tableToggle.appendChild(table);
      tableContainer.appendChild(tableToggle);
      resultsDiv.appendChild(tableContainer);
      
      if (results.columns.length >= 1 && results.values.length > 0) {
        document.getElementById("chartControls").style.display = "block";
      }
    }
    
  } catch (error) {
    console.error("Query error:", error);
    resultsDiv.innerHTML = `<div style="padding:12px; background:#ffebee; border-radius:8px; color:#c62828; border-left: 4px solid #f44336;">
      <strong>❌ Error:</strong> ${error.message}
    </div>`;
  } finally {
    btn.innerText = "🔍 Execute Query";
    btn.disabled = false;
  }
}

// --- Generate Chart from Results ---
async function generateChartFromResults() {
  console.log("🎨 Starting chart generation...");
  
  if (!latestQueryResults) {
    alert("No query results available. Execute a query first.");
    return;
  }
  
  if (!latestMetadata) {
    alert("Metadata not available. Please generate metadata first.");
    return;
  }
  
  const btn = document.getElementById("generateChartBtn");
  btn.disabled = true;
  btn.innerText = "⏳ Generating...";
  
  try {
    initializeChartGenerator();
    
    const chartContainer = document.getElementById("chartContainer");
    chartContainer.style.display = "block";
    
    const result = await chartGenerator.generateChartWithAI(
      chartContainer,
      latestMetadata,
      latestQueryResults.question,
      latestQueryResults.results.columns,
      latestQueryResults.results.values
    );
    
    if (result) {
      console.log("✅ Chart generation completed successfully");
    }
    
  } catch (error) {
    console.error("❌ Chart generation error:", error);
    const chartContainer = document.getElementById("chartContainer");
    chartContainer.innerHTML = `
      <div style="padding:15px; color:#c62828; border:2px solid #ffcdd2; background:#ffebee; border-radius:8px;">
        <strong>❌ Chart Generation Failed</strong><br>
        ${error.message}
      </div>
    `;
  } finally {
    btn.innerText = "📊 Visualize with AI Chart";
    btn.disabled = false;
  }
}

// ========================================
// CHART INSIGHTS (VISION ANALYSIS)
// ========================================

async function checkAIAvailability() {
  try {
    if (typeof LanguageModel === 'undefined') {
      return {
        available: false,
        message: "LanguageModel API not found. Enable chrome://flags/#prompt-api-for-gemini-nano"
      };
    }
    
    try {
      const testSession = await LanguageModel.create({
        initialPrompts: [{ role: 'system', content: 'Test' }],
        language: 'en'
      });
      testSession.destroy?.();
      
      return {
        available: true,
        message: "AI ready for vision analysis"
      };
    } catch (sessionError) {
      return {
        available: false,
        message: `Model not ready: ${sessionError.message}`
      };
    }
    
  } catch (error) {
    return {
      available: false,
      message: `Error: ${error.message}`
    };
  }
}

async function startChartSelection() {
  if (chartSelectionActive) return;
  
  const aiStatus = await checkAIAvailability();
  
  if (!aiStatus.available) {
    alert(`⚠️ AI Vision Not Available\n\n${aiStatus.message}\n\nSetup Instructions:\n1. Go to chrome://flags/#prompt-api-for-gemini-nano\n2. Set to "Enabled"\n3. Go to chrome://flags/#optimization-guide-on-device-model\n4. Set to "Enabled BypassPerfRequirement"\n5. Restart Chrome\n6. Check chrome://components/ for model download`);
    return;
  }
  
  alert("📸 Chart Analysis Mode\n\nDraw a rectangle around the chart or image you want to analyze.\n\nPress ESC to cancel.");
  
  chartSelectionActive = true;
  
  chartSelectionOverlay = document.createElement("div");
  chartSelectionOverlay.style.position = "absolute";
  chartSelectionOverlay.style.border = "3px solid #FF6B6B";
  chartSelectionOverlay.style.backgroundColor = "rgba(255, 107, 107, 0.2)";
  chartSelectionOverlay.style.pointerEvents = "none";
  chartSelectionOverlay.style.zIndex = "99997";
  chartSelectionOverlay.style.display = "none";
  document.body.appendChild(chartSelectionOverlay);
  
  document.addEventListener("mousedown", onChartMouseDown);
  document.addEventListener("keydown", cancelChartSelection);
}

function onChartMouseDown(e) {
  if (!chartSelectionActive) return;
  if (e.target.closest("#smartTableSidebar")) return;
  
  chartStartX = e.pageX;
  chartStartY = e.pageY;
  
  chartSelectionOverlay.style.left = chartStartX + "px";
  chartSelectionOverlay.style.top = chartStartY + "px";
  chartSelectionOverlay.style.width = "0px";
  chartSelectionOverlay.style.height = "0px";
  chartSelectionOverlay.style.display = "block";
  
  document.addEventListener("mousemove", onChartMouseMove);
  document.addEventListener("mouseup", onChartMouseUp);
}

function onChartMouseMove(e) {
  if (!chartSelectionActive) return;
  
  const x = Math.min(e.pageX, chartStartX);
  const y = Math.min(e.pageY, chartStartY);
  const w = Math.abs(e.pageX - chartStartX);
  const h = Math.abs(e.pageY - chartStartY);
  
  chartSelectionOverlay.style.left = x + "px";
  chartSelectionOverlay.style.top = y + "px";
  chartSelectionOverlay.style.width = w + "px";
  chartSelectionOverlay.style.height = h + "px";
}

async function onChartMouseUp(e) {
  if (!chartSelectionActive) return;
  
  document.removeEventListener("mousemove", onChartMouseMove);
  document.removeEventListener("mouseup", onChartMouseUp);
  
  const rect = {
    x: parseInt(chartSelectionOverlay.style.left),
    y: parseInt(chartSelectionOverlay.style.top),
    width: parseInt(chartSelectionOverlay.style.width),
    height: parseInt(chartSelectionOverlay.style.height)
  };
  
  if (rect.width < 50 || rect.height < 50) {
    cleanupChartSelection();
    alert("Selection too small. Please select a larger area.");
    return;
  }
  
  cleanupChartSelection();
  await captureAndAnalyzeSelectedArea(rect);
}

function cancelChartSelection(e) {
  if (e.key === "Escape" && chartSelectionActive) {
    cleanupChartSelection();
    alert("Chart selection cancelled.");
  }
}

function cleanupChartSelection() {
  chartSelectionActive = false;
  document.removeEventListener("mousedown", onChartMouseDown);
  document.removeEventListener("mousemove", onChartMouseMove);
  document.removeEventListener("mouseup", onChartMouseUp);
  document.removeEventListener("keydown", cancelChartSelection);
  
  if (chartSelectionOverlay) {
    chartSelectionOverlay.remove();
    chartSelectionOverlay = null;
  }
}

async function captureAndAnalyzeSelectedArea(rect) {
  const resultsDiv = document.getElementById("chartAnalysisResults");
  resultsDiv.style.display = "block";
  resultsDiv.innerHTML = "<p style='padding:10px;'>📸 Capturing selected area...</p>";
  
  try {
    const imageData = await captureRectangleAsImage(rect);
    resultsDiv.innerHTML = "<p style='padding:10px;'>🤖 Analyzing with AI Vision...</p>";
    const analysis = await analyzeChartWithVisionAPI(imageData);
    displayChartAnalysisResults(resultsDiv, analysis, imageData);
  } catch (error) {
    console.error("Chart analysis error:", error);
    resultsDiv.innerHTML = `
      <div style="padding:12px; background:#ffebee; border-radius:8px; color:#c62828; border-left: 4px solid #f44336;">
        <strong>❌ Error:</strong> ${error.message}
      </div>
    `;
  }
}

async function captureRectangleAsImage(rect) {
  try {
    console.log("📸 Capturing rectangle area:", rect);
    
    if (typeof html2canvas !== 'undefined') {
      console.log("Using html2canvas for capture");
      
      const canvas = await html2canvas(document.body, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        scrollX: 0,
        scrollY: 0,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
        useCORS: true,
        allowTaint: true,
        logging: false
      });
      
      const imageData = canvas.toDataURL('image/png');
      console.log("✅ Screenshot captured");
      return imageData;
    }
    
    console.log("html2canvas not available, using fallback");
    const canvas = document.createElement('canvas');
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    return canvas.toDataURL('image/png');
    
  } catch (error) {
    console.error("Error capturing rectangle:", error);
    throw new Error(`Screenshot failed: ${error.message}`);
  }
}

async function analyzeChartWithVisionAPI(imageData) {
  try {
    console.log("🔍 Creating multimodal AI session...");
    
    if (typeof LanguageModel === 'undefined') {
      throw new Error("LanguageModel API not available");
    }
    
    const session = await LanguageModel.create({
      initialPrompts: [
        {
          role: 'system',
          content: 'You are an expert data visualization analyst who provides detailed insights about charts, graphs, and visual data representations.'
        }
      ],
      expectedInputs: [{ type: 'image' }],
      language: 'en'
    });
    
    console.log("✅ Session created successfully");
    
    const imageFile = await base64ToFile(imageData, 'chart.png');
    console.log("✅ Image file ready");
    
    await session.append([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            value: `Analyze this chart/graph/image in detail.

Provide your analysis in the following JSON format:
{
  "chartDescription": "2-3 sentences describing what type of visualization this is, what data it shows, and what the axes/labels represent",
  "analysis": [
    "First detailed analysis point about patterns, trends, or distributions you see",
    "Second analysis point about standout elements, peaks, valleys, or notable features",
    "Third analysis point about the data distribution, layout, or visual design",
    "Fourth analysis point about any anomalies, outliers, or interesting aspects"
  ],
  "keyFindings": [
    "First key finding or insight from the data",
    "Second key finding or conclusion you can draw",
    "Third key finding connecting different data points",
    "Fourth key finding about implications or meaning"
  ]
}

Be specific with numbers, names, and values you see in the visualization. Focus on actionable insights.`
          },
          {
            type: 'image',
            value: imageFile
          }
        ]
      }
    ]);
    
    console.log("✅ Image appended to session");
    
    const result = await session.prompt("Provide the analysis in the JSON format specified above.");
    console.log("✅ Raw response:", result);
    
    let analysis;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = JSON.parse(result);
      }
    } catch (parseError) {
      console.warn("JSON parse failed, using fallback:", parseError);
      analysis = {
        chartDescription: result.substring(0, 200),
        analysis: ["Full response: " + result.substring(0, 150)],
        keyFindings: ["See full analysis above"]
      };
    }
    
    console.log("✅ Analysis complete:", analysis);
    
    if (session.destroy) {
      session.destroy();
    }
    
    return analysis;
    
  } catch (error) {
    console.error("❌ Vision API error:", error);
    throw new Error(`Vision API failed: ${error.message}\n\nMake sure:\n1. Flags enabled at chrome://flags\n2. Model downloaded at chrome://components/\n3. Using Chrome 139+ or Canary`);
  }
}

async function base64ToFile(base64Data, filename) {
  const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  const blob = new Blob([ab], { type: 'image/png' });
  return new File([blob], filename, { type: 'image/png' });
}

function displayChartAnalysisResults(container, analysis, imageData) {
  container.innerHTML = `
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
      <!-- Image Preview - FIXED -->
      <div style="position: relative; background: #f8f9fa; padding: 16px; text-align: center; border-bottom: 3px solid #667eea;">
        <img src="${imageData}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: block; margin: 0 auto;" alt="Chart Screenshot">
        <div style="position: absolute; top: 24px; right: 24px; background: rgba(102, 126, 234, 0.9); color: white; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; backdrop-filter: blur(10px);">
          AI ANALYZED
        </div>
      </div>
      
      <!-- Analysis Content -->
      <div style="padding: 20px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
          <span style="font-size: 24px;">📊</span>
          <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #667eea;">Chart Insights</h3>
        </div>
        
        ${analysis.chartDescription ? `
        <div style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); padding: 16px; border-radius: 10px; margin-bottom: 14px; border-left: 4px solid #667eea;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 16px;">📝</span>
            <strong style="font-size: 14px; color: #667eea;">Summary</strong>
          </div>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #333;">${analysis.chartDescription}</p>
        </div>
        ` : ''}
        
        ${analysis.analysis && analysis.analysis.length > 0 ? `
        <div style="background: linear-gradient(135deg, #11998e15 0%, #38ef7d15 100%); padding: 16px; border-radius: 10px; margin-bottom: 14px; border-left: 4px solid #11998e;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="font-size: 16px;">🔍</span>
            <strong style="font-size: 14px; color: #11998e;">Analysis</strong>
          </div>
          <ul style="margin: 0; padding-left: 20px; list-style: none;">
            ${analysis.analysis.map((item, idx) => `
              <li style="margin-bottom: 10px; font-size: 13px; line-height: 1.6; color: #333; position: relative;">
                <span style="position: absolute; left: -20px; color: #11998e; font-weight: 600;">${idx + 1}.</span>
                ${item}
              </li>
            `).join('')}
          </ul>
        </div>
        ` : ''}
        
        ${analysis.keyFindings && analysis.keyFindings.length > 0 ? `
        <div style="background: linear-gradient(135deg, #f093fb15 0%, #f5576c15 100%); padding: 16px; border-radius: 10px; border-left: 4px solid #f093fb;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="font-size: 16px;">💡</span>
            <strong style="font-size: 14px; color: #f093fb;">Key Findings</strong>
          </div>
          <ul style="margin: 0; padding-left: 20px; list-style: none;">
            ${analysis.keyFindings.map((finding, idx) => `
              <li style="margin-bottom: 10px; font-size: 13px; line-height: 1.6; color: #333; position: relative;">
                <span style="position: absolute; left: -20px; color: #f093fb; font-weight: 600;">${idx + 1}.</span>
                ${finding}
              </li>
            `).join('')}
          </ul>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

function closeSidebar() {
  if (sqlManager) {
    sqlManager.destroy();
    sqlManager = null;
  }
  
  if (aiGenerator) {
    aiGenerator.closeSession();
    aiGenerator = null;
  }
  
  if (chartGenerator) {
    chartGenerator.destroy();
    chartGenerator = null;
  }
  
  if (sidebar) {
    sidebar.remove();
    sidebar = null;
  }
  
  if (chartSelectionActive) {
    cleanupChartSelection();
  }
  
  latestTable = null;
  latestMetadata = null;
  latestQueryResults = null;
}
