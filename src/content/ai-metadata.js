// src/content/ai-metadata.js
// AIMetadataGenerator using Chrome Prompt API (direct LanguageModel)
// Enhanced with robust data type inference and debugging

class AIMetadataGenerator {
  constructor() {
    this.session = null;
  }

  // Create session
  async initializeSession() {
    if (this.session) return this.session;

    try {
      this.session = await LanguageModel.create({
        initialPrompts: [{
          role: 'system',
          content: 'You are a helpful assistant that generates rich metadata for HTML tables. You excel at analyzing data patterns and inferring accurate data types.'
        }]
      });
      console.log("AI session initialized");
      return this.session;
    } catch (error) {
      console.error("Failed to initialize AI session:", error);
      throw error;
    }
  }

  // Improved data type inference with multiple value analysis
  inferDataType(values) {
    if (!values || values.length === 0) return "string";

    // Filter out empty/null values
    const nonEmptyValues = values.filter(v => v && String(v).trim() !== "");
    
    if (nonEmptyValues.length === 0) return "string";

    // Take a sample (max 100 values for performance)
    const sampleSize = Math.min(nonEmptyValues.length, 100);
    const samples = nonEmptyValues.slice(0, sampleSize);

    // Count matches for each type
    let integerCount = 0;
    let decimalCount = 0;
    let dateCount = 0;
    let timeCount = 0;
    let booleanCount = 0;
    let percentageCount = 0;
    let currencyCount = 0;

    samples.forEach(value => {
      const str = String(value).trim();
      
      // Skip empty strings
      if (str === '') return;

      // Boolean check (case-insensitive)
      if (/^(true|false|yes|no|y|n|0|1)$/i.test(str)) {
        booleanCount++;
        return;
      }

      // Volume with suffixes (e.g., "4.21M", "500K", "1.5B")
      if (/^\d+\.?\d*[KMBkmb]$/i.test(str)) {
        decimalCount++;
        return;
      }

      // Percentage with + or - prefix (e.g., "+2.5%", "-1.2%")
      if (/^[+-]?\d+\.?\d*\s*%$/.test(str)) {
        percentageCount++;
        return;
      }

      // Currency check (e.g., "$100", "€50.50", "£25", "-$10.50")
      if (/^-?[$€£¥₹]\s*\d+\.?\d*$|^-?\d+\.?\d*\s*[$€£¥₹]$/.test(str)) {
        currencyCount++;
        return;
      }

      // Date check (various formats)
      // YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, etc.
      if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$|^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(str)) {
        dateCount++;
        return;
      }

      // Time check (HH:MM or HH:MM:SS)
      if (/^\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM|am|pm))?$/.test(str)) {
        timeCount++;
        return;
      }

      // Number check (integer or decimal)
      // Remove commas and check if it's a valid number
      const cleanedStr = str.replace(/,/g, '');
      
