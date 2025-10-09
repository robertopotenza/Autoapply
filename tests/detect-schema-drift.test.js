// @ai-meta: schema-drift-test
// @ai-meta: unit-test

/**
 * Unit tests for Schema Drift Detection Tool
 * Tests the type equivalence logic to prevent false positives
 */

// Mock the database module to avoid requiring actual database connection
jest.mock('../src/database/db', () => ({
  query: jest.fn()
}));

const { areTypesEquivalent, normalizePostgresType } = require('../scripts/detect-schema-drift.js');

describe('Schema Drift Detector - Type Equivalence', () => {
  describe('normalizePostgresType function', () => {
    test('should normalize character varying to array of equivalents', () => {
      const equivalents = normalizePostgresType('character varying');
      expect(equivalents).toContain('varchar');
      expect(equivalents).toContain('character varying');
    });

    test('should normalize varchar to array of equivalents', () => {
      const equivalents = normalizePostgresType('varchar');
      expect(equivalents).toContain('varchar');
      expect(equivalents).toContain('character varying');
    });

    test('should handle type with length specification', () => {
      const equivalents = normalizePostgresType('varchar(255)');
      expect(equivalents).toContain('varchar');
      expect(equivalents).toContain('character varying');
    });

    test('should normalize integer types', () => {
      const intEquivalents = normalizePostgresType('integer');
      expect(intEquivalents).toContain('int');
      expect(intEquivalents).toContain('integer');
      expect(intEquivalents).toContain('int4');

      const intEquivalents2 = normalizePostgresType('int');
      expect(intEquivalents2).toContain('int');
      expect(intEquivalents2).toContain('integer');
    });

    test('should normalize timestamp types', () => {
      const tsEquivalents = normalizePostgresType('timestamp without time zone');
      expect(tsEquivalents).toContain('timestamp');
      expect(tsEquivalents).toContain('timestamp without time zone');
    });

    test('should return original type if no mapping exists', () => {
      const equivalents = normalizePostgresType('custom_type');
      expect(equivalents).toEqual(['custom_type']);
    });
  });

  describe('areTypesEquivalent function', () => {
    test('character varying should be equivalent to varchar', () => {
      expect(areTypesEquivalent('character varying', 'varchar')).toBe(true);
      expect(areTypesEquivalent('varchar', 'character varying')).toBe(true);
    });

    test('integer should be equivalent to int', () => {
      expect(areTypesEquivalent('integer', 'int')).toBe(true);
      expect(areTypesEquivalent('int', 'integer')).toBe(true);
    });

    test('integer should be equivalent to int4', () => {
      expect(areTypesEquivalent('integer', 'int4')).toBe(true);
      expect(areTypesEquivalent('int4', 'integer')).toBe(true);
    });

    test('bigint should be equivalent to int8', () => {
      expect(areTypesEquivalent('bigint', 'int8')).toBe(true);
      expect(areTypesEquivalent('int8', 'bigint')).toBe(true);
    });

    test('smallint should be equivalent to int2', () => {
      expect(areTypesEquivalent('smallint', 'int2')).toBe(true);
    });

    test('boolean should be equivalent to bool', () => {
      expect(areTypesEquivalent('boolean', 'bool')).toBe(true);
      expect(areTypesEquivalent('bool', 'boolean')).toBe(true);
    });

    test('timestamp variations should be equivalent', () => {
      expect(areTypesEquivalent('timestamp', 'timestamp without time zone')).toBe(true);
      expect(areTypesEquivalent('timestamp without time zone', 'timestamp')).toBe(true);
    });

    test('timestamptz variations should be equivalent', () => {
      expect(areTypesEquivalent('timestamptz', 'timestamp with time zone')).toBe(true);
      expect(areTypesEquivalent('timestamp with time zone', 'timestamptz')).toBe(true);
    });

    test('double precision should be equivalent to float8', () => {
      expect(areTypesEquivalent('double precision', 'float8')).toBe(true);
      expect(areTypesEquivalent('float8', 'double precision')).toBe(true);
    });

    test('real should be equivalent to float4', () => {
      expect(areTypesEquivalent('real', 'float4')).toBe(true);
      expect(areTypesEquivalent('float4', 'real')).toBe(true);
    });

    test('should handle type with length specifications', () => {
      expect(areTypesEquivalent('character varying', 'varchar(255)')).toBe(true);
      expect(areTypesEquivalent('varchar(255)', 'character varying')).toBe(true);
    });

    test('should not match non-equivalent types', () => {
      expect(areTypesEquivalent('integer', 'text')).toBe(false);
      expect(areTypesEquivalent('varchar', 'integer')).toBe(false);
      expect(areTypesEquivalent('timestamp', 'date')).toBe(false);
    });

    test('should handle case insensitivity', () => {
      expect(areTypesEquivalent('VARCHAR', 'character varying')).toBe(true);
      expect(areTypesEquivalent('INTEGER', 'int')).toBe(true);
    });
  });
});
