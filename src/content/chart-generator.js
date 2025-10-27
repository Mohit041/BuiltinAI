// src/content/chart-generator.js
// AI-Powered Chart Generator using Chrome Prompt API and metadata context
// Enhanced with robust prompts, column role classification, and intelligent fallbacks

// Check if Chart.js is loaded at module level
if (typeof Chart === 'undefined') {
  console.error('❌ Chart.js not loaded! Check if lib/chart.umd.js exists and is in manifest.json');
} else {
  console.log('✅ Chart.js loaded successfully, version:', Chart.version || 'unknown');
}

class ChartGenerator {
  constructor() {
    this.currentChart = null;
    this.chartCanvas = null;
    this.aiSession = null;
  }

  // Initialize AI session for chart recommendations
  async initializeAISession(metadata) {
    if (this.aiSession) return this.aiSession;
    
    try {
      const metadataContext = metadata ? `
Table Context:
- Description: ${metadata.table_description}
- Total Columns: ${metadata.column_count}
- Total Rows: ${metadata.row_count}
- Column Details:
${metadata.columns.map(col => `  * "${col.column_name}" (${col.data_type}): ${col.description}`).join('\n')}
` : 'No metadata available';

      this.aiSession = await LanguageModel.create({
        initialPrompts: [{
          role: 'system',
          content: `You are a data visualization expert specializing in chart recommendation and configuration. Your expertise includes:
- Understanding data semantics and column relationships
- Selecting optimal chart types based on data characteristics
- Creating clear, informative visualizations

You have access to detailed metadata about the data including column types, descriptions, and sample values.

${metadataContext}

Your goal is to recommend the BEST chart type and configuration that clearly communicates the data story to the user.`
        }]
      });
      
      console.log("🤖 AI session for chart recommendations initialized");
      return this.aiSession;
    } catch (error) {
      console.error("Failed to initialize AI session for charts:", error);
      throw error;
    }
  }

  // Classify column role based on metadata
  classifyColumnRole(dataType, description, columnName) {
    const lowerDesc = (description || '').toLowerCase();
    const lowerName = columnName.toLowerCase();
    
    // Identify role based on data type and semantic clues
    if (dataType === 'date' || lowerName.includes('date') || lowerDesc.includes('date')) {
      return 'temporal (time/date dimension)';
    }
    
    if (dataType === 'time' || lowerName.includes('time')) {
      return 'temporal (time dimension)';
    }
    
    if (dataType === 'integer' || dataType === 'decimal') {
      if (lowerDesc.includes('count') || lowerDesc.includes('number of')) {
        return 'metric (count/quantity)';
      }
      if (lowerDesc.includes('price') || lowerDesc.includes('cost') || lowerDesc.includes('amount') || lowerDesc.includes('salary')) {
        return 'metric (monetary value)';
      }
      if (lowerDesc.includes('percentage') || lowerDesc.includes('rate')) {
        return 'metric (ratio/percentage)';
      }
      return 'metric (numeric measure)';
    }
    
    if (dataType === 'currency') {
      return 'metric (monetary value)';
    }
    
    if (dataType === 'percentage') {
      return 'metric (ratio/percentage)';
    }
    
    if (dataType === 'string' || dataType === 'text') {
      if (lowerDesc.includes('name') || lowerDesc.includes('title') || lowerDesc.includes('label')) {
        return 'dimension (category/identifier)';
      }
      if (lowerDesc.includes('type') || lowerDesc.includes('category') || lowerDesc.includes('group')) {
        return 'dimension (categorical)';
      }
      return 'dimension (text/category)';
    }
    
    if (dataType === 'boolean') {
      return 'dimension (binary category)';
    }
    
    return 'unknown';
  }

