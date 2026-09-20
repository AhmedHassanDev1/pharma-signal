import { createHash } from 'node:crypto';
import { TableSchema } from '@pharma-signal/contracts';

/**
 * Normalizes and canonically sorts a TableSchema array so that
 * equivalent schemas always produce the exact same serialized string.
 */
export function canonicalizeTables(tables: TableSchema[]): unknown[] {
  // Sort tables deterministically by name (lowercase)
  const sortedTables = [...tables].sort((a, b) => a.name.localeCompare(b.name));

  return sortedTables.map((table) => {
    // Sort columns deterministically by name
    const sortedColumns = [...(table.columns || [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((col) => ({
        dataType: col.dataType.toLowerCase(),
        defaultValue: col.defaultValue ?? null,
        isNullable: Boolean(col.isNullable),
        isPrimaryKey: Boolean(col.isPrimaryKey),
        maxLength: col.maxLength ?? null,
        name: col.name
      }));

    // Sort primary keys deterministically
    const sortedPrimaryKey = [...(table.primaryKey || [])].sort();

    // Sort foreign keys deterministically by columnName then referencedTable
    const sortedForeignKeys = [...(table.foreignKeys || [])]
      .sort((a, b) => {
        const colCmp = a.columnName.localeCompare(b.columnName);
        if (colCmp !== 0) return colCmp;
        return a.referencedTable.localeCompare(b.referencedTable);
      })
      .map((fk) => ({
        columnName: fk.columnName,
        constraintName: fk.constraintName ?? null,
        referencedColumn: fk.referencedColumn,
        referencedTable: fk.referencedTable
      }));

    // Sort indexes deterministically by name
    const sortedIndexes = [...(table.indexes || [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((idx) => ({
        columns: [...idx.columns].sort(),
        isUnique: Boolean(idx.isUnique),
        name: idx.name
      }));

    return {
      columns: sortedColumns,
      foreignKeys: sortedForeignKeys,
      indexes: sortedIndexes,
      name: table.name,
      primaryKey: sortedPrimaryKey
    };
  });
}

/**
 * Computes a deterministic SHA-256 fingerprint (64-character hex string)
 * for a given list of table schemas.
 */
export function computeSchemaFingerprint(tables: TableSchema[]): string {
  const canonical = canonicalizeTables(tables);
  const jsonString = JSON.stringify(canonical);
  return createHash('sha256').update(jsonString, 'utf8').digest('hex');
}
