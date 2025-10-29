// src/content/sql-query.js
// SQL Query Manager with Natural Language to SQL conversion
// Enhanced with AI-powered result analysis (Direct Answer + Key Insights only)

class SQLQueryManager {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.tableName = 'extracted_table';
    this.aiSession = null;
    this.metadata = null;
  }

  // Initialize sql.js
  async initialize() {
    if (this.SQL) return;
    
    try {
      this.SQL = await initSqlJs({
        locateFile: file => chrome.runtime.getURL('lib/' + file)
      });
      console.log("sql.js initialized");
    } catch (error) {
      console.error("Failed to initialize sql.js:", error);
      throw error;
    }
  }

  // Map metadata data types to SQLite types
  mapToSQLiteType(metadataType) {
    const typeMap = {
      'integer': 'INTEGER',
      'decimal': 'REAL',
      'boolean': 'INTEGER',
      'percentage': 'REAL',
      'currency': 'REAL',
      'date': 'TEXT',
      'time': 'TEXT',
      'text': 'TEXT',
      'string': 'TEXT'
    };
    
    return typeMap[metadataType.toLowerCase()] || 'TEXT';
  }

  // Convert value based on detected type for insertion
  convertValueForType(value, dataType) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const type = dataType.toLowerCase();
    const str = String(value).trim();

    try {
      switch (type) {
        case 'integer':
          if (/[KMBkmb]$/i.test(str)) {
            const num = parseFloat(str.replace(/[KMBkmb,]/gi, ''));
            const suffix = str.slice(-1).toUpperCase();
            const multipliers = { 'K': 1000, 'M': 1000000, 'B': 1000000000 };
            return Math.round(num * (multipliers[suffix] || 1));
          }
          const intVal = parseInt(str.replace(/,/g, ''), 10);
          return isNaN(intVal) ? null : intVal;

        case 'decimal':
          if (/[KMBkmb]$/i.test(str)) {
            const num = parseFloat(str.replace(/[KMBkmb,]/gi, ''));
            const suffix = str.slice(-1).toUpperCase();
            const multipliers = { 'K': 1000, 'M': 1000000, 'B': 1000000000 };
            return num * (multipliers[suffix] || 1);
          }
          const floatVal = parseFloat(str.replace(/[,+]/g, ''));
          return isNaN(floatVal) ? null : floatVal;

        case 'boolean':
          if (/^(true|yes|y|1)$/i.test(str)) return 1;
          if (/^(false|no|n|0)$/i.test(str)) return 0;
          return null;

        case 'percentage':
          if (str.includes('%')) {
            const numStr = str.replace(/[%+]/g, '').trim();
            const numVal = parseFloat(numStr);
            return isNaN(numVal) ? null : numVal / 100;
          }
          const pVal = parseFloat(str.replace(/\+/g, ''));
          return isNaN(pVal) ? null : pVal / 100;

        case 'currency':
          const currencyVal = parseFloat(str.replace(/[$€£¥₹,+]/g, '').trim());
          return isNaN(currencyVal) ? null : currencyVal;

        case 'date':
        case 'time':
        case 'text':
        case 'string':
        default:
          return str;
      }
    } catch (error) {
      console.warn(`Error converting value "${value}" for type ${dataType}:`, error);
      return str;
    }
  }

  // Create temporary table from extracted data
  async createTableFromJSON(headers, data, metadata = null) {
    if (!this.SQL) await this.initialize();
    
    this.metadata = metadata;
    this.db = new this.SQL.Database();
    
    console.log("📊 Creating table with", headers.length, "columns");
    
    const columnDefs = headers.map((header) => {
      let sqliteType = 'TEXT';
      
      if (metadata && metadata.columns) {
        const metaColumn = metadata.columns.find(col => col.column_name === header);
        
        if (metaColumn) {
          const metadataType = metaColumn.data_type;
          sqliteType = this.mapToSQLiteType(metadataType);
          console.log(`✅ Column "${header}": ${metadataType} → SQLite ${sqliteType}`);
        } else {
          console.warn(`⚠️ Column "${header}": No metadata found, defaulting to TEXT`);
        }
      }
      
      return `"${header.replace(/"/g, '""')}" ${sqliteType}`;
    });

    const createTableSQL = `CREATE TABLE ${this.tableName} (${columnDefs.join(', ')})`;
    this.db.run(createTableSQL);
    console.log("✅ Table created with schema:", createTableSQL);

    if (data.length > 0) {
      const placeholders = headers.map(() => '?').join(',');
      const insertSQL = `INSERT INTO ${this.tableName} VALUES (${placeholders})`;
      
      const stmt = this.db.prepare(insertSQL);
      
      let successCount = 0;
      let errorCount = 0;
      
      data.forEach((row, rowIdx) => {
        try {
          const values = headers.map((header) => {
            const rawValue = row[header];
            
            let dataType = 'string';
            if (metadata && metadata.columns) {
              const metaColumn = metadata.columns.find(col => col.column_name === header);
              if (metaColumn) {
                dataType = metaColumn.data_type;
              }
            }
            
            return this.convertValueForType(rawValue, dataType);
          });
          
          stmt.run(values);
          successCount++;
        } catch (error) {
          console.error(`❌ Error inserting row ${rowIdx}:`, error, row);
          errorCount++;
        }
      });
      
      stmt.free();
      
      console.log(`✅ Inserted ${successCount} rows successfully`);
      if (errorCount > 0) {
        console.warn(`⚠️ Failed to insert ${errorCount} rows`);
      }
    }

    return {
      tableName: this.tableName,
      rowCount: data.length,
      columns: headers
    };
  }

  // Get table schema for AI context
  getTableSchema() {
    if (!this.db) return null;
    
    const schemaQuery = `PRAGMA table_info(${this.tableName})`;
    const result = this.db.exec(schemaQuery);
    
    if (result.length > 0) {
      return result[0].values.map(col => ({
        name: col[1],
        type: col[2]
      }));
    }
    return null;
  }

  // Initialize AI session for NL to SQL with metadata-enhanced prompts
  async initializeAISession(metadata = null) {
    if (this.aiSession) return this.aiSession;
    
    try {
      const schema = this.getTableSchema();
      
      let schemaDescription = '';
      
      if (metadata && metadata.columns) {
        schemaDescription = schema.map((col) => {
          const metaCol = metadata.columns.find(m => m.column_name === col.name);
          if (metaCol) {
            return `"${col.name}" (SQLite: ${col.type}, Type: ${metaCol.data_type}): ${metaCol.description}. Sample values: ${metaCol.sample_values.slice(0, 3).join(', ')}`;
          }
          return `"${col.name}" (${col.type})`;
        }).join('\n  - ');
      } else {
        schemaDescription = schema
          .map(col => `"${col.name}" (${col.type})`)
          .join(', ');
      }

      const systemPrompt = metadata 
        ? `You are a SQL query generator. Convert natural language questions into valid SQLite queries.

Table: ${this.tableName}
Description: ${metadata.table_description}

Columns with context:
  - ${schemaDescription}

Important SQLite Type Notes:
- INTEGER columns: Use standard comparison operators (>, <, =)
- REAL columns: Numeric columns for decimals, percentages, currency
- TEXT columns: Use LIKE for pattern matching
- Boolean values are stored as INTEGER (0 = false, 1 = true)
- Percentages are stored as decimals (0.75 = 75%)
- Volume numbers with K/M/B suffixes are converted to full numbers

Rules:
- Return ONLY valid SQL SELECT statements
- Use SQLite syntax
- Wrap column names in double quotes to handle spaces
- SELECT all columns that are relevant for answering the question AND for visualization
  * For "show X by Y" queries, include both X and Y columns
  * For "top N" queries, include the identifier column and the metric column
  * For aggregations, include the grouping column(s) and the aggregated value(s)
- Return JSON: {"sql": "SELECT ...", "explanation": "brief explanation"}
- Never use INSERT, UPDATE, DELETE, or DROP
- Use the column descriptions and sample values to understand what data means
- For aggregations, use SQL functions like COUNT, SUM, AVG, MAX, MIN
- For filtering, use WHERE clause with appropriate comparisons
- For sorting, use ORDER BY
- Be smart about which columns to use based on the question context
- When filtering boolean columns, use = 1 for true and = 0 for false
- When displaying results, use meaningful column aliases with AS`
        : `You are a SQL query generator. Convert natural language questions into valid SQLite queries.

Table: ${this.tableName}
Columns: ${schemaDescription}

Rules:
- Return ONLY valid SQL SELECT statements
- Use SQLite syntax
- Wrap column names in double quotes to handle spaces
- Return JSON: {"sql": "SELECT ...", "explanation": "brief explanation"}
- Never use INSERT, UPDATE, DELETE, or DROP`;

      this.aiSession = await LanguageModel.create({
        initialPrompts: [{
          role: 'system',
          content: systemPrompt
        }]
      });
      
      console.log("🤖 AI session for NL→SQL initialized with", metadata ? "rich metadata" : "basic schema");
      return this.aiSession;
    } catch (error) {
      console.error("Failed to initialize AI session:", error);
      throw error;
    }
  }

  // Convert natural language to SQL
  async naturalLanguageToSQL(question) {
    await this.initializeAISession(this.metadata);
    
    try {
      const prompt = `Convert this question to SQL: "${question}"`;
      
      const response = await this.aiSession.prompt(prompt, {
        responseConstraint: {
          type: "object",
          properties: {
            sql: { type: "string" },
            explanation: { type: "string" }
          },
          required: ["sql"]
        }
      });

      const result = typeof response === "string" ? JSON.parse(response) : response;
      
      if (!this.isValidQuery(result.sql)) {
        throw new Error("Generated query is not a valid SELECT statement");
      }

      console.log("🔍 Generated SQL:", result.sql);
      return result;
    } catch (error) {
      console.error("Error converting NL to SQL:", error);
      throw error;
    }
  }

  // Calculate basic statistics for numeric columns
  calculateStatistics(results) {
    if (!results.values || results.values.length === 0) return null;
    
    const stats = {};
    
    results.columns.forEach((col, colIdx) => {
      // Try to detect if column is numeric
      const numericValues = results.values
        .map(row => parseFloat(row[colIdx]))
        .filter(val => !isNaN(val));
      
      if (numericValues.length > results.values.length * 0.5) { // If >50% are numeric
        const sorted = numericValues.sort((a, b) => a - b);
        const sum = numericValues.reduce((a, b) => a + b, 0);
        
        stats[col] = {
          count: numericValues.length,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          avg: sum / numericValues.length,
          sum: sum,
          range: sorted[sorted.length - 1] - sorted[0]
        };
      }
    });
    
    return Object.keys(stats).length > 0 ? stats : null;
  }

  // Simplified: Analyze SQL results and generate insights with AI (Direct Answer + Key Insights only)
  async analyzeQueryResults(question, sql, results, metadata) {
    try {
      await this.initializeAISession(metadata);
      
      // Prepare results summary
      const resultsSummary = {
        columns: results.columns,
        rowCount: results.values.length,
        sampleRows: results.values.slice(0, 10)
      };
      
      // Get column context from metadata
      const columnContext = results.columns.map(colName => {
        const metaCol = metadata?.columns?.find(m => m.column_name === colName);
        return {
          name: colName,
          type: metaCol?.data_type || 'unknown',
          description: metaCol?.description || 'No description'
        };
      });

      // Calculate basic statistics for numeric columns
      const statistics = this.calculateStatistics(results);

      const prompt = `
You are an expert data analyst providing concise, actionable insights based on query results.

=== USER'S QUESTION ===
"${question}"

=== SQL QUERY EXECUTED ===
${sql}

=== QUERY RESULTS SUMMARY ===
- Total Rows Returned: ${resultsSummary.rowCount}
- Columns: ${resultsSummary.columns.join(', ')}

=== COLUMN CONTEXT (with metadata) ===
${columnContext.map(col => `- "${col.name}" (${col.type}): ${col.description}`).join('\n')}

=== FULL DATA (first 10 rows for analysis) ===
${JSON.stringify(resultsSummary.sampleRows.map(row => {
  const obj = {};
  results.columns.forEach((col, idx) => {
    obj[col] = row[idx];
  });
  return obj;
}), null, 2)}

${statistics ? `
=== STATISTICAL SUMMARY ===
${JSON.stringify(statistics, null, 2)}
` : ''}

=== YOUR ANALYSIS TASK ===

Provide a concise analysis with these two components:

1. **Direct Answer** (2-3 sentences)
   - Immediately and clearly answer the user's specific question
   - Use exact numbers, names, and values from the data
   - Be precise, comprehensive, and informative

2. **Key Insights** (4-6 bullet points)
   - Identify the most significant insights from the data
   - Include specific values, rankings, or comparisons
   - Highlight standout data points (highest, lowest, unusual values)
   - Compare values to show magnitude differences (e.g., "X is 3.2x larger than Y")
   - Use percentages to show proportions and distributions
   - Identify patterns, trends, correlations, or outliers
   - Point out what's notable, surprising, or actionable

=== ANALYSIS GUIDELINES ===

**Be Specific:**
- Use actual numbers from the data (not "some", "many", "few")
- Name specific entities (countries, products, categories, names)
- Calculate and mention percentages, ratios, or differences
- Use comparative language ("largest", "smallest", "doubled", "increased by X%")

**Be Insightful:**
- Don't just describe what's in the data - explain what it MEANS
- Connect data points to tell a story
- Identify cause-and-effect relationships if visible
- Point out surprising or counterintuitive findings
- Highlight trends, patterns, clustering, or distributions
- Mention outliers or anomalies

**Examples of GOOD insights:**
✅ "China's population of 1.44B is 4.2x larger than the US (331M), representing 18% of global population"
✅ "The top 3 countries account for 42% of the total, while the bottom 5 represent only 8% combined"
✅ "There's a steep drop-off after position 2, with a 76% decrease from India (1.38B) to USA (331M)"
✅ "Asian countries dominate with 4 out of 5 positions (80%), showing regional concentration"

**Examples of BAD insights:**
❌ "Some countries have large populations"
❌ "The data shows population numbers"
❌ "There are differences between countries"

=== RESPONSE FORMAT ===
Return ONLY valid JSON:
{
  "directAnswer": "Clear, comprehensive answer with exact numbers and context (2-3 sentences)",
  "keyInsights": [
    "First specific insight with numbers, comparisons, and context",
    "Second specific insight with percentages or ratios",
    "Third insight about patterns, trends, or distributions",
    "Fourth insight about outliers or notable observations",
    "Fifth insight connecting data points or showing relationships",
    "Sixth insight (if applicable) with actionable context"
  ]
}

CRITICAL REQUIREMENTS:
- Use SPECIFIC numbers and names from the actual data
- Calculate comparisons, ratios, and percentages
- Connect data points to tell a meaningful story
- Be concise but comprehensive (no fluff)
- Each insight should provide genuine value, not just description
`;

      const response = await this.aiSession.prompt(prompt, {
        responseConstraint: {
          type: "object",
          properties: {
            directAnswer: { type: "string" },
            keyInsights: { type: "array", items: { type: "string" } }
          },
          required: ["directAnswer", "keyInsights"]
        }
      });

      const analysis = typeof response === "string" ? JSON.parse(response) : response;
      
      console.log("✅ Simplified AI Analysis generated:", analysis);
      return analysis;

    } catch (error) {
      console.error("Error generating AI analysis:", error);
      // Return basic fallback analysis
      return {
        directAnswer: `Found ${results.values.length} result(s) matching your query.`,
        keyInsights: [
          `Query returned ${results.values.length} row(s)`,
          `Columns included: ${results.columns.join(', ')}`
        ]
      };
    }
  }

  // Validate that query is safe (SELECT only)
  isValidQuery(sql) {
    const trimmed = sql.trim().toUpperCase();
    const prohibited = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'PRAGMA'];
    
    if (!trimmed.startsWith('SELECT')) return false;
    
    for (const keyword of prohibited) {
      if (trimmed.includes(keyword)) return false;
    }
    
    return true;
  }

  // Execute SQL query
  executeQuery(sql) {
    if (!this.db) throw new Error("Database not initialized");
    if (!this.isValidQuery(sql)) throw new Error("Invalid query");
    
    try {
      console.log("⚡ Executing SQL:", sql);
      const results = this.db.exec(sql);
      
      if (results.length === 0) {
        console.log("📭 Query returned no results");
        return { columns: [], values: [] };
      }
      
      console.log(`📊 Query returned ${results[0].values.length} row(s)`);
      return {
        columns: results[0].columns,
        values: results[0].values
      };
    } catch (error) {
      console.error("Query execution error:", error);
      throw error;
    }
  }

  // Execute natural language query (combines NL→SQL, execution, and analysis)
  async queryWithNaturalLanguage(question) {
    const { sql, explanation } = await this.naturalLanguageToSQL(question);
    const results = this.executeQuery(sql);
    
    // Generate AI analysis of results
    console.log("🤖 Generating simplified AI analysis of query results...");
    const analysis = await this.analyzeQueryResults(question, sql, results, this.metadata);
    
    return {
      question,
      sql,
      explanation,
      results,
      analysis  // Simplified AI analysis
    };
  }

  // Clean up and destroy database
  destroy() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    if (this.aiSession) {
      this.aiSession.destroy?.();
      this.aiSession = null;
    }
    this.metadata = null;
    console.log("🗑️ SQL database destroyed");
  }
}
