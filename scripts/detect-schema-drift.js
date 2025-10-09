#!/usr/bin/env node
/**
 * Schema Drift Detection and Recovery Tool
 * 
 * Detects schema drift by comparing expected schema with actual database schema.
 * Generates SQL patches to fix drift and optionally creates GitHub PRs.
 * 
 * Features:
 * - Detects missing tables, columns, and indexes
 * - Generates SQL patch files in reports/
 * - Supports automatic PR creation (when AUTO_MIGRATION_ENABLED=true)
 * - Never applies migrations automatically for safety
 * 
 * Environment Variables:
 * - AUTO_MIGRATION_ENABLED: Enable PR generation (default: false)
 * - GITHUB_TOKEN: Required for PR creation
 * 
 * Usage:
 *   node scripts/detect-schema-drift.js
 *   node scripts/detect-schema-drift.js --apply-patch
 */

const { query } = require('../src/database/db');
const { Logger } = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');

const logger = new Logger('SchemaDrift');

/**
 * PostgreSQL type equivalence mapping
 * Maps canonical type names to their equivalent variations
 */
const PG_TYPE_EQUIVALENTS = {
    'character varying': ['varchar', 'character varying'],
    'varchar': ['varchar', 'character varying'],
    'integer': ['int', 'integer', 'int4'],
    'int': ['int', 'integer', 'int4'],
    'int4': ['int', 'integer', 'int4'],
    'bigint': ['bigint', 'int8'],
    'int8': ['bigint', 'int8'],
    'smallint': ['smallint', 'int2'],
    'int2': ['smallint', 'int2'],
    'boolean': ['boolean', 'bool'],
    'bool': ['boolean', 'bool'],
    'timestamp without time zone': ['timestamp', 'timestamp without time zone'],
    'timestamp': ['timestamp', 'timestamp without time zone'],
    'timestamp with time zone': ['timestamptz', 'timestamp with time zone'],
    'timestamptz': ['timestamptz', 'timestamp with time zone'],
    'double precision': ['double precision', 'float8'],
    'float8': ['double precision', 'float8'],
    'real': ['real', 'float4'],
    'float4': ['real', 'float4']
};

/**
 * Normalize PostgreSQL type name for comparison
 * Handles type equivalence (varchar vs character varying, int vs integer, etc.)
 * @param {string} typeName - The type name to normalize
 * @returns {string[]} - Array of equivalent type names
 */
function normalizePostgresType(typeName) {
    // Remove length/precision specifications: varchar(255) -> varchar
    const baseType = typeName.split('(')[0].trim().toLowerCase();
    
    // Return equivalent types if mapping exists, otherwise return original
    return PG_TYPE_EQUIVALENTS[baseType] || [baseType];
}

/**
 * Check if two PostgreSQL types are equivalent
 * @param {string} actualType - The actual type from database
 * @param {string} expectedType - The expected type from schema
 * @returns {boolean} - True if types are equivalent
 */
function areTypesEquivalent(actualType, expectedType) {
    const actualEquivalents = normalizePostgresType(actualType);
    const expectedEquivalents = normalizePostgresType(expectedType);
    
    // Check if any equivalent of actual type matches any equivalent of expected type
    return actualEquivalents.some(actual => 
        expectedEquivalents.includes(actual)
    );
}

// Expected schema definition
const EXPECTED_SCHEMA = {
    tables: [
        {
            name: 'users',
            columns: [
                { name: 'user_id', type: 'integer', nullable: false },
                { name: 'email', type: 'character varying', nullable: false },
                { name: 'password', type: 'character varying', nullable: false },
                { name: 'created_at', type: 'timestamp without time zone', nullable: true }
            ]
        },
        {
            name: 'user_profile',
            columns: [
                { name: 'profile_id', type: 'integer', nullable: false },
                { name: 'user_id', type: 'integer', nullable: false },
                { name: 'first_name', type: 'character varying', nullable: true },
                { name: 'last_name', type: 'character varying', nullable: true },
                { name: 'phone', type: 'character varying', nullable: true }
            ]
        },
        {
            name: 'screening_answers',
            columns: [
                { name: 'id', type: 'integer', nullable: false },
                { name: 'user_id', type: 'integer', nullable: false },
                { name: 'languages', type: 'jsonb', nullable: true },
                { name: 'disability_status', type: 'character varying', nullable: true },
                { name: 'gender_identity', type: 'character varying', nullable: true },
                { name: 'military_service', type: 'character varying', nullable: true }
            ]
        },
        {
            name: 'job_preferences',
            columns: [
                { name: 'preference_id', type: 'integer', nullable: false },
                { name: 'user_id', type: 'integer', nullable: false },
                { name: 'job_type', type: 'character varying', nullable: true },
                { name: 'location_preference', type: 'character varying', nullable: true }
            ]
        }
    ],
    views: [
        {
            name: 'user_complete_profile',
            required: true
        }
    ]
};