  // Get AI recommendation for chart type and configuration with enhanced prompts
  async getChartRecommendation(metadata, queryQuestion, columns, rowCount, sampleData) {
    try {
      await this.initializeAISession(metadata);
      
      // Build detailed column analysis with metadata
      const columnAnalysis = columns.map((col) => {
        const metaCol = metadata?.columns?.find(m => m.column_name === col);
        
        if (metaCol) {
          return {
            name: col,
            dataType: metaCol.data_type,
            description: metaCol.description,
            samples: metaCol.sample_values.slice(0, 5),
            // Classify column role
            role: this.classifyColumnRole(metaCol.data_type, metaCol.description, col)
          };
        }
        
        return {
          name: col,
          dataType: 'unknown',
          description: 'No description available',
          samples: [],
          role: 'unknown'
        };
      });

      // Build structured prompt with clear sections
      const prompt = `
You are an expert data visualization consultant. Analyze this query result and recommend the optimal chart type.

=== USER QUESTION ===
"${queryQuestion}"

=== QUERY RESULTS SUMMARY ===
- Total Rows: ${rowCount}
- Total Columns: ${columns.length}

=== DETAILED COLUMN ANALYSIS ===
${columnAnalysis.map((col, idx) => `
Column ${idx + 1}: "${col.name}"
  • Data Type: ${col.dataType}
  • Semantic Role: ${col.role}
  • Description: ${col.description}
  • Sample Values: ${col.samples.length > 0 ? col.samples.join(', ') : 'N/A'}
`).join('\n')}

=== SAMPLE DATA (first 3 rows) ===
${JSON.stringify(sampleData, null, 2)}

=== CHART TYPE DECISION GUIDE ===
Choose based on these principles:

1. **BAR CHART** - Use when:
   - Comparing discrete categories (e.g., sales by product, count by department)
   - X-axis = categorical/string column (dimension)
   - Y-axis = numeric column (metric: integer, decimal, currency)
   - Good for: comparisons, rankings, distributions across categories
   - Best when: You want to compare values side-by-side

2. **LINE CHART** - Use when:
   - Showing trends over time or continuous progression
   - X-axis = date, time, or sequential data (temporal dimension)
   - Y-axis = numeric values (metrics)
   - Good for: time series, trends, patterns over continuous ranges
   - Best when: Understanding change over time is important

3. **PIE/DOUGHNUT CHART** - Use when:
   - Showing composition or proportions of a whole
   - Must have exactly 2-10 categories (not too many slices)
   - Data represents parts of 100% or relative proportions
   - Good for: market share, percentage breakdowns, composition
   - Best when: Showing how parts relate to a whole

4. **RADAR CHART** - Use when:
   - Comparing multiple variables across categories
   - Need to show multivariate data
   - 3-8 variables to compare
   - Good for: performance metrics, multi-dimensional comparisons

=== YOUR TASK ===
1. **Identify the X-axis column**: 
   - Should be the categorical/grouping column (usually string, date, or identifier)
   - Look for columns with role "dimension" or "temporal"
   - This is what you're comparing ACROSS

2. **Identify the Y-axis column(s)**: 
   - Should be numeric values to visualize (integer, decimal, currency, percentage)
   - Look for columns with role "metric"
   - This is what you're MEASURING or COMPARING

3. **Consider the question intent**: 
   - What is the user trying to understand?
   - Are they comparing? Trending? Looking at composition?

4. **Match to appropriate chart type**: 
   - Based on data characteristics and user intent
   - Consider number of data points (too many categories → line chart)

=== IMPORTANT RULES ===
- ALWAYS use the column's full name EXACTLY as shown in "Column Analysis" section
- For xAxis, choose the column that best represents categories/groups/time
- For yAxis, choose numeric column(s) that answer the user's question
- If comparing 2+ numeric columns, you can specify multiple yAxis columns separated by commas
- The title should clearly describe what the chart shows
- Provide actionable insights about what patterns to look for
- If a column is named "Name", "Country", "Product", etc., it's likely a dimension (X-axis)
- If a column has numbers with descriptions like "price", "count", "amount", it's a metric (Y-axis)

=== RESPONSE FORMAT ===
Return ONLY valid JSON in this exact structure:
{
  "chartType": "bar|line|pie|doughnut|radar",
  "reasoning": "2-3 sentences explaining why this chart type is optimal for this specific data and question. Reference the column roles and data characteristics.",
  "xAxis": "exact column name for X-axis (the dimension/category column)",
  "yAxis": "exact column name(s) for Y-axis (the metric/numeric column, comma-separated if multiple)",
  "title": "Clear, descriptive chart title that describes what is being shown",
  "insights": "What patterns, trends, or findings should the user look for in this visualization"
}

CRITICAL REQUIREMENTS:
- Your xAxis and yAxis MUST match column names EXACTLY from the Column Analysis above
- xAxis should typically be a dimension (categorical, temporal)
- yAxis should typically be a metric (numeric measure)
- Consider the semantic meaning of columns, not just data types
`;

      console.log("📊 Sending enhanced prompt to AI...");
      
      const response = await this.aiSession.prompt(prompt, {
        responseConstraint: {
          type: "object",
          properties: {
            chartType: { type: "string" },
            reasoning: { type: "string" },
            xAxis: { type: "string" },
            yAxis: { type: "string" },
            title: { type: "string" },
            insights: { type: "string" }
          },
          required: ["chartType", "xAxis", "yAxis", "title"]
        }
      });

      const recommendation = typeof response === "string" ? JSON.parse(response) : response;
      
      console.log("🎨 AI Raw Recommendation:", recommendation);
      
      // Validate recommendation
      const validation = this.validateRecommendation(recommendation, columns, columnAnalysis);
      
      if (!validation.valid) {
        console.warn("⚠️ AI recommendation validation failed:", validation.errors);
        console.log("🔧 Applying automatic corrections...");
        
        // Auto-correct if possible
        recommendation.xAxis = this.findBestXAxis(columns, columnAnalysis);
        recommendation.yAxis = this.findBestYAxis(columns, columnAnalysis, recommendation.xAxis);
        
        console.log("✅ Corrected recommendation:", {
          xAxis: recommendation.xAxis,
          yAxis: recommendation.yAxis
        });
      }
      
      console.log("🎨 Final AI Chart Recommendation:", recommendation);
      return recommendation;

    } catch (error) {
      console.error("Error getting AI chart recommendation:", error);
      // Fallback to intelligent heuristics
      return this.getIntelligentFallback(columns, metadata, queryQuestion, rowCount);
    }
  }

