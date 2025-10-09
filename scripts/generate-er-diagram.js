#!/usr/bin/env node
/**
 * ER Diagram Generator
 * 
 * This script parses database/schema.sql and generates a Mermaid ER diagram
 * that can be embedded in SCHEMA_ARCHITECTURE.md
 */

const fs = require('fs');
const path = require('path');

class ERDiagramGenerator {
    constructor() {
        this.basePath = path.resolve(__dirname, '..');
        this.schemaPath = path.join(this.basePath, 'database', 'schema.sql');
        this.tables = {};
        this.relationships = [];
    }

    log(message) {
        console.log(message);
    }

    // Parse schema.sql to extract tables, columns, and relationships
    parseSchema() {
        this.log('📊 Parsing database/schema.sql...');
        
        if (!fs.existsSync(this.schemaPath)) {
            throw new Error(`Schema file not found at ${this.schemaPath}`);
        }

        const schemaContent = fs.readFileSync(this.schemaPath, 'utf8');

        // Extract table definitions
        const tableRegex = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\);/gi;
        let match;

        while ((match = tableRegex.exec(schemaContent)) !== null) {
            const tableName = match[1];
            const tableBody = match[2];
            
            this.tables[tableName] = this.parseTableColumns(tableBody);
            this.extractRelationships(tableName, tableBody);
        }

