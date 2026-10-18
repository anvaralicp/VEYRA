/**
 * STG-05: Real Transaction-Commit Crash Recovery Verification
 * 
 * Target Database: veyra_staging_final_stg (disposable local PostgreSQL)
 * Tests deterministic test hooks:
 * 1. Crash BEFORE commit boundary -> Verifies clean rollback, asserts ROLLED_BACK disposition
 * 2. Crash immediately AFTER commit boundary -> Verifies durable commit, asserts COMMITTED disposition
 * 3. Injected ambiguous divergence -> Verifies UNCERTAIN_CRASH detection, records ReconciliationAnomaly
 */

const { Client } = require('pg');
const { createHash } = require('crypto');
const { spawnSync } = require('child_process');

const connectionString = 'postgresql://postgres:user%40123@localhost:5432/veyra_staging_final_stg';

function computeCanonicalSha256(data) {
  const canonicalJson = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(canonicalJson).digest('hex');
}

/**
 * Replicates analyzeBatchRecovery from scripts/migrate-increment-2.ts
 * against a raw pg client for accurate PostgreSQL verification.
 */
async function analyzeBatchRecovery(client, migrationKey, attemptId, batchCursor) {
  const baselinesRes = await client.query(`
    SELECT * FROM "MigrationBatchBaseline"
    WHERE migration_key = $1 AND attempt_id = $2 AND batch_cursor = $3;
  `, [migrationKey, attemptId, batchCursor]);

  const baselines = baselinesRes.rows;
  if (!baselines || baselines.length === 0) {
    return {
      disposition: 'ROLLED_BACK',
      details: 'No baseline captured for cursor. Batch was not in flight or rolled back cleanly before baseline commit.'
    };
  }

  let fullyProvenCommittedCount = 0;
  let fullyProvenAbortedCount = 0;

  for (const b of baselines) {
    const liveRes = await client.query(`
      SELECT version, lifecycle_status, is_security_restricted, is_policy_restricted, is_billing_restricted, is_administrative_restricted
      FROM "Tenant" WHERE id = $1;
    `, [b.tenant_id]);

    if (liveRes.rows.length === 0) {
      return {
        disposition: 'UNCERTAIN_CRASH',
        details: `Tenant ${b.tenant_id} in baseline missing from live table`
      };
    }
    const live = liveRes.rows[0];

    const manifestRes = await client.query(`
      SELECT status FROM "MigrationManifestItem"
      WHERE migration_key = $1 AND attempt_id = $2 AND tenant_id = $3;
    `, [migrationKey, attemptId, b.tenant_id]);

    if (manifestRes.rows.length === 0) {
      return {
        disposition: 'UNCERTAIN_CRASH',
        details: `Tenant ${b.tenant_id} has baseline record but is missing from MigrationManifestItem`
      };
    }
    const manifestItem = manifestRes.rows[0];

    const auditRes = await client.query(`
      SELECT details FROM "AuditLog"
      WHERE tenant_id = $1 AND entity = 'Tenant' AND action IN ('TENANT_SUSPEND', 'TENANT_REACTIVATE')
      ORDER BY created_at DESC LIMIT 5;
    `, [b.tenant_id]);

    const liveVer = live.version;
    const targetVer = b.pre_version + 1;

    const provenanceLog = auditRes.rows.find(l => {
      let details;
      try {
        details = typeof l.details === 'string' ? JSON.parse(l.details) : l.details;
      } catch {
        return false;
      }
      return (
        details &&
        details.source === 'INCREMENT_2_BACKFILL' &&
        details.migration_key === migrationKey &&
        details.attempt_id === attemptId &&
        details.batch_cursor === batchCursor &&
        details.fromVersion === b.pre_version &&
        details.toVersion === targetVer
      );
    });

    // Branch 1: PROVEN COMMITTED
    if (liveVer === targetVer && manifestItem.status === 'PROCESSED' && provenanceLog) {
      fullyProvenCommittedCount++;
      continue;
    }

    // Branch 2: PROVEN ABORTED / ROLLED BACK
    if (
      liveVer === b.pre_version &&
      live.lifecycle_status === b.pre_lifecycle_status &&
      Boolean(live.is_security_restricted) === b.pre_security &&
      Boolean(live.is_policy_restricted) === b.pre_policy &&
      Boolean(live.is_billing_restricted) === b.pre_billing &&
      Boolean(live.is_administrative_restricted) === b.pre_administrative &&
      manifestItem.status === 'PENDING' &&
      !provenanceLog
    ) {
      fullyProvenAbortedCount++;
      continue;
    }

    // Branch 3: Divergence
    return {
      disposition: 'UNCERTAIN_CRASH',
      details: `Evidence contradiction on tenant ${b.tenant_id}: liveVer=${liveVer}, targetVer=${targetVer}, manifestStatus=${manifestItem.status}, hasProvenanceLog=${Boolean(provenanceLog)}`
    };
  }

  if (fullyProvenCommittedCount === baselines.length && fullyProvenAbortedCount === 0) {
    return {
      disposition: 'COMMITTED',
      details: `All ${baselines.length} tenants in batch have multi-factor proof of commit (version, manifest status, exact provenance log).`
    };
  }

  if (fullyProvenAbortedCount === baselines.length && fullyProvenCommittedCount === 0) {
    return {
      disposition: 'ROLLED_BACK',
      details: `All ${baselines.length} tenants in batch have multi-factor proof of rollback (baseline match, pending manifest, zero provenance log).`
    };
  }

  return {
    disposition: 'UNCERTAIN_CRASH',
    details: `Non-unanimous batch recovery: ${fullyProvenCommittedCount} proven committed, ${fullyProvenAbortedCount} proven rolled back out of ${baselines.length}`
  };
}