  // Validate AI recommendation
  validateRecommendation(recommendation, columns, columnAnalysis) {
    const errors = [];
    
    // Check if xAxis column exists
    if (!columns.includes(recommendation.xAxis)) {
      errors.push(`xAxis column "${recommendation.xAxis}" not found in data. Available: ${columns.join(', ')}`);
    }
    
    // Check if yAxis columns exist
    const yAxisColumns = recommendation.yAxis.split(',').map(c => c.trim());
    yAxisColumns.forEach(col => {
      if (!columns.includes(col)) {
        errors.push(`yAxis column "${col}" not found in data. Available: ${columns.join(', ')}`);
      }
    });
    
    // Check if chart type is valid
    const validTypes = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'];
    if (!validTypes.includes(recommendation.chartType)) {
      errors.push(`Invalid chart type "${recommendation.chartType}". Valid types: ${validTypes.join(', ')}`);
    }
    
    // Warn if xAxis and yAxis are the same
    if (recommendation.xAxis === recommendation.yAxis) {
      errors.push(`xAxis and yAxis cannot be the same column: "${recommendation.xAxis}"`);
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  // Find best X-axis column automatically
  findBestXAxis(columns, columnAnalysis) {
    console.log("🔍 Auto-detecting best X-axis column...");
    
    // Priority 1: Date/time columns (for time series)
    const temporalColumns = columnAnalysis.filter(c => 
      c.role.includes('temporal') ||
      c.dataType === 'date' ||
      c.dataType === 'time'
    );
    
    if (temporalColumns.length > 0) {
      console.log("✅ Found temporal column for X-axis:", temporalColumns[0].name);
      return temporalColumns[0].name;
    }
    
    // Priority 2: Categorical/string columns (dimensions)
    const dimensionColumns = columnAnalysis.filter(c => 
      c.role.includes('dimension') || 
      c.dataType === 'string' || 
      c.dataType === 'text'
    );
    
    if (dimensionColumns.length > 0) {
      console.log("✅ Found dimension column for X-axis:", dimensionColumns[0].name);
      return dimensionColumns[0].name;
    }
    
    // Fallback: first column
    console.log("⚠️ Using fallback X-axis (first column):", columns[0]);
    return columns[0];
  }

  // Find best Y-axis column automatically
  findBestYAxis(columns, columnAnalysis, xAxisColumn) {
    console.log("🔍 Auto-detecting best Y-axis column(s)...");
    
    // Find numeric columns (excluding X-axis)
    const numericColumns = columnAnalysis.filter(c => 
      c.name !== xAxisColumn &&
      (c.role.includes('metric') ||
       c.dataType === 'integer' ||
       c.dataType === 'decimal' ||
       c.dataType === 'currency' ||
       c.dataType === 'percentage')
    );
    
    if (numericColumns.length > 0) {
      // Return first numeric column, or multiple if more than 1
      const selectedColumns = numericColumns.slice(0, 3).map(c => c.name).join(', ');
      console.log("✅ Found numeric column(s) for Y-axis:", selectedColumns);
      return selectedColumns;
    }
    
    // Fallback: second column if different from X-axis
    const fallbackCol = columns.find(c => c !== xAxisColumn);
    const result = fallbackCol || columns[0];
    console.log("⚠️ Using fallback Y-axis:", result);
    return result;
  }

  // Enhanced fallback with intelligent column selection
  getIntelligentFallback(columns, metadata, queryQuestion, rowCount) {
    console.log("🔧 Using intelligent fallback chart recommendation");
    
    const columnAnalysis = columns.map((col) => {
      const metaCol = metadata?.columns?.find(m => m.column_name === col);
      return {
        name: col,
        dataType: metaCol?.data_type || 'string',
        description: metaCol?.description || '',
        role: this.classifyColumnRole(
          metaCol?.data_type || 'string',
          metaCol?.description || '',
          col
        )
      };
    });
    
    const xAxis = this.findBestXAxis(columns, columnAnalysis);
    const yAxis = this.findBestYAxis(columns, columnAnalysis, xAxis);
    
    // Determine chart type based on data characteristics
    let chartType = 'bar';
    let reasoning = 'Bar chart for categorical comparison';
    
    const xAxisAnalysis = columnAnalysis.find(c => c.name === xAxis);
    const hasTemporalX = xAxisAnalysis?.role.includes('temporal');
    
    if (hasTemporalX) {
      chartType = 'line';
      reasoning = 'Line chart to show trend over time';
    } else if (rowCount <= 8 && columns.length === 2) {
      chartType = 'pie';
      reasoning = 'Pie chart to show proportional distribution with few categories';
    }
    
    return {
      chartType: chartType,
      reasoning: reasoning,
      xAxis: xAxis,
      yAxis: yAxis,
      title: queryQuestion || 'Data Visualization',
      insights: 'Examine the distribution and compare values across categories'
    };
  }

  // Prepare data for Chart.js based on AI recommendation
  prepareChartData(columns, values, recommendation) {
    console.log("📊 Preparing chart data for", recommendation.chartType, "chart");
    
    const chartType = recommendation.chartType;
    
    // Find column indices
    const xAxisIdx = columns.indexOf(recommendation.xAxis);
    const yAxisCol = recommendation.yAxis;
    
    if (xAxisIdx === -1) {
      throw new Error(`X-axis column "${recommendation.xAxis}" not found in data. Available columns: ${columns.join(', ')}`);
    }
    
    if (chartType === 'pie' || chartType === 'doughnut') {
      // For pie charts: use xAxis for labels, yAxis for values
      const yAxisIdx = columns.indexOf(yAxisCol);
      
      if (yAxisIdx === -1) {
        throw new Error(`Y-axis column "${yAxisCol}" not found in data. Available columns: ${columns.join(', ')}`);
      }
      
      return {
        labels: values.map(row => String(row[xAxisIdx])),
        datasets: [{
          label: yAxisCol,
          data: values.map(row => parseFloat(row[yAxisIdx]) || 0),
          backgroundColor: this.generateColors(values.length)
        }]
      };
    }

    // For bar/line/radar charts
    const labels = values.map(row => String(row[xAxisIdx]));
    const datasets = [];

    // Handle multiple Y-axis columns
    const yAxisColumns = yAxisCol.includes(',') 
      ? yAxisCol.split(',').map(c => c.trim())
      : [yAxisCol];

    yAxisColumns.forEach((colName, idx) => {
      const colIdx = columns.indexOf(colName);
      if (colIdx !== -1) {
        datasets.push({
          label: colName,
          data: values.map(row => parseFloat(row[colIdx]) || 0),
          backgroundColor: this.generateColors(1, idx)[0],
          borderColor: this.generateColors(1, idx)[0],
          borderWidth: 2,
          fill: chartType === 'line' ? false : true
        });
      } else {
        console.warn(`Warning: Y-axis column "${colName}" not found, skipping`);
      }
    });

    if (datasets.length === 0) {
      throw new Error(`No valid Y-axis columns found for chart. Tried: ${yAxisColumns.join(', ')}`);
    }

    console.log("✅ Chart data prepared:", { labels: labels.length, datasets: datasets.length });
    return { labels, datasets };
  }

  // Generate color palette
  generateColors(count, seed = 0) {
    const baseColors = [
      'rgba(54, 162, 235, 0.8)',   // Blue
      'rgba(255, 99, 132, 0.8)',   // Red
      'rgba(75, 192, 192, 0.8)',   // Green
      'rgba(255, 206, 86, 0.8)',   // Yellow
      'rgba(153, 102, 255, 0.8)',  // Purple
      'rgba(255, 159, 64, 0.8)',   // Orange
      'rgba(199, 199, 199, 0.8)',  // Gray
      'rgba(83, 102, 255, 0.8)',   // Indigo
      'rgba(255, 99, 255, 0.8)',   // Pink
      'rgba(99, 255, 132, 0.8)'    // Light Green
    ];

    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[(i + seed) % baseColors.length]);
    }
    return colors;
  }