      // Must be ONLY a number (not mixed with text)
      if (/^-?\d+\.?\d*$/.test(cleanedStr)) {
        const num = parseFloat(cleanedStr);
        if (!isNaN(num)) {
          // Check if it's a decimal
          if (cleanedStr.includes('.')) {
            decimalCount++;
          } else {
            integerCount++;
          }
          return;
        }
      }
    });

    // Calculate thresholds (70% confidence required)
    const threshold = sampleSize * 0.7;

    // Return the most specific type that meets the threshold
    if (booleanCount >= threshold) return "boolean";
    if (percentageCount >= threshold) return "percentage";
    if (currencyCount >= threshold) return "currency";
    if (dateCount >= threshold) return "date";
    if (timeCount >= threshold) return "time";
    if (integerCount >= threshold) return "integer";
    if (decimalCount >= threshold) return "decimal";
    
    // Mixed numeric (some integers, some decimals)
    if ((integerCount + decimalCount) >= threshold) {
      return decimalCount > integerCount / 2 ? "decimal" : "integer";
    }

    // Check for long text (average length > 100 characters)
    const avgLength = samples.reduce((sum, val) => sum + String(val).length, 0) / samples.length;
    if (avgLength > 100) return "text";

    // Default to string
    return "string";
  }

  // Extract unique sample values for a column
  extractSampleValues(values, limit = 5) {
    const unique = [...new Set(values)]
      .filter(v => v && String(v).trim() !== "")
      .slice(0, limit);
    
    return unique.map(v => String(v).trim());
  }

  // Generate table metadata with improved prompts
  async generateTableMetadata(headers, data) {
    console.log("🔍 Starting metadata generation for table with", headers.length, "columns and", data.length, "rows");
    
    try {
      const session = await this.initializeSession();

      // Pre-analyze each column for type hints
      const columnHints = headers.map(header => {
        const colData = data.map(row => row[header] || "");
        const inferredType = this.inferDataType(colData);
        const samples = this.extractSampleValues(colData, 5);
        return {
          name: header,
          suggestedType: inferredType,
          samples: samples
        };
      });

      // Debug logging
      console.log("=== PRE-ANALYSIS TYPE DETECTION ===");
      columnHints.forEach(ch => {
        console.log(`📊 "${ch.name}": ${ch.suggestedType} | Samples: [${ch.samples.join(', ')}]`);
      });
      console.log("===================================");

      // Prepare enhanced data for AI analysis
      const sampleRows = data.slice(0, 10);
      const headerList = headers.join(', ');

      const columnHintsStr = columnHints.map(ch => 
        `"${ch.name}": suggested_type="${ch.suggestedType}", samples=[${ch.samples.slice(0, 3).join(', ')}]`
      ).join('\n  ');

      const prompt = `
You are a metadata generator for HTML tables. 
Your task is to produce structured JSON metadata that describes the table and each column.

CRITICAL: I have PRE-ANALYZED the data types. Use these suggestions unless they are clearly wrong.

Guidelines:
- Provide a concise table description (<=200 characters) explaining the purpose of the table.
- For each column, use the SUGGESTED TYPE unless the sample data clearly contradicts it
- Available data types: integer, decimal, string, text, date, time, boolean, percentage, currency
- Type selection rules:
  * If suggested_type is already specific (integer, decimal, percentage, etc.), USE IT
  * Only override if sample values clearly show a different type
  * "integer" for whole numbers (e.g., 1, 42, 100, 1000)
  * "decimal" for numbers with decimal points (e.g., 3.14, 99.99, 0.5)
  * "boolean" for true/false, yes/no, 0/1 values
  * "percentage" for values like "75%", "12.5%", "-5%"
  * "currency" for monetary values like "$100", "€50.50"
  * "date" for date values (2024-01-15, 01/15/2024, etc.)
  * "time" for time values (14:30, 2:30 PM, etc.)
  * "text" for long text content (>100 chars avg)
  * "string" for short text that doesn't fit other categories (names, labels, codes)
- Describe each column's meaning in plain English (<=150 characters)
- Include up to 5 unique sample values
- Return only valid JSON matching the schema, nothing else.

Table headers: ${headerList}

Pre-analyzed column hints (TRUST THESE):
  ${columnHintsStr}

Sample rows (first 10):
${JSON.stringify(sampleRows, null, 2)}

JSON schema:
{
  "table_description": "string",
  "column_count": "integer",
  "columns": [
    {
      "column_name": "string",
      "data_type": "string (one of: integer, decimal, string, text, date, time, boolean, percentage, currency)",
      "description": "string",
      "sample_values": ["string"]
    }
  ]
}
`;

      // Prompt model
      const response = await session.prompt(prompt, {
        responseConstraint: {
          type: "object",
          properties: {
            table_description: { type: "string" },
            column_count: { type: "integer" },
            columns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  column_name: { type: "string" },
                  data_type: { type: "string" },
                  description: { type: "string" },
                  sample_values: { type: "array", items: { type: "string" } }
                },
                required: ["column_name", "data_type"]
              }
            }
          },
          required: ["table_description", "column_count", "columns"]
        },
        temperature: 0
      });

      // Parse JSON
      const metadata = typeof response === "string" ? JSON.parse(response) : response;

      console.log("=== AI RETURNED TYPES ===");
      metadata.columns.forEach(col => {
        console.log(`🤖 "${col.column_name}": ${col.data_type}`);
      });
      console.log("=========================");

      // ENFORCE our pre-analyzed types - AI should not override numeric/percentage detection
      metadata.columns = metadata.columns.map((col, idx) => {
        const hint = columnHints.find(ch => ch.name === col.column_name) || columnHints[idx];
        
        if (hint) {
          const aiType = col.data_type.toLowerCase();
          const ourType = hint.suggestedType.toLowerCase();
          
          // If AI says "string" but we detected something more specific, use ours
          if (aiType === 'string' && ourType !== 'string') {
            console.log(`✅ Correcting "${col.column_name}": ${aiType} → ${ourType} (based on data analysis)`);
            col.data_type = ourType;
          }
          // If AI says "text" but we detected something more specific, use ours
          else if (aiType === 'text' && ourType !== 'string' && ourType !== 'text') {
            console.log(`✅ Correcting "${col.column_name}": ${aiType} → ${ourType} (based on data analysis)`);
            col.data_type = ourType;
          }
          // If we detected percentage/currency and AI didn't, use ours
          else if ((ourType === 'percentage' || ourType === 'currency') && aiType !== ourType) {
            console.log(`✅ Correcting "${col.column_name}": ${aiType} → ${ourType} (special type detected)`);
            col.data_type = ourType;
          }
        }
        
        return col;
      });

      console.log("=== FINAL TYPES (after correction) ===");
      metadata.columns.forEach(col => {
        console.log(`✅ "${col.column_name}": ${col.data_type}`);
      });
      console.log("======================================");

      // Add extra info: row_count, generated_at
      metadata.row_count = data.length;
      metadata.generated_at = new Date().toISOString();

      return metadata;

    } catch (error) {
      console.error("❌ Error generating AI metadata:", error);
      console.log("⚠️ Falling back to basic metadata generation");
      return this.generateBasicMetadata(headers, data);
    }
  }

  // Enhanced fallback metadata
  generateBasicMetadata(headers, data) {
    console.log("🔧 Generating fallback metadata (AI unavailable)");
    
    const columns = headers.map((header, idx) => {
      const colData = data.map(row => row[header] || "");
      const dataType = this.inferDataType(colData);
      const sampleValues = this.extractSampleValues(colData);
      
      console.log(`📊 "${header}": ${dataType} | Samples: [${sampleValues.join(', ')}]`);
      
      return {
        column_name: header,
        data_type: dataType,
        description: `Column ${idx + 1}: ${header}`,
        sample_values: sampleValues
      };
    });

    return {
      table_description: `Table with ${headers.length} columns and ${data.length} rows`,
      column_count: headers.length,
      row_count: data.length,
      generated_at: new Date().toISOString(),
      columns
    };
  }

  async closeSession() {
    if (this.session) {
      this.session.destroy?.();
      this.session = null;
    }
  }
}
