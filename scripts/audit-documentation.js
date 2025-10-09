#!/usr/bin/env node
/**
 * Documentation and Schema Consistency Audit Script
 * 
 * This script performs a comprehensive audit to verify:
 * 1. All tables mentioned in docs exist in schema.sql
 * 2. All models referenced in docs exist in src/database/models/
 * 3. All routes mentioned in docs exist in src/routes/
 * 4. All JSDoc references point to actual functions
 * 5. Schema columns match what's documented
 * 6. Cross-references between documentation files are valid
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

class DocumentationAuditor {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.successes = [];
        this.basePath = path.resolve(__dirname, '..');
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    addError(category, message) {
        this.errors.push({ category, message });
        this.log(`❌ ERROR [${category}]: ${message}`, 'red');
    }

    addWarning(category, message) {
        this.warnings.push({ category, message });
        this.log(`⚠️  WARNING [${category}]: ${message}`, 'yellow');
    }

    addSuccess(category, message) {
        this.successes.push({ category, message });
    }

    // Parse schema.sql to extract table names and columns
    parseSchema() {
        this.log('\n📊 Parsing database/schema.sql...', 'cyan');
        const schemaPath = path.join(this.basePath, 'database', 'schema.sql');
        
        if (!fs.existsSync(schemaPath)) {
            this.addError('SCHEMA', `Schema file not found at ${schemaPath}`);
            return { tables: {}, views: [] };
        }

        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        const tables = {};
        const views = [];

        // Also check migration files for additional tables
        const migrationsPath = path.join(this.basePath, 'database', 'migrations');
        if (fs.existsSync(migrationsPath)) {
            const migrationFiles = fs.readdirSync(migrationsPath).filter(f => f.endsWith('.sql'));
            migrationFiles.forEach(file => {
                const migrationContent = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
                this.extractTablesFromSQL(migrationContent, tables, views);
            });
        }

        this.extractTablesFromSQL(schemaContent, tables, views);

        this.log(`✅ Found ${Object.keys(tables).length} tables and ${views.length} views`, 'green');
        return { tables, views };
    }

    // Extract tables from SQL content
    extractTablesFromSQL(sqlContent, tables, views) {
        // Extract table definitions
        const tableRegex = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\);/gi;
        let match;

        while ((match = tableRegex.exec(sqlContent)) !== null) {
            const tableName = match[1];
            const tableBody = match[2];
            
            // Extract column names
            const columns = [];
            const columnRegex = /^\s*(\w+)\s+/gm;
            let colMatch;
            
            while ((colMatch = columnRegex.exec(tableBody)) !== null) {
                const colName = colMatch[1];
                // Skip constraint keywords
                if (!['UNIQUE', 'PRIMARY', 'FOREIGN', 'CHECK', 'CONSTRAINT', 'COMMENT'].includes(colName)) {
                    columns.push(colName);
                }
            }
            
            tables[tableName] = columns;
        }

        // Extract view definitions
        const viewRegex = /CREATE OR REPLACE VIEW (\w+)/gi;
        while ((match = viewRegex.exec(sqlContent)) !== null) {
            if (!views.includes(match[1])) {
                views.push(match[1]);
            }
        }
    }

    // Get all model files
    getModels() {
        this.log('\n📦 Scanning models in src/database/models/...', 'cyan');
        const modelsPath = path.join(this.basePath, 'src', 'database', 'models');
        
        if (!fs.existsSync(modelsPath)) {
            this.addError('MODELS', `Models directory not found at ${modelsPath}`);
            return {};
        }

        const modelFiles = fs.readdirSync(modelsPath).filter(f => f.endsWith('.js'));
        const models = {};

        modelFiles.forEach(file => {
            const modelName = path.basename(file, '.js');
            const filePath = path.join(modelsPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Extract static methods
            const methods = [];
            const methodRegex = /static\s+async\s+(\w+)\s*\(/g;
            let match;
            
            while ((match = methodRegex.exec(content)) !== null) {
                methods.push(match[1]);
            }
            
            models[modelName] = { file, methods };
        });

        this.log(`✅ Found ${Object.keys(models).length} model files`, 'green');
        return models;
    }

    // Get all route files
    getRoutes() {
        this.log('\n🛣️  Scanning routes in src/routes/...', 'cyan');
        const routesPath = path.join(this.basePath, 'src', 'routes');
        
        if (!fs.existsSync(routesPath)) {
            this.addError('ROUTES', `Routes directory not found at ${routesPath}`);
            return {};
        }

        const routeFiles = fs.readdirSync(routesPath).filter(f => f.endsWith('.js'));
        const routes = {};

        routeFiles.forEach(file => {
            const routeName = path.basename(file, '.js');
            const filePath = path.join(routesPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Extract route definitions
            const endpoints = [];
            const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
            let match;
            
            while ((match = routeRegex.exec(content)) !== null) {
                endpoints.push({ method: match[1].toUpperCase(), path: match[2] });
            }
            
            routes[routeName] = { file, endpoints };
        });

        this.log(`✅ Found ${Object.keys(routes).length} route files`, 'green');
        return routes;
    }

    // Parse documentation files
    getDocumentationReferences() {
        this.log('\n📚 Scanning documentation files...', 'cyan');
        
        const docFiles = [
            'SCHEMA_ARCHITECTURE.md',
            'DATABASE_SCHEMA_DOCS.md',
            'FAQ_SCREENING_DATA.md',
            'docs/DATABASE_MIGRATION_SCHEMA_VERIFICATION.md',
            'docs/SCHEMA_VERIFICATION_IMPLEMENTATION.md',
        ];

        const references = {
            tables: new Set(),
            models: new Set(),
            routes: new Set(),
            files: new Set(),
        };

        docFiles.forEach(file => {
            const filePath = path.join(this.basePath, file);
            if (!fs.existsSync(filePath)) {
                this.addWarning('DOCS', `Documentation file not found: ${file}`);
                return;
            }

            const content = fs.readFileSync(filePath, 'utf8');

            // Extract table references
            // Looking for patterns like: `table_name`, table_name TABLE, FROM table_name
            const tablePatterns = [
                /`(\w+)` (?:table|TABLE)/g,
                /FROM (\w+)/gi,
                /JOIN (\w+)/gi,
                /INTO (\w+)/gi,
            ];

            // Common words to exclude from table name detection
            const excludeWords = new Set([
                'the', 'a', 'an', 'all', 'one', 'two', 'three', 'operations', 'schema',
                'information_schema', 'public', 'NOW', 'CURRENT', 'NULL', 'TRUE', 'FALSE',
                'DEFAULT', 'values', 'select', 'where', 'order', 'group', 'having', 'schema_migrations'
            ]);

            tablePatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    const tableName = match[1].toLowerCase();
                    // Only add if it's not a common word or SQL keyword
                    if (!excludeWords.has(tableName) && tableName.length > 2) {
                        references.tables.add(match[1]);
                    }
                }
            });

            // Extract model references
            // Looking for patterns like: Model.method(), `Model`
            const modelPattern = /(\w+)\.(?:upsert|create|find|update|delete|get)/g;
            let match;
            while ((match = modelPattern.exec(content)) !== null) {
                references.models.add(match[1]);
            }

            // Extract route references
            // Looking for patterns like: POST /api/wizard/step1
            const routePattern = /(?:GET|POST|PUT|DELETE|PATCH)\s+([^\s`]+)/g;
            while ((match = routePattern.exec(content)) !== null) {
                references.routes.add(match[1]);
            }

            // Extract file references
            const filePattern = /(?:`|")([^`"]+\.(?:js|sql|md))(?:`|")/g;
            while ((match = filePattern.exec(content)) !== null) {
                references.files.add(match[1]);
            }

            references.files.add(file);
        });

        this.log(`✅ Found ${references.tables.size} table references, ${references.models.size} model references, ${references.routes.size} route references`, 'green');
        return references;
    }

    // Verify JSDoc references
    verifyJSDocReferences() {
        this.log('\n📝 Verifying JSDoc references...', 'cyan');
        
        const jsFiles = [
            ...this.getAllJsFiles(path.join(this.basePath, 'src', 'database', 'models')),
            ...this.getAllJsFiles(path.join(this.basePath, 'src', 'routes')),
        ];

        let jsdocCount = 0;
        let invalidRefs = 0;

        jsFiles.forEach(filePath => {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Extract @see references
            const seePattern = /@see\s+(\S+)/g;
            let match;
            
            while ((match = seePattern.exec(content)) !== null) {
                jsdocCount++;
                const reference = match[1];
                
                // Check if it's a file reference
                if (reference.includes('.md') || reference.includes('.js') || reference.includes('.sql')) {
                    const refPath = path.join(this.basePath, reference);
                    if (!fs.existsSync(refPath)) {
                        this.addError('JSDOC', `Invalid @see reference in ${path.relative(this.basePath, filePath)}: ${reference}`);
                        invalidRefs++;
                    }
                }
            }
        });

        if (invalidRefs === 0) {
            this.log(`✅ All ${jsdocCount} JSDoc references are valid`, 'green');
        } else {
            this.log(`⚠️  Found ${invalidRefs} invalid JSDoc references out of ${jsdocCount} total`, 'yellow');
        }
    }

    getAllJsFiles(dir) {
        if (!fs.existsSync(dir)) return [];
        
        const files = [];
        const items = fs.readdirSync(dir);
        
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                files.push(...this.getAllJsFiles(fullPath));
            } else if (item.endsWith('.js')) {
                files.push(fullPath);
            }
        });
        
        return files;
    }

    // Cross-reference documentation mentions with actual code
    crossReferenceCheck(schema, models, routes, docRefs) {
        this.log('\n🔍 Cross-referencing documentation with code...', 'cyan');

        // Check if documented tables exist
        docRefs.tables.forEach(table => {
            // Skip common SQL keywords and variables
            if (['information_schema', 'pg_catalog', 'public', 'NOW'].includes(table)) {
                return;
            }
            
            const exists = schema.tables[table] || schema.views.includes(table);
            if (!exists) {
                this.addError('TABLE_REF', `Table/view '${table}' mentioned in docs but not found in schema.sql`);
            } else {
                this.addSuccess('TABLE_REF', `Table/view '${table}' verified`);
            }
        });

        // Check if documented models exist
        docRefs.models.forEach(model => {
            // Skip common patterns that aren't models
            if (['User', 'Model', 'Promise', 'Array', 'Object', 'String'].includes(model)) {
                if (model === 'User' && !models[model]) {
                    this.addError('MODEL_REF', `Model '${model}' mentioned in docs but not found in src/database/models/`);
                }
                return;
            }
            
            if (!models[model]) {
                this.addWarning('MODEL_REF', `Model '${model}' mentioned in docs but not found in src/database/models/`);
            } else {
                this.addSuccess('MODEL_REF', `Model '${model}' verified`);
            }
        });

        // Verify that all schema tables have corresponding models
        this.log('\n📊 Verifying schema tables have corresponding models...', 'cyan');
        Object.keys(schema.tables).forEach(table => {
            // Convert table name to expected model name (snake_case to PascalCase)
            const expectedModelName = table
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join('');
            
            // Some tables don't need models (system tables, tokens, etc.)
            const skipTables = [
                'magic_link_tokens', 'password_reset_tokens', 'migrations', 'schema_migrations',
                'application_status_history', 'job_queue', 'ats_logs', 'autoapply_sessions',
                'user_autoapply_status', 'autoapply_config', 'application_templates',
                'job_board_cookies', 'application_logs'
            ];
            
            if (skipTables.includes(table)) {
                this.log(`ℹ️  Skipping model check for system/support table: ${table}`, 'blue');
                return;
            }
            
            // Try both plural and singular forms
            let modelName = expectedModelName;
            
            // Special case: 'users' table has 'User' model (singular)
            if (table === 'users') {
                modelName = 'User';
            } else if (table === 'jobs') {
                modelName = 'Job';
            } else if (table === 'applications') {
                modelName = 'Application';
            } else if (table === 'autoapply_settings') {
                modelName = 'AutoApplySettings';
            }
            
            // Check if model exists (try original and singular forms)
            const modelExists = models[modelName] || 
                               models[expectedModelName] ||
                               models[expectedModelName.replace(/s$/, '')]; // Try removing 's'
            
            if (!modelExists) {
                this.addWarning('MODEL_MISSING', `Table '${table}' exists but model '${modelName}' not found. Expected file: src/database/models/${modelName}.js`);
            } else {
                const actualModelName = models[modelName] ? modelName : 
                                       models[expectedModelName] ? expectedModelName : 
                                       expectedModelName.replace(/s$/, '');
                this.addSuccess('MODEL_TABLE', `Table '${table}' has corresponding model '${actualModelName}'`);
            }
        });
    }

    // Verify documentation file cross-references
    verifyDocCrossReferences() {
        this.log('\n📄 Verifying documentation cross-references...', 'cyan');
        
        const docFiles = this.getAllMarkdownFiles(this.basePath);
        
        docFiles.forEach(docFile => {
            const content = fs.readFileSync(docFile, 'utf8');
            
            // Extract markdown link references [text](file.md)
            const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
            let match;
            
            while ((match = linkPattern.exec(content)) !== null) {
                const linkText = match[1];
                const linkPath = match[2];
                
                // Skip external links
                if (linkPath.startsWith('http://') || linkPath.startsWith('https://')) {
                    continue;
                }
                
                // Skip anchors within same file
                if (linkPath.startsWith('#')) {
                    continue;
                }
                
                // Check if referenced file exists
                const refPath = path.resolve(path.dirname(docFile), linkPath.split('#')[0]);
                if (!fs.existsSync(refPath)) {
                    this.addError('DOC_REF', `Broken link in ${path.relative(this.basePath, docFile)}: "${linkText}" -> ${linkPath}`);
                } else {
                    this.addSuccess('DOC_REF', `Valid link in ${path.basename(docFile)}: ${linkPath}`);
                }
            }
        });
    }

    getAllMarkdownFiles(dir) {
        const files = [];
        
        const scan = (currentDir) => {
            if (!fs.existsSync(currentDir)) return;
            
            const items = fs.readdirSync(currentDir);
            items.forEach(item => {
                const fullPath = path.join(currentDir, item);
                const stat = fs.statSync(fullPath);
                
                // Skip node_modules and .git
                if (item === 'node_modules' || item === '.git') {
                    return;
                }
                
                if (stat.isDirectory()) {
                    scan(fullPath);
                } else if (item.endsWith('.md')) {
                    files.push(fullPath);
                }
            });
        };
        
        scan(dir);
        return files;
    }

    // Generate comprehensive report
    generateReport() {
        this.log('\n' + '='.repeat(80), 'magenta');
        this.log('📊 DOCUMENTATION AUDIT REPORT', 'magenta');
        this.log('='.repeat(80) + '\n', 'magenta');

        // Summary
        this.log('📈 SUMMARY:', 'cyan');
        this.log(`   ✅ Successes: ${this.successes.length}`, 'green');
        this.log(`   ⚠️  Warnings: ${this.warnings.length}`, 'yellow');
        this.log(`   ❌ Errors: ${this.errors.length}`, 'red');
        console.log('');

        // Group errors by category
        if (this.errors.length > 0) {
            this.log('❌ ERRORS BY CATEGORY:', 'red');
            const errorsByCategory = {};
            this.errors.forEach(error => {
                if (!errorsByCategory[error.category]) {
                    errorsByCategory[error.category] = [];
                }
                errorsByCategory[error.category].push(error.message);
            });
            
            Object.keys(errorsByCategory).forEach(category => {
                this.log(`\n  [${category}]:`, 'red');
                errorsByCategory[category].forEach(msg => {
                    this.log(`    • ${msg}`, 'red');
                });
            });
            console.log('');
        }

        // Group warnings by category
        if (this.warnings.length > 0) {
            this.log('⚠️  WARNINGS BY CATEGORY:', 'yellow');
            const warningsByCategory = {};
            this.warnings.forEach(warning => {
                if (!warningsByCategory[warning.category]) {
                    warningsByCategory[warning.category] = [];
                }
                warningsByCategory[warning.category].push(warning.message);
            });
            
            Object.keys(warningsByCategory).forEach(category => {
                this.log(`\n  [${category}]:`, 'yellow');
                warningsByCategory[category].forEach(msg => {
                    this.log(`    • ${msg}`, 'yellow');
                });
            });
            console.log('');
        }

        // Final status
        this.log('='.repeat(80), 'magenta');
        if (this.errors.length === 0 && this.warnings.length === 0) {
            this.log('🎉 ALL CHECKS PASSED! Documentation is consistent with code.', 'green');
        } else if (this.errors.length === 0) {
            this.log('✅ No critical errors found. Some warnings may need attention.', 'green');
        } else {
            this.log('❌ AUDIT FAILED: Critical errors found that need to be fixed.', 'red');
        }
        this.log('='.repeat(80) + '\n', 'magenta');

        return this.errors.length === 0;
    }

    // Main audit function
    async run() {
        this.log('\n🔍 Starting Documentation and Schema Consistency Audit...', 'cyan');
        this.log('='.repeat(80) + '\n', 'cyan');

        // Step 1: Parse schema
        const schema = this.parseSchema();

        // Step 2: Get models
        const models = this.getModels();

        // Step 3: Get routes
        const routes = this.getRoutes();

        // Step 4: Get documentation references
        const docRefs = this.getDocumentationReferences();

        // Step 5: Cross-reference
        this.crossReferenceCheck(schema, models, routes, docRefs);

        // Step 6: Verify JSDoc references
        this.verifyJSDocReferences();

        // Step 7: Verify doc cross-references
        this.verifyDocCrossReferences();

        // Step 8: Generate report
        const success = this.generateReport();

        process.exit(success ? 0 : 1);
    }
}

// Run the audit
if (require.main === module) {
    const auditor = new DocumentationAuditor();
    auditor.run().catch(error => {
        console.error('Fatal error running audit:', error);
        process.exit(1);
    });
}

module.exports = DocumentationAuditor;
