// src/content/content.js
// Main content script with all features: table selection, preview, CSV, metadata, NL query, AI charts
// Enhanced with AI-powered chart generation using metadata context and better error handling

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

// --- Sidebar creation ---
function createSidebar() {
  if (document.getElementById("smartTableSidebar")) return;

  sidebar = document.createElement("div");
  sidebar.id = "smartTableSidebar";
  sidebar.style.position = "fixed";
  sidebar.style.top = "0";
  sidebar.style.right = "0";
  sidebar.style.width = "360px";
  sidebar.style.height = "100%";
  sidebar.style.background = "#f5f5f5";
  sidebar.style.boxShadow = "-2px 0 5px rgba(0,0,0,0.3)";
  sidebar.style.zIndex = 99999;
  sidebar.style.padding = "10px";
  sidebar.style.fontFamily = "Arial, sans-serif";
  sidebar.style.overflowY = "auto";

  sidebar.innerHTML = `
    <h3 style="margin-top:0;">Smart Table Extractor</h3>
    
    <!-- Table Selection & Preview -->
    <div style="border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 10px;">
      <h4 style="margin: 5px 0;">1. Extract Table</h4>
      <button id="selectTableBtn" style="width:100%; margin-bottom:5px; padding:8px; cursor:pointer;">📋 Select Table</button>
      <button id="previewTableBtn" style="width:100%; margin-bottom:5px; padding:8px; cursor:pointer;">👁️ Preview Table</button>
    </div>
    
    <!-- AI Metadata Generation -->
    <div style="border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 10px;">
      <h4 style="margin: 5px 0;">2. Generate Metadata (AI)</h4>
      <button id="generateMetadataBtn" style="width:100%; margin-bottom:5px; padding:8px; background-color:#4CAF50; color:white; cursor:pointer;">🤖 Generate Metadata</button>
      <div id="metadataView" style="margin-top:10px; max-height:250px; overflow:auto; display:none; border:1px solid #ddd; padding:5px; background:#fff; font-size:12px;"></div>
    </div>
    
    <!-- Natural Language Query -->
    <div style="border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 10px;">
      <h4 style="margin: 5px 0;">3. Query with Natural Language</h4>
      <button id="loadToSQLBtn" style="width:100%; margin-bottom:5px; padding:8px; background-color:#2196F3; color:white; cursor:pointer;">💾 Load Table to SQL</button>
      <textarea id="nlQueryInput" placeholder="Ask a question about the table...
Examples:
- Show all rows
- What's the average salary?
- Count by department" style="width:100%; height:80px; margin-bottom:5px; display:none; padding:5px; font-size:12px;"></textarea>
      <button id="executeNLQueryBtn" style="width:100%; margin-bottom:5px; padding:8px; background-color:#FF9800; color:white; display:none; cursor:pointer;">🔍 Execute Query</button>
      <div id="queryResults" style="margin-top:10px; max-height:300px; overflow:auto; display:none; border:1px solid #ddd; padding:5px; background:#fff; font-size:12px;"></div>
      
      <!-- Chart Controls -->
      <div id="chartControls" style="margin-top:10px; display:none;">
        <button id="generateChartBtn" style="width:100%; margin-bottom:5px; padding:8px; background-color:#9C27B0; color:white; cursor:pointer;">📊 AI Visualize as Chart</button>
      </div>
      <div id="chartContainer" style="margin-top:10px; display:none; border:1px solid #ddd; padding:10px; background:#fff; height:500px; overflow:auto;"></div>
    </div>
    
    <!-- Download Options -->
    <div style="border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 10px;">
      <h4 style="margin: 5px 0;">4. Download</h4>
      <button id="downloadCSVBtn" style="width:100%; margin-bottom:5px; padding:8px; cursor:pointer;">📥 Download CSV</button>
      <button id="downloadMetadataBtn" style="width:100%; margin-bottom:5px; padding:8px; cursor:pointer;">📥 Download Metadata JSON</button>
    </div>
    
    <!-- JSON View -->
    <div style="margin-bottom: 10px;">
      <button id="viewJSONBtn" style="width:100%; margin-bottom:5px; padding:8px; cursor:pointer;">📄 View JSON</button>
      <textarea id="jsonView" style="width:100%; height:150px; display:none; font-family:monospace; font-size:11px;"></textarea>
    </div>
    
    <!-- Table Preview -->
    <div id="tablePreview" style="margin-top:10px; max-height:300px; overflow:auto; display:none; border:1px solid #ddd; padding:5px; background:#fff;"></div>
    
    <!-- Close Button -->
    <button id="closeSidebarBtn" style="width:100%; margin-top:10px; padding:8px; background-color:#f44336; color:white; cursor:pointer;">❌ Close Sidebar</button>
  `;

  document.body.appendChild(sidebar);

  // Event listeners for all features
  document.getElementById("selectTableBtn").addEventListener("click", enableRectangleSelection);
  document.getElementById("previewTableBtn").addEventListener("click", showPreview);
  document.getElementById("generateMetadataBtn").addEventListener("click", generateMetadata);
  document.getElementById("loadToSQLBtn").addEventListener("click", loadTableToSQL);
  document.getElementById("executeNLQueryBtn").addEventListener("click", executeNaturalLanguageQuery);
  document.getElementById("generateChartBtn").addEventListener("click", generateChartFromResults);
  document.getElementById("downloadCSVBtn").addEventListener("click", downloadCSV);
  document.getElementById("downloadMetadataBtn").addEventListener("click", downloadMetadataJSON);
  document.getElementById("viewJSONBtn").addEventListener("click", toggleJSONView);
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
    th.style.border = "1px solid black";
    th.style.padding = "4px";
    th.style.background = "#e0e0e0";
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  latestTable.data.forEach(row => {
    const tr = document.createElement("tr");
    latestTable.headers.forEach(h => {
      const td = document.createElement("td");
      td.innerText = row[h] || "";
      td.style.border = "1px solid black";
      td.style.padding = "3px";
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

  // Table description
  const descDiv = document.createElement("div");
  descDiv.style.marginBottom = "10px";
  descDiv.style.padding = "8px";
  descDiv.style.background = "#e3f2fd";
  descDiv.style.borderRadius = "4px";
  descDiv.innerHTML = `<strong>Table Description:</strong><br>${metadata.table_description}`;
  container.appendChild(descDiv);

  // Columns info
  const colsDiv = document.createElement("div");
  colsDiv.innerHTML = `<strong>Columns (${metadata.column_count}):</strong><hr style="margin:5px 0;">`;

  metadata.columns.forEach(col => {
    const colCard = document.createElement("div");
    colCard.style.marginBottom = "8px";
    colCard.style.padding = "6px";
    colCard.style.border = "1px solid #ddd";
    colCard.style.borderRadius = "3px";
    colCard.style.background = "#f9f9f9";
    colCard.innerHTML = `
      <strong>${col.column_name}</strong> <span style="color:#666;">(${col.data_type})</span><br>
      <small>${col.description}</small><br>
      <em style="color:#888; font-size:10px;">Samples: ${col.sample_values.join(", ")}</em>
    `;
    colsDiv.appendChild(colCard);
  });

  container.appendChild(colsDiv);
}

// --- Load Table to SQL (with auto-metadata generation and cleanup) ---
async function loadTableToSQL() {
  if (!latestTable) return alert("No table selected. Please select a table first.");
  
  const btn = document.getElementById("loadToSQLBtn");
  btn.disabled = true;
  btn.innerText = "⏳ Loading...";
  
  try {
    // CLEAN UP OLD DATABASE IF EXISTS
    if (sqlManager) {
      console.log("Cleaning up previous SQL database...");
      sqlManager.destroy();
      sqlManager = null;
    }
    
    // AUTO-GENERATE METADATA IF NOT EXISTS
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
    
    // Now load to SQL with metadata
    btn.innerText = "⏳ Loading to SQL...";
    sqlManager = new SQLQueryManager();
    await sqlManager.initialize();
    await sqlManager.createTableFromJSON(
      latestTable.headers,
      latestTable.data,
      latestMetadata
    );
    
    // Show query interface
    document.getElementById("nlQueryInput").style.display = "block";
    document.getElementById("executeNLQueryBtn").style.display = "block";
    
    btn.innerText = "✅ Table Loaded to SQL";
    btn.style.backgroundColor = "#4CAF50";
    alert(`✅ Table loaded to SQL database with AI metadata!\n\n${latestTable.data.length} rows loaded.\n\nEnhanced with:\n• Column descriptions\n• Sample values\n• Data type context\n\nAsk questions now!`);
    
  } catch (error) {
    console.error("Error loading table to SQL:", error);
    alert("❌ Error loading table. Check console for details.");
    btn.innerText = "💾 Load Table to SQL";
    btn.style.backgroundColor = "#2196F3";
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
  resultsDiv.innerHTML = "<p style='padding:10px;'>🤖 Processing your question...</p>";
  
  // Hide chart controls initially
  document.getElementById("chartControls").style.display = "none";
  document.getElementById("chartContainer").style.display = "none";
  
  try {
    const { sql, explanation, results } = await sqlManager.queryWithNaturalLanguage(question);
    
    // Store results for charting
    latestQueryResults = { question, sql, explanation, results };
    
    // Display results header
    resultsDiv.innerHTML = `
      <div style="margin-bottom:10px; padding:8px; background:#e8f5e9; border-radius:4px;">
        <strong>Question:</strong> ${question}<br>
        <strong>SQL:</strong> <code style="background:#fff; padding:2px 4px; display:block; margin-top:4px;">${sql}</code>
        ${explanation ? `<strong>Explanation:</strong> ${explanation}` : ''}
      </div>
    `;
    
    if (results.values.length === 0) {
      resultsDiv.innerHTML += '<p style="padding:10px; color:#666;">No results found.</p>';
    } else {
      // Create results table
      const table = document.createElement("table");
      table.style.borderCollapse = "collapse";
      table.style.width = "100%";
      table.style.fontSize = "11px";
      
      // Header
      const thead = document.createElement("thead");
      const trHead = document.createElement("tr");
      results.columns.forEach(col => {
        const th = document.createElement("th");
        th.innerText = col;
        th.style.border = "1px solid black";
        th.style.padding = "4px";
        th.style.background = "#e0e0e0";
        th.style.fontWeight = "bold";
        trHead.appendChild(th);
      });
      thead.appendChild(trHead);
      table.appendChild(thead);
      
      // Body
      const tbody = document.createElement("tbody");
      results.values.forEach(row => {
        const tr = document.createElement("tr");
        row.forEach(cell => {
          const td = document.createElement("td");
          td.innerText = cell !== null ? cell : "NULL";
          td.style.border = "1px solid black";
          td.style.padding = "4px";
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      
      resultsDiv.appendChild(table);
      
      // Add row count
      const countDiv = document.createElement("div");
      countDiv.style.marginTop = "5px";
      countDiv.style.fontSize = "11px";
      countDiv.style.color = "#666";
      countDiv.innerText = `${results.values.length} row(s) returned`;
      resultsDiv.appendChild(countDiv);
      
      // Show chart controls if data is suitable
      if (results.columns.length >= 1 && results.values.length > 0) {
        document.getElementById("chartControls").style.display = "block";
      }
    }
    
  } catch (error) {
    console.error("Query error:", error);
    resultsDiv.innerHTML = `<div style="padding:10px; background:#ffebee; border-radius:4px; color:#c62828;">
      <strong>❌ Error:</strong> ${error.message}
    </div>`;
  } finally {
    btn.innerText = "🔍 Execute Query";
    btn.disabled = false;
  }
}

// --- Generate Chart from Results (AI-Powered with better error handling) ---
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
    
    console.log("📊 Chart container shown, calling generateChartWithAI...");
    
    // Use AI to generate chart with metadata context
    const result = await chartGenerator.generateChartWithAI(
      chartContainer,
      latestMetadata,
      latestQueryResults.question,
      latestQueryResults.results.columns,
      latestQueryResults.results.values
    );
    
    if (result) {
      console.log("✅ Chart generation completed successfully");
    } else {
      console.log("⚠️ Chart generation returned null");
    }
    
  } catch (error) {
    console.error("❌ Chart generation error:", error);
    const chartContainer = document.getElementById("chartContainer");
    chartContainer.innerHTML = `
      <div style="padding:15px; color:#c62828; border:1px solid #ffcdd2; background:#ffebee; border-radius:4px;">
        <strong>❌ Chart Generation Failed</strong><br>
        ${error.message}<br><br>
        <strong>Debug Steps:</strong><br>
        1. Open browser console (F12)<br>
        2. Check for Chart.js loading errors<br>
        3. Verify lib/chart.umd.js exists
      </div>
    `;
  } finally {
    btn.innerText = "📊 AI Visualize as Chart";
    btn.disabled = false;
  }
}

// --- Close Sidebar (with cleanup) ---
function closeSidebar() {
  // Clean up SQL database
  if (sqlManager) {
    sqlManager.destroy();
    sqlManager = null;
  }
  
  // Clean up AI generator
  if (aiGenerator) {
    aiGenerator.closeSession();
    aiGenerator = null;
  }
  
  // Clean up chart generator
  if (chartGenerator) {
    chartGenerator.destroy();
    chartGenerator = null;
  }
  
  // Remove sidebar
  if (sidebar) {
    sidebar.remove();
    sidebar = null;
  }
  
  // Reset state
  latestTable = null;
  latestMetadata = null;
  latestQueryResults = null;
}