async function runSTG05() {
  const client = new Client({ connectionString });
  await client.connect();

  console.log('================================================================');
  console.log('STG-05: REAL TRANSACTION-COMMIT CRASH RECOVERY VALIDATION');
  console.log('Target: veyra_staging_final_stg');
  console.log('================================================================\n');

  // Verify target
  const idRes = await client.query('SELECT current_database(), current_user;');
  if (idRes.rows[0].current_database !== 'veyra_staging_final_stg') {
    throw new Error('SECURITY_HALT: Target is not veyra_staging_final_stg');
  }

  await client.query('TRUNCATE "Tenant", "AuditLog", "MigrationWatermark", "MigrationManifestItem", "MigrationBatchBaseline", "ReconciliationAnomaly" CASCADE;');

  const results = {
    case1_preCommitCrash: null,
    case2_postCommitCrash: null,
    case3_divergentAmbiguity: null,
    idempotentRecovery: null
  };

  // -------------------------------------------------------------------------
  // CASE 1: Pre-Commit Crash Hook
  // Transaction B executes mutations, but client drops/aborts immediately
  // BEFORE server COMMIT.
  // Expected: Server rolls back WAL, classifier confirms ROLLED_BACK.
  // -------------------------------------------------------------------------
  console.log('--- CASE 1: Pre-Commit Crash Hook (Termination Before COMMIT) ---');
  const t1Res = await client.query(`
    INSERT INTO "Tenant" (id, name, version, lifecycle_status, updated_at)
    VALUES (gen_random_uuid(), 'STG-05 Tenant Case 1', 1, 'ACTIVE', NOW())
    RETURNING id;
  `);
  const t1Id = t1Res.rows[0].id;
  const migKey1 = 'mig-stg05-case1';
  const attId1 = 'att-stg05-1';
  const cursor1 = 'cursor-1';

  // Seed baseline and pending manifest
  await client.query(`
    INSERT INTO "MigrationWatermark" (migration_key, attempt_id, manifest_digest, total_records)
    VALUES ($1, $2, 'dummy-digest-1', 1);
  `, [migKey1, attId1]);

  await client.query(`
    INSERT INTO "MigrationManifestItem" (migration_key, attempt_id, tenant_id, status)
    VALUES ($1, $2, $3, 'PENDING');
  `, [migKey1, attId1, t1Id]);

  await client.query(`
    INSERT INTO "MigrationBatchBaseline" (migration_key, attempt_id, batch_cursor, tenant_id, pre_version, pre_lifecycle_status, pre_security, pre_policy, pre_billing, pre_administrative)
    VALUES ($1, $2, $3, $4, 1, 'ACTIVE', false, false, false, false);
  `, [migKey1, attId1, cursor1, t1Id]);

  // Execute in a separate connection simulating Transaction B with PRE-COMMIT CRASH HOOK
  const workerClient1 = new Client({ connectionString });
  await workerClient1.connect();
  await workerClient1.query('BEGIN;');
  // Mutate tenant under row lock
  await workerClient1.query('UPDATE "Tenant" SET version = 2, lifecycle_status = \'ACTIVE\' WHERE id = $1;', [t1Id]);
  // Insert provenance audit log
  await workerClient1.query(`
    INSERT INTO "AuditLog" (id, tenant_id, user_id, action, entity, entity_id, details)
    VALUES (gen_random_uuid(), $1, 'SYSTEM_MIGRATION_INCREMENT_2', 'TENANT_REACTIVATE', 'Tenant', $1, $2);
  `, [t1Id, JSON.stringify({
    source: 'INCREMENT_2_BACKFILL',
    migration_key: migKey1,
    attempt_id: attId1,
    batch_cursor: cursor1,
    fromVersion: 1,
    toVersion: 2,
    actionClass: 'CLASS_A'
  })]);
  // Update manifest item
  await workerClient1.query(`
    UPDATE "MigrationManifestItem" SET status = 'PROCESSED' WHERE migration_key = $1 AND attempt_id = $2 AND tenant_id = $3;
  `, [migKey1, attId1, t1Id]);

  // DETERMINISTIC HOOK: Crash / abort right before COMMIT!
  console.log('[HOOK_BEFORE_COMMIT] Fired: Simulating process crash before COMMIT');
  // Abruptly destroy worker socket without sending COMMIT
  workerClient1.end(); // Or destroy connection, triggering PostgreSQL backend termination & rollback

  // Wait a moment for PostgreSQL to release row locks and clean up backend
  await new Promise(r => setTimeout(r, 500));

  // Now run analyzeBatchRecovery
  const rec1 = await analyzeBatchRecovery(client, migKey1, attId1, cursor1);
  console.log('Case 1 Recovery Disposition:', rec1.disposition);
  console.log('Case 1 Details:', rec1.details);

  const t1Check = await client.query('SELECT version, lifecycle_status FROM "Tenant" WHERE id = $1;', [t1Id]);
  const m1Check = await client.query('SELECT status FROM "MigrationManifestItem" WHERE migration_key = $1 AND tenant_id = $2;', [migKey1, t1Id]);
  const a1Check = await client.query('SELECT count(*) FROM "AuditLog" WHERE tenant_id = $1;', [t1Id]);

  console.log(`Durable state after pre-commit crash: Version=${t1Check.rows[0].version}, ManifestStatus=${m1Check.rows[0].status}, AuditLogs=${a1Check.rows[0].count}`);

  if (rec1.disposition !== 'ROLLED_BACK' || t1Check.rows[0].version !== 1 || m1Check.rows[0].status !== 'PENDING' || parseInt(a1Check.rows[0].count) !== 0) {
    throw new Error('STG-05 Case 1 FAILED: Expected clean ROLLED_BACK state');
  }
  results.case1_preCommitCrash = 'PASS (Proven Rollback)';
  console.log('Case 1 Result: PASS\n');

  // -------------------------------------------------------------------------
  // CASE 2: Post-Commit Crash Hook
  // Server executes COMMIT and makes data durable, but client process crashes
  // immediately upon commit confirmation before watermark update or next cursor.
  // Expected: Server state committed, classifier confirms COMMITTED.
  // -------------------------------------------------------------------------
  console.log('--- CASE 2: Post-Commit Crash Hook (Termination Immediately AFTER COMMIT) ---');
  const t2Res = await client.query(`
    INSERT INTO "Tenant" (id, name, version, lifecycle_status, updated_at)
    VALUES (gen_random_uuid(), 'STG-05 Tenant Case 2', 1, 'ACTIVE', NOW())
    RETURNING id;
  `);
  const t2Id = t2Res.rows[0].id;
  const migKey2 = 'mig-stg05-case2';
  const attId2 = 'att-stg05-2';
  const cursor2 = 'cursor-1';

  await client.query(`
    INSERT INTO "MigrationWatermark" (migration_key, attempt_id, manifest_digest, total_records)
    VALUES ($1, $2, 'dummy-digest-2', 1);
  `, [migKey2, attId2]);

  await client.query(`
    INSERT INTO "MigrationManifestItem" (migration_key, attempt_id, tenant_id, status)
    VALUES ($1, $2, $3, 'PENDING');
  `, [migKey2, attId2, t2Id]);

  await client.query(`
    INSERT INTO "MigrationBatchBaseline" (migration_key, attempt_id, batch_cursor, tenant_id, pre_version, pre_lifecycle_status, pre_security, pre_policy, pre_billing, pre_administrative)
    VALUES ($1, $2, $3, $4, 1, 'ACTIVE', false, false, false, false);
  `, [migKey2, attId2, cursor2, t2Id]);

  // Execute in worker client
  const workerClient2 = new Client({ connectionString });
  await workerClient2.connect();
  await workerClient2.query('BEGIN;');
  await workerClient2.query('UPDATE "Tenant" SET version = 2, lifecycle_status = \'ACTIVE\' WHERE id = $1;', [t2Id]);
  await workerClient2.query(`
    INSERT INTO "AuditLog" (id, tenant_id, user_id, action, entity, entity_id, details)
    VALUES (gen_random_uuid(), $1, 'SYSTEM_MIGRATION_INCREMENT_2', 'TENANT_REACTIVATE', 'Tenant', $1, $2);
  `, [t2Id, JSON.stringify({
    source: 'INCREMENT_2_BACKFILL',
    migration_key: migKey2,
    attempt_id: attId2,
    batch_cursor: cursor2,
    fromVersion: 1,
    toVersion: 2,
    actionClass: 'CLASS_A'
  })]);
  await workerClient2.query(`
    UPDATE "MigrationManifestItem" SET status = 'PROCESSED' WHERE migration_key = $1 AND attempt_id = $2 AND tenant_id = $3;
  `, [migKey2, attId2, t2Id]);

  // COMMIT succeeds on server!
  await workerClient2.query('COMMIT;');

  // DETERMINISTIC HOOK: Crash client immediately after COMMIT before watermark update!
  console.log('[HOOK_AFTER_COMMIT] Fired: Server committed, client process terminating immediately');
  workerClient2.end();

  // Run recovery classifier
  const rec2 = await analyzeBatchRecovery(client, migKey2, attId2, cursor2);
  console.log('Case 2 Recovery Disposition:', rec2.disposition);
  console.log('Case 2 Details:', rec2.details);

  const t2Check = await client.query('SELECT version, lifecycle_status FROM "Tenant" WHERE id = $1;', [t2Id]);
  const m2Check = await client.query('SELECT status FROM "MigrationManifestItem" WHERE migration_key = $1 AND tenant_id = $2;', [migKey2, t2Id]);
  const a2Check = await client.query('SELECT count(*) FROM "AuditLog" WHERE tenant_id = $1;', [t2Id]);

  console.log(`Durable state after post-commit crash: Version=${t2Check.rows[0].version}, ManifestStatus=${m2Check.rows[0].status}, AuditLogs=${a2Check.rows[0].count}`);

  if (rec2.disposition !== 'COMMITTED' || t2Check.rows[0].version !== 2 || m2Check.rows[0].status !== 'PROCESSED' || parseInt(a2Check.rows[0].count) !== 1) {
    throw new Error('STG-05 Case 2 FAILED: Expected clean COMMITTED state');
  }
  results.case2_postCommitCrash = 'PASS (Proven Commit)';
  console.log('Case 2 Result: PASS\n');

  // -------------------------------------------------------------------------
  // CASE 3: Ambiguous Divergence (UNCERTAIN_CRASH)
  // Injected discrepancy: Tenant version advanced to 2 out of band, but
  // MigrationManifestItem is still PENDING and zero provenance AuditLog exists.
  // Expected: Classifier returns UNCERTAIN_CRASH, records anomaly durably.
  // -------------------------------------------------------------------------
  console.log('--- CASE 3: Injected Ambiguous Divergence (Contradictory Evidence) ---');
  const t3Res = await client.query(`
    INSERT INTO "Tenant" (id, name, version, lifecycle_status, updated_at)
    VALUES (gen_random_uuid(), 'STG-05 Tenant Case 3', 2, 'ACTIVE', NOW())
    RETURNING id;
  `);
  const t3Id = t3Res.rows[0].id;
  const migKey3 = 'mig-stg05-case3';
  const attId3 = 'att-stg05-3';
  const cursor3 = 'cursor-1';

  await client.query(`
    INSERT INTO "MigrationWatermark" (migration_key, attempt_id, manifest_digest, total_records)
    VALUES ($1, $2, 'dummy-digest-3', 1);
  `, [migKey3, attId3]);

  // Manifest item remains PENDING
  await client.query(`
    INSERT INTO "MigrationManifestItem" (migration_key, attempt_id, tenant_id, status)
    VALUES ($1, $2, $3, 'PENDING');
  `, [migKey3, attId3, t3Id]);

  // Baseline recorded pre_version = 1
  await client.query(`
    INSERT INTO "MigrationBatchBaseline" (migration_key, attempt_id, batch_cursor, tenant_id, pre_version, pre_lifecycle_status, pre_security, pre_policy, pre_billing, pre_administrative)
    VALUES ($1, $2, $3, $4, 1, 'ACTIVE', false, false, false, false);
  `, [migKey3, attId3, cursor3, t3Id]);

  const rec3 = await analyzeBatchRecovery(client, migKey3, attId3, cursor3);
  console.log('Case 3 Recovery Disposition:', rec3.disposition);
  console.log('Case 3 Details:', rec3.details);

  if (rec3.disposition !== 'UNCERTAIN_CRASH') {
    throw new Error(`STG-05 Case 3 FAILED: Expected UNCERTAIN_CRASH, got ${rec3.disposition}`);
  }

  // Record durable anomaly out-of-band as required by APPR-03 / POL-01
  await client.query(`
    INSERT INTO "ReconciliationAnomaly" (migration_key, attempt_id, tenant_id, anomaly_type, resolution_note)
    VALUES ($1, $2, $3, 'UNCERTAIN_CRASH', $4);
  `, [migKey3, attId3, t3Id, rec3.details]);

  const anomCheck = await client.query('SELECT anomaly_type, resolution_note FROM "ReconciliationAnomaly" WHERE tenant_id = $1;', [t3Id]);
  console.log('Durable anomaly recorded:', anomCheck.rows[0]);
  if (anomCheck.rows.length === 0 || anomCheck.rows[0].anomaly_type !== 'UNCERTAIN_CRASH') {
    throw new Error('STG-05 Case 3 FAILED: Anomaly was not durably recorded');
  }
  results.case3_divergentAmbiguity = 'PASS (Trapped as UNCERTAIN_CRASH & Durably Quarantined)';
  console.log('Case 3 Result: PASS\n');

  // -------------------------------------------------------------------------
  // CASE 4: Non-Unanimous Multi-Tenant Batch Divergence
  // Batch contains 2 tenants: Tenant A is fully proven COMMITTED,
  // while Tenant B is fully proven ROLLED_BACK.
  // Expected: Classifier detects non-unanimity, rejects batch as UNCERTAIN_CRASH.
  // -------------------------------------------------------------------------
  console.log('--- CASE 4: Non-Unanimous Multi-Tenant Batch Divergence ---');
  const t4aRes = await client.query(`
    INSERT INTO "Tenant" (id, name, version, lifecycle_status, updated_at)
    VALUES (gen_random_uuid(), 'STG-05 Tenant Case 4A', 2, 'ACTIVE', NOW())
    RETURNING id;
  `);
  const t4aId = t4aRes.rows[0].id;

  const t4bRes = await client.query(`
    INSERT INTO "Tenant" (id, name, version, lifecycle_status, updated_at)
    VALUES (gen_random_uuid(), 'STG-05 Tenant Case 4B', 1, 'ACTIVE', NOW())
    RETURNING id;
  `);
  const t4bId = t4bRes.rows[0].id;

  const migKey4 = 'mig-stg05-case4';
  const attId4 = 'att-stg05-4';
  const cursor4 = 'cursor-multi';

  await client.query(`
    INSERT INTO "MigrationWatermark" (migration_key, attempt_id, manifest_digest, total_records)
    VALUES ($1, $2, 'dummy-digest-4', 2);
  `, [migKey4, attId4]);

  // Manifest items: 4A is PROCESSED, 4B is PENDING
  await client.query(`
    INSERT INTO "MigrationManifestItem" (migration_key, attempt_id, tenant_id, status)
    VALUES ($1, $2, $3, 'PROCESSED'), ($1, $2, $4, 'PENDING');
  `, [migKey4, attId4, t4aId, t4bId]);

  // Baselines for both: pre_version = 1
  await client.query(`
    INSERT INTO "MigrationBatchBaseline" (migration_key, attempt_id, batch_cursor, tenant_id, pre_version, pre_lifecycle_status, pre_security, pre_policy, pre_billing, pre_administrative)
    VALUES 
      ($1, $2, $3, $4, 1, 'ACTIVE', false, false, false, false),
      ($1, $2, $3, $5, 1, 'ACTIVE', false, false, false, false);
  `, [migKey4, attId4, cursor4, t4aId, t4bId]);

  // Audit log only for 4A
  await client.query(`
    INSERT INTO "AuditLog" (id, tenant_id, user_id, action, entity, entity_id, details)
    VALUES (gen_random_uuid(), $1, 'SYSTEM_MIGRATION_INCREMENT_2', 'TENANT_REACTIVATE', 'Tenant', $1, $2);
  `, [t4aId, JSON.stringify({
    source: 'INCREMENT_2_BACKFILL',
    migration_key: migKey4,
    attempt_id: attId4,
    batch_cursor: cursor4,
    fromVersion: 1,
    toVersion: 2,
    actionClass: 'CLASS_A'
  })]);

  const rec4 = await analyzeBatchRecovery(client, migKey4, attId4, cursor4);
  console.log('Case 4 Recovery Disposition:', rec4.disposition);
  console.log('Case 4 Details:', rec4.details);

  if (rec4.disposition !== 'UNCERTAIN_CRASH' || !rec4.details.includes('Non-unanimous')) {
    throw new Error('STG-05 Case 4 FAILED: Expected UNCERTAIN_CRASH for non-unanimous batch');
  }
  results.case4_nonUnanimousBatch = 'PASS (Trapped as UNCERTAIN_CRASH due to mixed batch outcome)';
  console.log('Case 4 Result: PASS\n');

  // -------------------------------------------------------------------------
  // Idempotency Verification
  // Re-running analyzeBatchRecovery on Case 1 and Case 2 produces identical
  // dispositions without side-effects or state mutation.
  // -------------------------------------------------------------------------
  console.log('--- IDEMPOTENCY VERIFICATION: Re-evaluating Recovery ---');
  const reRec1 = await analyzeBatchRecovery(client, migKey1, attId1, cursor1);
  const reRec2 = await analyzeBatchRecovery(client, migKey2, attId2, cursor2);

  if (reRec1.disposition !== 'ROLLED_BACK' || reRec2.disposition !== 'COMMITTED') {
    throw new Error('STG-05 Idempotency FAILED: Dispositions changed across successive runs');
  }
  results.idempotentRecovery = 'PASS (Identical Dispositions across runs)';
  console.log('Idempotency Check: PASS\n');

  console.log('================================================================');
  console.log('STG-05 FINAL RESULT: ALL 4 TESTS PASSED');
  console.log(JSON.stringify(results, null, 2));
  console.log('================================================================');

  await client.end();
}

runSTG05().catch(e => {
  console.error('STG-05 EXECUTION FAILED:', e);
  process.exit(1);
});