        this.log(`✅ Found ${Object.keys(this.tables).length} tables`);
    }

    // Parse columns from table definition
    parseTableColumns(tableBody) {
        const columns = [];
        const lines = tableBody.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip empty lines, comments, and constraints
            if (!trimmed || trimmed.startsWith('--') || 
                trimmed.startsWith('UNIQUE') || 
                trimmed.startsWith('PRIMARY') ||
                trimmed.startsWith('FOREIGN') ||
                trimmed.startsWith('CHECK') ||
                trimmed.startsWith('CONSTRAINT')) {
                continue;
            }

            // Extract column definition
            const columnMatch = trimmed.match(/^(\w+)\s+([\w\(\),\s]+)/);
            if (columnMatch) {
                const columnName = columnMatch[1];
                let dataType = columnMatch[2].split(/\s+/)[0]; // Get first word as type
                
                // Clean up data type
                dataType = dataType.replace(/,$/, '');
                
                // Check for PRIMARY KEY
                const isPrimaryKey = trimmed.includes('PRIMARY KEY');
                const isForeignKey = trimmed.includes('REFERENCES');
                const isUnique = trimmed.includes('UNIQUE');
                const isNotNull = trimmed.includes('NOT NULL');
                
                columns.push({
                    name: columnName,
                    type: dataType,
                    isPrimaryKey,
                    isForeignKey,
                    isUnique,
                    isNotNull
                });
            }
        }

        return columns;
    }

    // Extract foreign key relationships
    extractRelationships(tableName, tableBody) {
        // Pattern: column_name TYPE REFERENCES other_table(other_column)
        const fkRegex = /(\w+)\s+\w+\s+REFERENCES\s+(\w+)\s*\((\w+)\)/gi;
        let match;

        while ((match = fkRegex.exec(tableBody)) !== null) {
            this.relationships.push({
                from: tableName,
                fromColumn: match[1],
                to: match[2],
                toColumn: match[3],
                type: 'one-to-many' // Default assumption
            });
        }
    }

    // Generate Mermaid ER diagram
    generateMermaidDiagram() {
        this.log('\n🎨 Generating Mermaid ER diagram...');

        let diagram = '```mermaid\nerDiagram\n';

        // Add table definitions
        Object.keys(this.tables).forEach(tableName => {
            const columns = this.tables[tableName];
            
            diagram += `    ${tableName} {\n`;
            columns.forEach(col => {
                let attributes = [];
                if (col.isPrimaryKey) attributes.push('PK');
                if (col.isForeignKey) attributes.push('FK');
                if (col.isUnique) attributes.push('UNIQUE');
                
                const attrStr = attributes.length > 0 ? ` "${attributes.join(',')}"` : '';
                diagram += `        ${col.type} ${col.name}${attrStr}\n`;
            });
            diagram += `    }\n\n`;
        });

        // Add relationships
        this.relationships.forEach(rel => {
            // Determine cardinality
            // For user_id references, typically one-to-many (one user has many records)
            const cardinality = '||--o{'; // one-to-many
            
            diagram += `    ${rel.to} ${cardinality} ${rel.from} : "has"\n`;
        });

        diagram += '```\n';

        this.log('✅ Mermaid diagram generated');
        return diagram;
    }

    // Generate PlantUML diagram (alternative)
    generatePlantUMLDiagram() {
        this.log('\n🎨 Generating PlantUML ER diagram...');

        let diagram = '@startuml\n\n';
        diagram += '!define Table(name,desc) class name as "desc" << (T,#FFAAAA) >>\n';
        diagram += '!define primary_key(x) <u>x</u>\n';
        diagram += '!define foreign_key(x) <i>x</i>\n';
        diagram += 'hide methods\n';
        diagram += 'hide stereotypes\n\n';

        // Add table definitions
        Object.keys(this.tables).forEach(tableName => {
            const columns = this.tables[tableName];
            
            diagram += `entity ${tableName} {\n`;
            columns.forEach(col => {
                let prefix = '';
                if (col.isPrimaryKey) prefix = '* ';
                else if (col.isNotNull) prefix = '+ ';
                else prefix = '  ';
                
                let suffix = '';
                if (col.isPrimaryKey) suffix = ' <<PK>>';
                if (col.isForeignKey) suffix = ' <<FK>>';
                
                diagram += `${prefix}${col.name}: ${col.type}${suffix}\n`;
            });
            diagram += `}\n\n`;
        });

        // Add relationships
        this.relationships.forEach(rel => {
            diagram += `${rel.to} ||--o{ ${rel.from}\n`;
        });

        diagram += '\n@enduml\n';

        this.log('✅ PlantUML diagram generated');
        return diagram;
    }

    // Update SCHEMA_ARCHITECTURE.md with the diagram
    updateSchemaDoc(mermaidDiagram) {
        this.log('\n📝 Updating SCHEMA_ARCHITECTURE.md...');

        const schemaDocPath = path.join(this.basePath, 'SCHEMA_ARCHITECTURE.md');
        
        if (!fs.existsSync(schemaDocPath)) {
            throw new Error(`SCHEMA_ARCHITECTURE.md not found at ${schemaDocPath}`);
        }

        let content = fs.readFileSync(schemaDocPath, 'utf8');

        // Check if ER diagram section already exists
        const erSectionRegex = /## Entity Relationship Diagram[\s\S]*?(?=\n## |$)/;
        
        const erSection = `## Entity Relationship Diagram

The following ER diagram shows the database structure, including all tables, their columns, and relationships:

${mermaidDiagram}

**Key:**
- **PK**: Primary Key
- **FK**: Foreign Key
- **||--o{**: One-to-many relationship
- **||--||**: One-to-one relationship

`;

        if (erSectionRegex.test(content)) {
            // Replace existing section
            content = content.replace(erSectionRegex, erSection);
            this.log('✅ Updated existing ER diagram section');
        } else {
            // Add new section after "Data Flow Diagram"
            const insertPoint = content.indexOf('## Current Architecture');
            if (insertPoint !== -1) {
                content = content.substring(0, insertPoint) + erSection + '\n' + content.substring(insertPoint);
                this.log('✅ Added new ER diagram section');
            } else {
                // Just append at the end before "Related Files"
                const relatedFilesIndex = content.indexOf('## Related Files');
                if (relatedFilesIndex !== -1) {
                    content = content.substring(0, relatedFilesIndex) + erSection + '\n' + content.substring(relatedFilesIndex);
                } else {
                    content += '\n\n' + erSection;
                }
                this.log('✅ Added new ER diagram section at end');
            }
        }

        fs.writeFileSync(schemaDocPath, content);
        this.log('✅ SCHEMA_ARCHITECTURE.md updated successfully');
    }

    // Generate a summary report
    generateSummaryReport() {
        this.log('\n' + '='.repeat(80));
        this.log('📊 ER DIAGRAM GENERATION SUMMARY');
        this.log('='.repeat(80));
        
        this.log(`\n📈 Statistics:`);
        this.log(`   • Tables: ${Object.keys(this.tables).length}`);
        this.log(`   • Relationships: ${this.relationships.length}`);
        
        this.log(`\n📊 Tables:`);
        Object.keys(this.tables).forEach(tableName => {
            const columnCount = this.tables[tableName].length;
            this.log(`   • ${tableName} (${columnCount} columns)`);
        });
        
        this.log(`\n🔗 Relationships:`);
        this.relationships.forEach(rel => {
            this.log(`   • ${rel.to} --< ${rel.from} (via ${rel.fromColumn})`);
        });
        
        this.log('\n' + '='.repeat(80));
        this.log('✅ ER diagram generation completed successfully!');
        this.log('='.repeat(80) + '\n');
    }

    // Main execution
    async run() {
        try {
            this.log('🚀 Starting ER Diagram Generation...\n');
            
            // Step 1: Parse schema
            this.parseSchema();
            
            // Step 2: Generate Mermaid diagram
            const mermaidDiagram = this.generateMermaidDiagram();
            
            // Step 3: Generate PlantUML diagram (optional, for reference)
            const plantumlDiagram = this.generatePlantUMLDiagram();
            
            // Step 4: Update SCHEMA_ARCHITECTURE.md
            this.updateSchemaDoc(mermaidDiagram);
            
            // Step 5: Generate summary
            this.generateSummaryReport();
            
            // Optionally save PlantUML to a separate file
            const plantumlPath = path.join(this.basePath, 'docs', 'ER_DIAGRAM.plantuml');
            fs.writeFileSync(plantumlPath, plantumlDiagram);
            this.log(`💾 PlantUML diagram also saved to: docs/ER_DIAGRAM.plantuml`);
            
            process.exit(0);
        } catch (error) {
            console.error('❌ Error generating ER diagram:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run the generator
if (require.main === module) {
    const generator = new ERDiagramGenerator();
    generator.run();
}

module.exports = ERDiagramGenerator;
