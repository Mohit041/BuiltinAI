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

// Sidebar resize variables
let isResizing = false;
let sidebarWidth = 380;

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

  // Adjust body margin for sidebar
  document.body.style.marginRight = sidebarWidth + "px";
  document.body.style.transition = "margin-right 0.3s ease";

  sidebar = document.createElement("div");
  sidebar.id = "smartTableSidebar";
  sidebar.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: ${sidebarWidth}px;
    height: 100%;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-left: 1px solid rgba(0, 0, 0, 0.1);
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
      background: rgba(0, 0, 0, 0.1);
    }
    #smartTableSidebar::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
    }
    #smartTableSidebar::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.5);
    }
    .sidebar-button {
      width: 100%;
      border: none;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
      font-family: inherit;
    }
    .sidebar-button:hover {
      background: rgba(0, 0, 0, 0.05) !important;
      transform: translateY(-1px);
    }
    .sidebar-button:active {
      transform: translateY(0);
    }
    .sidebar-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    .sidebar-button:focus {
      outline: 2px solid rgba(0, 0, 0, 0.2);
      outline-offset: 2px;
    }
    .section-card {
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(0, 0, 0, 0.1);
    }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #000000;
      margin: 0 0 20px 0;
      display: flex;
      align-items: center;
      gap: 12px;
      letter-spacing: -0.025em;
    }
    .section-title span:first-child {
      font-size: 20px;
    }
  `;
  document.head.appendChild(style);

  sidebar.innerHTML = `
    <div style="background: linear-gradient(135deg, rgba(240, 248, 240, 0.4), rgba(248, 250, 248, 0.4), rgba(245, 250, 245, 0.4)); padding: 20px; backdrop-filter: blur(15px); position: relative; border-bottom: 2px solid rgba(200, 230, 200, 0.3);">
      <button id="closeSidebarBtn" style="
        position: absolute;
        top: 8px;
        right: 8px;
        width: 20px;
        height: 20px;
        border: none;
        background: #dc2626;
        color: white;
        border-radius: 50%;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      " onmouseover="this.style.background='#b91c1c'" onmouseout="this.style.background='#dc2626'">
        ×
      </button>
      <h2 style="margin: 0; color: #000000; font-size: 24px; font-weight: 700; text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);">
        📊 DataGlance
      </h2>
      <p style="margin: 8px 0 0 0; color: rgba(0, 0, 0, 0.8); font-size: 13px; text-shadow: 0 1px 1px rgba(255, 255, 255, 0.6);">
        Extract tables and analyze charts with AI-powered insights
    </div>
    
    <div style="padding: 20px;">
      <!-- Data Extraction & Analysis -->
      <div class="section-card">
        <h3 class="section-title">
          <span>📋</span>
          <span>Data Extraction & Analysis</span>
        </h3>
        <div style="display: grid; gap: 12px;">
          <button id="selectTableBtn" class="sidebar-button" style="background: linear-gradient(135deg, rgba(245, 250, 245, 0.9), rgba(240, 248, 240, 0.9)); color: #000000; font-size: 15px; padding: 14px; text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);">
            🎯 Select Table Region
          </button>
          <button id="previewTableBtn" class="sidebar-button" style="background: linear-gradient(135deg, rgba(248, 250, 248, 0.9), rgba(245, 250, 245, 0.9)); color: #000000; border: 2px solid rgba(200, 230, 200, 0.3); font-size: 15px; padding: 14px; text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);">
            👁️ Preview Selected Data
          </button>
          <button id="loadToSQLBtn" class="sidebar-button" style="background: linear-gradient(135deg, rgba(240, 248, 240, 0.9), rgba(245, 250, 245, 0.9)); color: #000000; font-size: 15px; padding: 14px; text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);">
            🚀 Query Table
          </button>
        </div>
        
        <div id="tablePreview" style="margin-top: 16px; max-height: 320px; overflow: auto; display: none; border: 2px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #ffffff;"></div>
        
        <textarea id="nlQueryInput" placeholder="◦ Ask questions about your data..."
 style="width: 100%; height: 100px; margin-top: 16px; display: none; padding: 16px; font-size: 14px; border: 2px solid #e2e8f0; border-radius: 12px; font-family: inherit; resize: vertical; line-height: 1.5;"></textarea>
        
        <button id="executeNLQueryBtn" class="sidebar-button" style="background: linear-gradient(135deg, rgba(245, 250, 245, 0.9), rgba(240, 248, 240, 0.9)); color: #000000; display: none; margin-top: 12px; font-size: 15px; padding: 14px; text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);">
          🔍 Execute Query
        </button>
        
        <div id="queryResults" style="margin-top: 16px; max-height: 400px; overflow: auto; display: none; border: 2px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #ffffff; font-size: 13px;"></div>
        
        <div id="chartControls" style="margin-top: 16px; display: none;">
          <button id="generateChartBtn" class="sidebar-button" style="background: linear-gradient(135deg, rgba(248, 250, 248, 0.9), rgba(245, 250, 245, 0.9)); color: #000000; font-size: 15px; padding: 14px; text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);">
            📊 Create Visualization
          </button>
        </div>
        
        <div id="chartContainer" style="margin-top: 16px; display: none; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px; background: #ffffff; max-height: 500px; overflow: auto;"></div>
      </div>
      
      <!-- Chart Insights -->
      <div class="section-card">
        <h3 class="section-title">
          <span>◈</span>
          <span>Chart Insights</span>
        </h3>
        <button id="selectChartBtn" class="sidebar-button" style="background: linear-gradient(135deg, rgba(240, 248, 240, 0.9), rgba(245, 250, 245, 0.9)); color: #000000; font-size: 15px; padding: 14px; text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);">
          📸 Analyze Chart 
        </button>
        <div id="chartAnalysisResults" style="margin-top: 16px; max-height: 450px; overflow: auto; display: none; border-radius: 12px;"></div>
      </div>
      
      <!-- Export Options -->
      <div class="section-card">
        <h3 class="section-title">
          <span>▼</span>
          <span>Export Data</span>
        </h3>
        <button id="downloadCSVBtn" class="sidebar-button" style="background: linear-gradient(135deg, rgba(245, 250, 245, 0.9), rgba(240, 248, 240, 0.9)); color: #000000; font-size: 15px; padding: 14px; text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);">
          📄 Download as CSV
        </button>
        <textarea id="jsonView" style="width: 100%; height: 160px; display: none; font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace; font-size: 12px; margin-top: 16px; padding: 16px; border: 2px solid #e2e8f0; border-radius: 12px; background: #f8fafc; resize: vertical; line-height: 1.4;"></textarea>
      </div>
    </div>
  `;

  // Add resize handle AFTER innerHTML
  const resizeHandle = document.createElement('div');
  resizeHandle.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    width: 4px;
    height: 100%;
    background: rgba(34, 197, 94, 0.3);
    cursor: ew-resize;
    z-index: 100000;
    transition: background 0.2s ease;
  `;
  
  resizeHandle.addEventListener('mouseenter', () => {
    resizeHandle.style.background = 'rgba(34, 197, 94, 0.6)';
  });
  
  resizeHandle.addEventListener('mouseleave', () => {
    if (!isResizing) resizeHandle.style.background = 'rgba(34, 197, 94, 0.3)';
  });
  
  resizeHandle.addEventListener('mousedown', startResize);
  sidebar.appendChild(resizeHandle);

  document.body.appendChild(sidebar);

  // Event listeners
  document.getElementById("selectTableBtn").addEventListener("click", enableRectangleSelection);
  document.getElementById("previewTableBtn").addEventListener("click", showPreview);

  document.getElementById("loadToSQLBtn").addEventListener("click", loadTableToSQL);
  document.getElementById("executeNLQueryBtn").addEventListener("click", executeNaturalLanguageQuery);
  document.getElementById("generateChartBtn").addEventListener("click", generateChartFromResults);
  document.getElementById("downloadCSVBtn").addEventListener("click", downloadCSV);

  document.getElementById("selectChartBtn").addEventListener("click", startChartSelection);
  document.getElementById("closeSidebarBtn").addEventListener("click", closeSidebar);
}