  // Create chart options
  createChartOptions(chartType, title, insights) {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
        title: {
          display: !!title,
          text: title,
          font: { size: 14, weight: 'bold' }
        }
      }
    };

    // Add subtitle for insights if available
    if (insights) {
      baseOptions.plugins.subtitle = {
        display: true,
        text: insights,
        font: { size: 11, style: 'italic' },
        padding: { bottom: 10 }
      };
    }

    if (chartType === 'pie' || chartType === 'doughnut') {
      return baseOptions;
    }

    // Add scales for bar/line/radar charts
    return {
      ...baseOptions,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              // Format large numbers
              if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
              if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
              return value;
            }
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            autoSkip: false
          }
        }
      }
    };
  }

  // Generate chart from SQL results with AI recommendation
  async generateChartWithAI(container, metadata, queryQuestion, columns, values) {
    // Destroy existing chart
    if (this.currentChart) {
      console.log("🗑️ Destroying previous chart");
      this.currentChart.destroy();
      this.currentChart = null;
    }

    // Clear container and show loading
    container.innerHTML = '<p style="padding:20px; text-align:center;">🤖 AI is analyzing your data and metadata...</p>';

    // Check if data is suitable for charting
    if (!columns || columns.length === 0 || !values || values.length === 0) {
      container.innerHTML = '<p style="padding:10px; color:#666;">No data available for charting.</p>';
      return null;
    }

    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
      container.innerHTML = `
        <div style="padding:10px; color:#c62828; border:1px solid #ffcdd2; background:#ffebee; border-radius:4px;">
          <strong>❌ Chart.js library not loaded</strong><br>
          Please verify that lib/chart.umd.js is downloaded and included in manifest.json
        </div>
      `;
      console.error('Chart.js not loaded! Verify lib/chart.umd.js is in manifest.json');
      return null;
    }

    try {
      // Get AI recommendation (only send metadata + sample)
      const sampleData = values.slice(0, 3).map(row => {
        const obj = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });

      console.log('📊 Requesting AI chart recommendation with enhanced prompts...');
      const recommendation = await this.getChartRecommendation(
        metadata,
        queryQuestion,
        columns,
        values.length,
        sampleData
      );

      console.log('✅ AI Recommendation received:', recommendation);

      // Create enhanced container with proper sizing
      container.innerHTML = `
        <div style="margin-bottom:10px; padding:8px; background:#e3f2fd; border-radius:4px; font-size:11px;">
          <strong>🤖 AI Recommendation:</strong> ${recommendation.chartType.toUpperCase()} chart<br>
          <strong>Why:</strong> ${recommendation.reasoning || 'Best fit for this data'}<br>
          <strong>Axes:</strong> X="${recommendation.xAxis}", Y="${recommendation.yAxis}"
        </div>
        <div style="position:relative; height:400px; width:100%; background:#fff;">
          <canvas id="aiGeneratedChart"></canvas>
        </div>
      `;

      // Get canvas element
      this.chartCanvas = container.querySelector('#aiGeneratedChart');
      
      if (!this.chartCanvas) {
        console.error('❌ Canvas element not found after creation!');
        container.innerHTML = '<p style="padding:10px; color:#c62828;">Error: Canvas not created</p>';
        return null;
      }

      console.log('✅ Canvas element created and found');

      // Prepare data based on AI recommendation
      console.log('📊 Preparing chart data...');
      const chartData = this.prepareChartData(columns, values, recommendation);
      console.log('✅ Chart data prepared');

      const chartOptions = this.createChartOptions(
        recommendation.chartType,
        recommendation.title || queryQuestion,
        recommendation.insights
      );
      console.log('✅ Chart options created');

      // Create chart
      console.log('🎨 Creating Chart.js instance...');
      this.currentChart = new Chart(this.chartCanvas, {
        type: recommendation.chartType,
        data: chartData,
        options: chartOptions
      });

      console.log('✅ Chart created successfully!');
      console.log('Chart instance:', this.currentChart);

      return {
        chart: this.currentChart,
        recommendation: recommendation
      };

    } catch (error) {
      console.error('❌ Error creating AI-powered chart:', error);
      console.error('Error stack:', error.stack);
      container.innerHTML = `
        <div style="padding:10px; color:#c62828; border:1px solid #ffcdd2; background:#ffebee; border-radius:4px;">
          <strong>❌ Chart Generation Error</strong><br>
          ${error.message}<br>
          <small>Check browser console (F12) for detailed error information</small>
        </div>
      `;
      return null;
    }
  }

  // Destroy chart and AI session
  destroy() {
    if (this.currentChart) {
      console.log("🗑️ Destroying chart");
      this.currentChart.destroy();
      this.currentChart = null;
    }
    if (this.aiSession) {
      console.log("🗑️ Destroying AI session");
      this.aiSession.destroy?.();
      this.aiSession = null;
    }
  }
}
