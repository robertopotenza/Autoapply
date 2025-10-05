/**
 * Tests for SQL statement splitting functionality
 * Tests that both line comments (--) and block comments (/* */) are properly removed
 */

// Helper function to split SQL statements (same as in src/server.js)
function splitSqlStatements(sql) {
    return sql
        // Remove line comments
        .replace(/--.*$/gm, '')
        // Remove block comments
        .replace(/\/\*[\s\S]*?\*\//gm, '')
        .split(/;\s*(?:\r?\n|$)/)
        .map(statement => statement.trim())
        .filter(statement => statement.length > 0);
}

describe('splitSqlStatements', () => {
    test('should remove line comments (--)', () => {
        const sql = `
            SELECT * FROM users; -- This is a comment
            DELETE FROM sessions; -- Another comment
        `;
        const statements = splitSqlStatements(sql);
        expect(statements).toHaveLength(2);
        expect(statements[0]).toBe('SELECT * FROM users');
        expect(statements[1]).toBe('DELETE FROM sessions');
    });

    test('should remove block comments (/* */)', () => {
        const sql = `
            /* This is a block comment */
            SELECT * FROM users;
            /* Another block comment
               spanning multiple lines */
            DELETE FROM sessions;
        `;
        const statements = splitSqlStatements(sql);
        expect(statements).toHaveLength(2);
        expect(statements[0]).toBe('SELECT * FROM users');
        expect(statements[1]).toBe('DELETE FROM sessions');
    });

    test('should handle inline block comments', () => {
        const sql = `
            SELECT * /* inline comment */ FROM users;
            DELETE /* comment */ FROM sessions;
        `;
        const statements = splitSqlStatements(sql);
        expect(statements).toHaveLength(2);
        expect(statements[0]).toBe('SELECT *  FROM users');
        expect(statements[1]).toBe('DELETE  FROM sessions');
    });

    test('should handle mixed comments', () => {
        const sql = `
            /* Block comment at start */
            SELECT * FROM users; -- Line comment at end
            /* Another block */
            DELETE FROM sessions; -- Another line comment
        `;
        const statements = splitSqlStatements(sql);
        expect(statements).toHaveLength(2);
        expect(statements[0]).toBe('SELECT * FROM users');
        expect(statements[1]).toBe('DELETE FROM sessions');
    });

    test('should handle multi-line block comments', () => {
        const sql = `
            /*
             * This is a multi-line
             * block comment
             * with multiple lines
             */
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255)
            );
        `;
        const statements = splitSqlStatements(sql);
        expect(statements).toHaveLength(1);
        expect(statements[0]).toContain('CREATE TABLE users');
        expect(statements[0]).not.toContain('/*');
        expect(statements[0]).not.toContain('*/');
    });

    test('should handle statements without comments', () => {
        const sql = `
            SELECT * FROM users;
            DELETE FROM sessions;
        `;
        const statements = splitSqlStatements(sql);
        expect(statements).toHaveLength(2);
        expect(statements[0]).toBe('SELECT * FROM users');
        expect(statements[1]).toBe('DELETE FROM sessions');
    });

    test('should filter out empty statements', () => {
        const sql = `
            SELECT * FROM users;
            ;
            DELETE FROM sessions;
        `;
        const statements = splitSqlStatements(sql);
        expect(statements).toHaveLength(2);
    });

    test('should handle complex migration SQL with block comments', () => {
        const sql = `
            /* 
             * Migration: Add email column
             * Author: Developer
             * Date: 2024-01-01
             */
            ALTER TABLE profile ADD COLUMN IF NOT EXISTS email VARCHAR(255);
            
            /* Create index for email lookups */
            CREATE INDEX IF NOT EXISTS idx_profile_email ON profile(email);
        `;
        const statements = splitSqlStatements(sql);
        expect(statements).toHaveLength(2);
        expect(statements[0]).toContain('ALTER TABLE profile');
        expect(statements[1]).toContain('CREATE INDEX');
        expect(statements[0]).not.toContain('/*');
        expect(statements[1]).not.toContain('/*');
    });
});