// --- Sidebar Resize Functions ---
function startResize(e) {
  isResizing = true;
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
  e.preventDefault();
}

function handleResize(e) {
  if (!isResizing) return;
  
  const newWidth = window.innerWidth - e.clientX;
  if (newWidth >= 250 && newWidth <= 800) {
    sidebarWidth = newWidth;
    sidebar.style.width = sidebarWidth + 'px';
    document.body.style.marginRight = sidebarWidth + 'px';
  }
}

function stopResize() {
  isResizing = false;
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  
  const resizeHandle = sidebar.querySelector('div');
  if (resizeHandle) {
    resizeHandle.style.background = 'rgba(255,255,255,0.3)';
  }
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
      alert(`✓ Table selected! ${latestTable.data.length} rows, ${latestTable.headers.length} columns.`);
      alert(`✓ Table selected! ${latestTable.data.length} rows, ${latestTable.headers.length} columns.`);
    } else {
      alert("⚠ No table detected in selection.");
      alert("⚠ No table detected in selection.");
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
    th.style.background = "rgba(34, 197, 94, 0.8)";
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



// --- Toggle JSON View ---
function toggleJSONView() {
  if (!latestTable && !latestMetadata) return alert("No data available.");
  const jsonView = document.getElementById("jsonView");
  const btn = document.getElementById("viewJSONBtn");
  if (jsonView.style.display === "none" || !jsonView.style.display) {
    jsonView.value = JSON.stringify(latestMetadata || latestTable, null, 2);
    jsonView.style.display = "block";
    btn.innerText = "✕ Hide JSON";
  } else {
    jsonView.style.display = "none";
    btn.innerText = "{ } JSON";
  }
}



// --- Load Table to SQL ---
async function loadTableToSQL() {
  if (!latestTable) return alert("No table selected. Please select a table first.");
  
  const btn = document.getElementById("loadToSQLBtn");
  btn.disabled = true;
  btn.innerText = "◐ Loading...";
  btn.innerText = "◐ Loading...";
  
  try {
    if (sqlManager) {
      console.log("Cleaning up previous SQL database...");
      sqlManager.destroy();
      sqlManager = null;
    }
    
    if (!latestMetadata) {
      btn.innerText = "◐ Analyzing data...";
      btn.innerText = "◐ Analyzing data...";
      console.log("Auto-generating metadata for better SQL queries...");
      
      initializeAI();
      latestMetadata = await aiGenerator.generateTableMetadata(
        latestTable.headers,
        latestTable.data
      );
      
      document.getElementById("jsonView").value = JSON.stringify(latestMetadata, null, 2);
      
      console.log("✓ Metadata auto-generated");
      console.log("✓ Metadata auto-generated");
    }
    
    btn.innerText = "◐ Loading to SQL...";
    btn.innerText = "◐ Loading to SQL...";
    sqlManager = new SQLQueryManager();
    await sqlManager.initialize();
    await sqlManager.createTableFromJSON(
      latestTable.headers,
      latestTable.data,
      latestMetadata
    );
    
    document.getElementById("nlQueryInput").style.display = "block";
    document.getElementById("executeNLQueryBtn").style.display = "block";
    
    btn.innerText = "✓ Loaded Successfully";
    btn.innerText = "✓ Loaded Successfully";
    btn.style.background = "rgba(34, 197, 94, 0.8)";
    alert(`✓ Data ready for queries!\n\n${latestTable.data.length} rows loaded with AI analysis.\n\nYou can now ask questions about your data.`);
    alert(`✓ Data ready for queries!\n\n${latestTable.data.length} rows loaded with AI analysis.\n\nYou can now ask questions about your data.`);
    
  } catch (error) {
    console.error("Error loading table to SQL:", error);
    alert("✗ Error loading table. Check console for details.");
    btn.innerText = "▶ Load to SQL Database";
    alert("✗ Error loading table. Check console for details.");
    btn.innerText = "▶ Load to SQL Database";
    btn.style.background = "rgba(34, 197, 94, 0.8)";
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
  btn.innerText = "◐ Querying...";
  btn.innerText = "◐ Querying...";
  resultsDiv.style.display = "block";
  resultsDiv.innerHTML = "<p style='padding:10px;'>◈ Processing your question and generating insights...</p>";
  resultsDiv.innerHTML = "<p style='padding:10px;'>◈ Processing your question and generating insights...</p>";
  
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
      analysisDiv.style.background = "rgba(34, 197, 94, 0.8)";
      analysisDiv.style.borderRadius = "8px";
      analysisDiv.style.color = "white";
      analysisDiv.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
      
      analysisDiv.innerHTML = `
        <div style="margin-bottom:12px;">
          <strong style="font-size:14px;">◉ AI Analysis</strong>
          <strong style="font-size:14px;">◉ AI Analysis</strong>
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
    
    // sqlInfoDiv.innerHTML = `
    //   <details>
    //     <summary style="cursor:pointer; font-weight:bold; color:#667eea;">
    //       🔍 Query Details (click to expand)
    //     </summary>
    //     <div style="margin-top:8px;">
    //       <strong>Question:</strong> ${question}<br>
    //       <strong>SQL:</strong> ode style="background:#fff; padding:4px 8px; display:block; margin-top:4px; border-radius:4px;x; font-family: monospace;">${sql}</code>
    //       ${explanation ? `<strong>Explanation:</strong> ${explanation}` : ''}
    //     </div>
    //   </details>
    // `;
    
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
        <summary style="cursor:pointer; padding:8px; background:rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border-radius:8px; font-weight:bold; color:#000000; margin-bottom:10px;">
          ▦ View Raw Data (${results.values.length} rows)
          ▦ View Raw Data (${results.values.length} rows)
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
        th.style.background = "rgba(34, 197, 94, 0.8)";
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
      <strong>✗ Error:</strong> ${error.message}
      <strong>✗ Error:</strong> ${error.message}
    </div>`;
  } finally {
    btn.innerText = "▷ Execute Query";
    btn.innerText = "▷ Execute Query";
    btn.disabled = false;
  }
}

// --- Generate Chart from Results ---
async function generateChartFromResults() {
  console.log("▦ Starting chart generation...");
  console.log("▦ Starting chart generation...");
  
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
  btn.innerText = "◐ Generating...";
  btn.innerText = "◐ Generating...";
  
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
      console.log("✓ Chart generation completed successfully");
      console.log("✓ Chart generation completed successfully");
    }
    
  } catch (error) {
    console.error("✗ Chart generation error:", error);
    console.error("✗ Chart generation error:", error);
    const chartContainer = document.getElementById("chartContainer");
    chartContainer.innerHTML = `
      <div style="padding:15px; color:#c62828; border:2px solid #ffcdd2; background:#ffebee; border-radius:8px;">
        <strong>✗ Chart Generation Failed</strong><br>
        <strong>✗ Chart Generation Failed</strong><br>
        ${error.message}
      </div>
    `;
  } finally {
    btn.innerText = "▦ Visualize with AI Chart";
    btn.innerText = "▦ Visualize with AI Chart";
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
    alert(`⚠ AI Vision Not Available\n\n${aiStatus.message}\n\nSetup Instructions:\n1. Go to chrome://flags/#prompt-api-for-gemini-nano\n2. Set to "Enabled"\n3. Go to chrome://flags/#optimization-guide-on-device-model\n4. Set to "Enabled BypassPerfRequirement"\n5. Restart Chrome\n6. Check chrome://components/ for model download`);
    alert(`⚠ AI Vision Not Available\n\n${aiStatus.message}\n\nSetup Instructions:\n1. Go to chrome://flags/#prompt-api-for-gemini-nano\n2. Set to "Enabled"\n3. Go to chrome://flags/#optimization-guide-on-device-model\n4. Set to "Enabled BypassPerfRequirement"\n5. Restart Chrome\n6. Check chrome://components/ for model download`);
    return;
  }
  
  alert("◎ Chart Analysis Mode\n\nDraw a rectangle around the chart or image you want to analyze.\n\nPress ESC to cancel.");
  alert("◎ Chart Analysis Mode\n\nDraw a rectangle around the chart or image you want to analyze.\n\nPress ESC to cancel.");
  
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
  resultsDiv.innerHTML = "<p style='padding:10px;'>◎ Capturing selected area...</p>";
  resultsDiv.innerHTML = "<p style='padding:10px;'>◎ Capturing selected area...</p>";
  
  try {
    const imageData = await captureRectangleAsImage(rect);
    resultsDiv.innerHTML = "<p style='padding:10px;'>◈ Analyzing with AI Vision...</p>";
    resultsDiv.innerHTML = "<p style='padding:10px;'>◈ Analyzing with AI Vision...</p>";
    const analysis = await analyzeChartWithVisionAPI(imageData);
    displayChartAnalysisResults(resultsDiv, analysis, imageData);
  } catch (error) {
    console.error("Chart analysis error:", error);
    resultsDiv.innerHTML = `
      <div style="padding:12px; background:#ffebee; border-radius:8px; color:#c62828; border-left: 4px solid #f44336;">
        <strong>✗ Error:</strong> ${error.message}
        <strong>✗ Error:</strong> ${error.message}
      </div>
    `;
  }
}

async function captureRectangleAsImage(rect) {
  try {
    console.log("◎ Capturing rectangle area:", rect);
    console.log("◎ Capturing rectangle area:", rect);
    
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
      console.log("✓ Screenshot captured");
      console.log("✓ Screenshot captured");
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
    console.log("◈ Creating multimodal AI session...");
    console.log("◈ Creating multimodal AI session...");
    
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
    
    console.log("✓ Session created successfully");
    console.log("✓ Session created successfully");
    
    const imageFile = await base64ToFile(imageData, 'chart.png');
    console.log("✓ Image file ready");
    console.log("✓ Image file ready");
    
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
    
    console.log("✓ Image appended to session");
    console.log("✓ Image appended to session");
    
    const result = await session.prompt("Provide the analysis in the JSON format specified above.");
    console.log("✓ Raw response:", result);
    console.log("✓ Raw response:", result);
    
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
    
    console.log("✓ Analysis complete:", analysis);
    console.log("✓ Analysis complete:", analysis);
    
    if (session.destroy) {
      session.destroy();
    }
    
    return analysis;
    
  } catch (error) {
    console.error("✗ Vision API error:", error);
    console.error("✗ Vision API error:", error);
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
  const analysisId = 'analysis_' + Date.now();
  
  container.innerHTML = `
    <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.12); border: 1px solid #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      
      <!-- Header Section -->
      <div style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(15px); padding: 24px; color: #000000; border-bottom: 3px solid rgba(34, 197, 94, 0.8);">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: rgba(255,255,255,0.2); padding: 8px; border-radius: 12px; backdrop-filter: blur(10px);">
              <span style="font-size: 24px; display: block;">▦</span>
              <span style="font-size: 24px; display: block;">▦</span>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">Chart Analysis Results</h2>
              <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">AI-powered insights and data visualization analysis</p>
            </div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; backdrop-filter: blur(10px);">
            ◈ AI ANALYZED
            ◈ AI ANALYZED
          </div>
        </div>
      </div>

      <!-- Image Preview Section -->
      <div style="background: #f8fafc; padding: 24px; border-bottom: 1px solid #e5e7eb;">
        <div style="text-align: center;">
          <img src="${imageData}" 
               style="max-width: 100%; max-height: 400px; height: auto; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;" 
               alt="Analyzed chart visualization">
        </div>
      </div>

      <!-- Combined Analysis Section -->
      <div style="padding: 32px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
          <div style="background: rgba(34, 197, 94, 0.8); backdrop-filter: blur(10px); padding: 8px; border-radius: 10px;">
            <span style="font-size: 18px; color: white; display: block;">◈</span>
            <span style="font-size: 18px; color: white; display: block;">◈</span>
          </div>
          <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #1f2937;">Chart Insights</h3>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); padding: 24px; border-radius: 12px; margin-bottom: 24px; border: 1px solid rgba(0, 0, 0, 0.1);">
          ${analysis.chartDescription ? `
            <div style="margin-bottom: 20px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <span style="font-size: 16px;">▤</span>
                <span style="font-size: 16px;">▤</span>
                <strong style="font-size: 15px; color: #000000; font-weight: 600;">Summary</strong>
              </div>
              <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #374151;">${analysis.chartDescription}</p>
            </div>
          ` : ''}
          
          ${analysis.analysis && analysis.analysis.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <span style="font-size: 16px;">◈</span>
                <span style="font-size: 16px;">◈</span>
                <strong style="font-size: 15px; color: #000000; font-weight: 600;">Detailed Analysis</strong>
              </div>
              <ul style="margin: 0; padding: 0; list-style: none;">
                ${analysis.analysis.map((item, idx) => `
                  <li style="margin-bottom: 12px; font-size: 14px; line-height: 1.7; color: #374151; display: flex; gap: 12px;">
                    <span style="background: rgba(34, 197, 94, 0.8); backdrop-filter: blur(5px); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; margin-top: 2px;">${idx + 1}</span>
                    <span>${item}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${analysis.keyFindings && analysis.keyFindings.length > 0 ? `
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <span style="font-size: 16px;">◉</span>
                <span style="font-size: 16px;">◉</span>
                <strong style="font-size: 15px; color: #000000; font-weight: 600;">Key Findings</strong>
              </div>
              <ul style="margin: 0; padding: 0; list-style: none;">
                ${analysis.keyFindings.map((finding, idx) => `
                  <li style="margin-bottom: 12px; font-size: 14px; line-height: 1.7; color: #374151; display: flex; gap: 12px;">
                    <span style="background: rgba(34, 197, 94, 0.8); backdrop-filter: blur(5px); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; margin-top: 2px;">!</span>
                    <span>${finding}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
  
  // Store analysis data for export
  window.chartAnalysisData = window.chartAnalysisData || {};
  window.chartAnalysisData[analysisId] = {
    analysis,
    imageData,
    timestamp: new Date().toISOString()
  };
}

function exportAnalysis(analysisId, format) {
  const data = window.chartAnalysisData?.[analysisId];
  if (!data) {
    alert('Analysis data not found');
    return;
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `chart-analysis-${timestamp}`;
  
  if (format === 'csv') {
    exportAsCSV(data, filename);
  } else if (format === 'json') {
    exportAsJSON(data, filename);
  }
}

function exportAsCSV(data, filename) {
  const { analysis } = data;
  let csvContent = 'Section,Item,Content\n';
  
  if (analysis.chartDescription) {
    csvContent += `"Summary","Description","${analysis.chartDescription.replace(/"/g, '""')}"\n`;
  }
  
  if (analysis.analysis) {
    analysis.analysis.forEach((item, idx) => {
      csvContent += `"Analysis","Point ${idx + 1}","${item.replace(/"/g, '""')}"\n`;
    });
  }
  
  if (analysis.keyFindings) {
    analysis.keyFindings.forEach((finding, idx) => {
      csvContent += `"Key Findings","Finding ${idx + 1}","${finding.replace(/"/g, '""')}"\n`;
    });
  }
  
  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
}

function exportAsJSON(data, filename) {
  const exportData = {
    timestamp: data.timestamp,
    analysis: data.analysis,
    metadata: {
      exportedAt: new Date().toISOString(),
      format: 'json',
      version: '1.0'
    }
  };
  
  const jsonContent = JSON.stringify(exportData, null, 2);
  downloadFile(jsonContent, `${filename}.json`, 'application/json');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
  
  // Reset body margin when closing sidebar
  document.body.style.marginRight = "0";
  
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