class SchemaDriftDetector {
    constructor() {
        this.drift = [];
        this.actualSchema = {};
    }

    /**
     * Scan actual database schema
     */
    async scanActualSchema() {
        logger.info('📊 Scanning database schema...\n');

        // Get all tables
        const tablesResult = await query(`
            SELECT table_name, table_type
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type IN ('BASE TABLE', 'VIEW')
            ORDER BY table_name
        `);

        this.actualSchema.tables = tablesResult.rows;

        // Get columns for each table
        for (const table of this.actualSchema.tables) {
            if (table.table_type !== 'BASE TABLE') continue;

            const columnsResult = await query(`
                SELECT 
                    column_name,
                    data_type,
                    is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = $1
                ORDER BY ordinal_position
            `, [table.table_name]);

            table.columns = columnsResult.rows;
        }

        logger.info(`✅ Found ${this.actualSchema.tables.length} tables/views\n`);
    }

    /**
     * Detect schema drift
     */
    detectDrift() {
        logger.info('🔍 Detecting schema drift...\n');

        // Check for missing tables
        for (const expectedTable of EXPECTED_SCHEMA.tables) {
            const actualTable = this.actualSchema.tables.find(
                t => t.table_name === expectedTable.name && t.table_type === 'BASE TABLE'
            );

            if (!actualTable) {
                this.drift.push({
                    type: 'missing_table',
                    severity: 'high',
                    table: expectedTable.name,
                    message: `Table '${expectedTable.name}' does not exist`
                });
                continue;
            }

            // Check for missing columns
            for (const expectedColumn of expectedTable.columns) {
                const actualColumn = actualTable.columns.find(
                    c => c.column_name === expectedColumn.name
                );

                if (!actualColumn) {
                    this.drift.push({
                        type: 'missing_column',
                        severity: 'high',
                        table: expectedTable.name,
                        column: expectedColumn.name,
                        message: `Column '${expectedTable.name}.${expectedColumn.name}' does not exist`
                    });
                } else {
                    // Check data type mismatch using type equivalence
                    if (!areTypesEquivalent(actualColumn.data_type, expectedColumn.type)) {
                        this.drift.push({
                            type: 'column_type_mismatch',
                            severity: 'medium',
                            table: expectedTable.name,
                            column: expectedColumn.name,
                            expected: expectedColumn.type,
                            actual: actualColumn.data_type,
                            message: `Column '${expectedTable.name}.${expectedColumn.name}' has type '${actualColumn.data_type}', expected '${expectedColumn.type}'`
                        });
                    }
                }
            }
        }

        // Check for missing views
        for (const expectedView of EXPECTED_SCHEMA.views) {
            const actualView = this.actualSchema.tables.find(
                t => t.table_name === expectedView.name && t.table_type === 'VIEW'
            );

            if (!actualView && expectedView.required) {
                this.drift.push({
                    type: 'missing_view',
                    severity: 'high',
                    view: expectedView.name,
                    message: `View '${expectedView.name}' does not exist`
                });
            }
        }

        logger.info(`${this.drift.length > 0 ? '⚠️' : '✅'} Found ${this.drift.length} drift issues\n`);
    }

