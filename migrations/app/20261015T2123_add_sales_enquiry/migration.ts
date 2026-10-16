#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6e759b1fbdd320a6aab15695a1f5b8210c9cb6f00212665c00adceac0741de93/contract';
import endContract from '../../snapshots/6e759b1fbdd320a6aab15695a1f5b8210c9cb6f00212665c00adceac0741de93/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d99d6e7d7630d717bcf8fb23c91f0aa2010b50abd04be8bdd42b4d66422d5102/contract';
import startContract from '../../snapshots/d99d6e7d7630d717bcf8fb23c91f0aa2010b50abd04be8bdd42b4d66422d5102/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'SalesEnquiry',
        columns: [
          col('company', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('contact_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ip_address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('modules', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reference_number', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('NEW'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updated_at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('user_count', 'text', { default: lit('10-50'), codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SalesEnquiry',
        index: 'SalesEnquiry_created_at_idx',
        columns: ['created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SalesEnquiry',
        index: 'SalesEnquiry_email_idx',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SalesEnquiry',
        index: 'SalesEnquiry_reference_number_key',
        columns: ['reference_number'],
        extras: { unique: true },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
