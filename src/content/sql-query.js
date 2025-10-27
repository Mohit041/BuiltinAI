// src/content/sql-query.js
// SQL Query Manager with Natural Language to SQL conversion
// Enhanced with complete metadata-to-SQLite type mapping and name-based column matching

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
      'boolean': 'INTEGER',      // SQLite uses 0/1 for booleans
      'percentage': 'REAL',      // Store as decimal (0.75 for 75%)
      'currency': 'REAL',        // Store as numeric value
      'date': 'TEXT',            // SQLite doesn't have native DATE type
      'time': 'TEXT',            // Store as text (HH:MM:SS)
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
          // Handle suffixes like "4.21M", "500K", "1.5B"
          if (/[KMBkmb]$/i.test(str)) {
            const num = parseFloat(str.replace(/[KMBkmb,]/gi, ''));
            const suffix = str.slice(-1).toUpperCase();
            const multipliers = { 'K': 1000, 'M': 1000000, 'B': 1000000000 };
            return Math.round(num * (multipliers[suffix] || 1));
          }
          // Remove commas and parse
          const intVal = parseInt(str.replace(/,/g, ''), 10);
          return isNaN(intVal) ? null : intVal;

        case 'decimal':
          // Handle suffixes like "4.21M", "500K", "1.5B"
          if (/[KMBkmb]$/i.test(str)) {
            const num = parseFloat(str.replace(/[KMBkmb,]/gi, ''));
            const suffix = str.slice(-1).toUpperCase();
            const multipliers = { 'K': 1000, 'M': 1000000, 'B': 1000000000 };
            return num * (multipliers[suffix] || 1);
          }
          // Remove commas, +/- signs and parse
          const floatVal = parseFloat(str.replace(/[,+]/g, ''));
          return isNaN(floatVal) ? null : floatVal;

        case 'boolean':
          // Convert to 1 or 0
          if (/^(true|yes|y|1)$/i.test(str)) return 1;
          if (/^(false|no|n|0)$/i.test(str)) return 0;
          return null;

        case 'percentage':
          // Convert "+0.20%" to 0.002 or keep as decimal
          if (str.includes('%')) {
            const numStr = str.replace(/[%+]/g, '').trim();
            const numVal = parseFloat(numStr);
            return isNaN(numVal) ? null : numVal / 100;
          }
          const pVal = parseFloat(str.replace(/\+/g, ''));
          return isNaN(pVal) ? null : pVal / 100;

        case 'currency':
          // Remove currency symbols and commas, then parse
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
      return str; // Fallback to original string
    }
  }

  // Create temporary table from extracted data
  async createTableFromJSON(headers, data, metadata = null) {
    if (!this.SQL) await this.initialize();
    
    // Store metadata for later use in AI prompts
    this.metadata = metadata;
    
    // Create new database instance
    this.db = new this.SQL.Database();
    
    console.log("📊 Creating table with", headers.length, "columns");
    
    // Build column definitions with proper types
    const columnDefs = headers.map((header) => {
      let sqliteType = 'TEXT'; // Default
      
      if (metadata && metadata.columns) {
        // MATCH BY COLUMN NAME, NOT INDEX
        const metaColumn = metadata.columns.find(col => col.column_name === header);
        
        if (metaColumn) {
          const metadataType = metaColumn.data_type;
          sqliteType = this.mapToSQLiteType(metadataType);
          console.log(`✅ Column "${header}": ${metadataType} → SQLite ${sqliteType}`);
        } else {
          console.warn(`⚠️ Column "${header}": No metadata found, defaulting to TEXT`);
        }
      } else {
        console.warn(`⚠️ No metadata available, all columns defaulting to TEXT`);
      }
      
      // Escape column names with quotes to handle spaces/special chars
      return `"${header.replace(/"/g, '""')}" ${sqliteType}`;
    });

    // Create table
    const createTableSQL = `CREATE TABLE ${this.tableName} (${columnDefs.join(', ')})`;
    this.db.run(createTableSQL);
    console.log("✅ Table created with schema:", createTableSQL);

    // Insert data with type conversion
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
            
            // MATCH BY COLUMN NAME, NOT INDEX
            let dataType = 'string';
            if (metadata && metadata.columns) {
              const metaColumn = metadata.columns.find(col => col.column_name === header);
              if (metaColumn) {
                dataType = metaColumn.data_type;
              }
            }
            
            // Convert value based on type
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
      
      // Build enhanced schema description with metadata
      let schemaDescription = '';
      
      if (metadata && metadata.columns) {
        // Use rich metadata for better context
        schemaDescription = schema.map((col) => {
          const metaCol = metadata.columns.find(m => m.column_name === col.name);
          if (metaCol) {
            // Include SQLite type information
            return `"${col.name}" (SQLite: ${col.type}, Type: ${metaCol.data_type}): ${metaCol.description}. Sample values: ${metaCol.sample_values.slice(0, 3).join(', ')}`;
          }
          return `"${col.name}" (${col.type})`;
        }).join('\n  - ');
      } else {
        // Fallback to basic schema
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
- Make sure to select all the relevant columns to answer the user query
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
      
      // Security check: ensure it's a SELECT query
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

  // Execute natural language query (combines NL→SQL and execution)
  async queryWithNaturalLanguage(question) {
    const { sql, explanation } = await this.naturalLanguageToSQL(question);
    const results = this.executeQuery(sql);
    
    return {
      question,
      sql,
      explanation,
      results
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
