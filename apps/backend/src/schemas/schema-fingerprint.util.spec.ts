import { computeSchemaFingerprint } from './schema-fingerprint.util.js';
import { TableSchema } from '@pharma-signal/contracts';

describe('Schema Fingerprint Utility (Deterministic Canonicalization)', () => {
  const table1: TableSchema = {
    name: 'products',
    columns: [
      { name: 'id', dataType: 'UUID', isNullable: false, isPrimaryKey: true },
      { name: 'name', dataType: 'VARCHAR', isNullable: false, isPrimaryKey: false, maxLength: 255 },
      { name: 'price', dataType: 'NUMERIC', isNullable: true, isPrimaryKey: false }
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'idx_products_name', columns: ['name'], isUnique: false }
    ]
  };

  const table2: TableSchema = {
    name: 'batches',
    columns: [
      { name: 'id', dataType: 'UUID', isNullable: false, isPrimaryKey: true },
      { name: 'product_id', dataType: 'UUID', isNullable: false, isPrimaryKey: false },
      { name: 'quantity', dataType: 'INT', isNullable: false, isPrimaryKey: false }
    ],
    primaryKey: ['id'],
    foreignKeys: [
      { columnName: 'product_id', referencedTable: 'products', referencedColumn: 'id' }
    ]
  };

  it('should compute the same fingerprint regardless of table ordering in input array', () => {
    const fp1 = computeSchemaFingerprint([table1, table2]);
    const fp2 = computeSchemaFingerprint([table2, table1]);

    expect(fp1).toHaveLength(64);
    expect(fp1).toBe(fp2);
  });

  it('should compute the same fingerprint regardless of column ordering in table', () => {
    const table1Reordered: TableSchema = {
      ...table1,
      columns: [
        { name: 'price', dataType: 'NUMERIC', isNullable: true, isPrimaryKey: false },
        { name: 'id', dataType: 'UUID', isNullable: false, isPrimaryKey: true },
        { name: 'name', dataType: 'VARCHAR', isNullable: false, isPrimaryKey: false, maxLength: 255 }
      ]
    };

    const fp1 = computeSchemaFingerprint([table1]);
    const fp2 = computeSchemaFingerprint([table1Reordered]);

    expect(fp1).toBe(fp2);
  });

  it('should produce a different fingerprint when a column type or definition changes', () => {
    const table1Modified: TableSchema = {
      ...table1,
      columns: [
        { name: 'id', dataType: 'UUID', isNullable: false, isPrimaryKey: true },
        { name: 'name', dataType: 'TEXT', isNullable: false, isPrimaryKey: false },
        { name: 'price', dataType: 'NUMERIC', isNullable: true, isPrimaryKey: false }
      ]
    };

    const fpOriginal = computeSchemaFingerprint([table1]);
    const fpModified = computeSchemaFingerprint([table1Modified]);

    expect(fpOriginal).not.toBe(fpModified);
  });

  it('should produce a different fingerprint when a new table is added', () => {
    const fp1 = computeSchemaFingerprint([table1]);
    const fp2 = computeSchemaFingerprint([table1, table2]);

    expect(fp1).not.toBe(fp2);
  });
});