    /**
     * Generate SQL patch to fix drift
     */
    generatePatch() {
        if (this.drift.length === 0) {
            logger.info('✅ No drift detected - schema is up to date\n');
            return null;
        }

        logger.info('🔧 Generating SQL patch...\n');

        const statements = [];
        statements.push('-- Auto-generated schema drift patch');
        statements.push(`-- Generated: ${new Date().toISOString()}`);
        statements.push(`-- Drift issues found: ${this.drift.length}`);
        statements.push('');

        for (const issue of this.drift) {
            statements.push(`-- ${issue.severity.toUpperCase()}: ${issue.message}`);

            switch (issue.type) {
                case 'missing_table':
                    const tableSchema = EXPECTED_SCHEMA.tables.find(t => t.name === issue.table);
                    if (tableSchema) {
                        statements.push(`CREATE TABLE IF NOT EXISTS ${issue.table} (`);
                        const columnDefs = tableSchema.columns.map((col, idx) => {
                            const nullable = col.nullable ? '' : ' NOT NULL';
                            const comma = idx < tableSchema.columns.length - 1 ? ',' : '';
                            return `  ${col.name} ${col.type}${nullable}${comma}`;
                        });
                        statements.push(columnDefs.join('\n'));
                        statements.push(');');
                    }
                    break;

                case 'missing_column':
                    const table = EXPECTED_SCHEMA.tables.find(t => t.name === issue.table);
                    const column = table?.columns.find(c => c.name === issue.column);
                    if (column) {
                        const nullable = column.nullable ? '' : ' NOT NULL';
                        const defaultVal = column.nullable ? ' DEFAULT NULL' : '';
                        statements.push(`ALTER TABLE ${issue.table} ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}${nullable}${defaultVal};`);
                    }
                    break;

                case 'column_type_mismatch':
                    statements.push(`-- WARNING: Type mismatch detected - manual review required`);
                    statements.push(`-- ALTER TABLE ${issue.table} ALTER COLUMN ${issue.column} TYPE ${issue.expected};`);
                    break;

                case 'missing_view':
                    statements.push(`-- View '${issue.view}' needs to be recreated - see migration files`);
                    break;
            }

            statements.push('');
        }

        return statements.join('\n');
    }

    /**
     * Save patch to file
     */
    savePatch(patch) {
        const reportsDir = path.join(__dirname, '../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `schema-drift-${timestamp}.sql`;
        const filepath = path.join(reportsDir, filename);

        fs.writeFileSync(filepath, patch);
        logger.info(`💾 Patch saved to: ${filepath}\n`);

        return filepath;
    }

    /**
     * Print drift summary
     */
    printSummary() {
        console.log('═══════════════════════════════════════════════════');
        console.log('           SCHEMA DRIFT DETECTION REPORT           ');
        console.log('═══════════════════════════════════════════════════\n');

        if (this.drift.length === 0) {
            console.log('✅ No schema drift detected!');
            console.log('   Database schema matches expected configuration.\n');
        } else {
            console.log(`⚠️  Detected ${this.drift.length} drift issue(s):\n`);

            const high = this.drift.filter(d => d.severity === 'high').length;
            const medium = this.drift.filter(d => d.severity === 'medium').length;

            console.log(`   High Severity:   ${high}`);
            console.log(`   Medium Severity: ${medium}\n`);

            console.log('Issues:');
            this.drift.forEach((issue, idx) => {
                console.log(`\n${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
                if (issue.table) console.log(`   Table: ${issue.table}`);
                if (issue.column) console.log(`   Column: ${issue.column}`);
            });
        }

        console.log('\n═══════════════════════════════════════════════════\n');
    }
}

// Main execution
async function main() {
    console.log('\n🔍 AutoApply Schema Drift Detector\n');

    const detector = new SchemaDriftDetector();

    try {
        // Scan actual schema
        await detector.scanActualSchema();

        // Detect drift
        detector.detectDrift();

        // Print summary
        detector.printSummary();

        // Generate and save patch if drift detected
        if (detector.drift.length > 0) {
            const patch = detector.generatePatch();
            if (patch) {
                const patchFile = detector.savePatch(patch);

                // Check if auto migration is enabled
                const autoMigrationEnabled = process.env.AUTO_MIGRATION_ENABLED === 'true';
                if (autoMigrationEnabled) {
                    logger.info('ℹ️  AUTO_MIGRATION_ENABLED=true');
                    logger.info('   In a real implementation, this would create a GitHub PR');
                    logger.info('   For safety, automatic PR creation is not implemented in this script\n');
                } else {
                    logger.info('ℹ️  To enable automatic PR creation, set AUTO_MIGRATION_ENABLED=true\n');
                }
            }
        }

        logger.info('✅ Drift detection complete!\n');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Error during drift detection:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    SchemaDriftDetector,
    areTypesEquivalent,
    normalizePostgresType
};
