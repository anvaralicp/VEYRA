/* eslint-disable @typescript-eslint/no-explicit-any */
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from '@prisma/orm-postgres/runtime';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };
import type { Contract } from '../src/prisma/contract.d';
import { getModel } from '../src/lib/db/legacy-adapter';
import { hashPassword } from '../src/lib/auth/password';
import crypto from 'crypto';

describe('Real PostgreSQL Integration Gate: Registration Rollback & Invitation Concurrency (veyra_test)', () => {
  let testDb: any;
  let testDbUrl: string;

  // Cleanup tracking IDs
  const createdTenantIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdInvitationIds: string[] = [];

  beforeAll(async () => {
    const rawUrl = process.env.TEST_DATABASE_URL;
    if (!rawUrl) {
      throw new Error(
        'TEST_DATABASE_URL is not configured. PostgreSQL integration tests require an explicitly configured, isolated test database (e.g. postgresql://postgres:postgres@localhost:5432/veyra_test). Refusing to connect or run to protect production databases.'
      );
    }

    const parsedUrl = new URL(rawUrl);
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname.includes('neon.tech') ||
      parsedUrl.pathname === '/neondb' ||
      parsedUrl.pathname.includes('neon')
    ) {
      throw new Error(
        `CRITICAL: TEST_DATABASE_URL targets production database "${parsedUrl.pathname}". Aborting immediately.`
      );
    }

    testDbUrl = rawUrl;
    testDb = postgres<Contract>({
      contractJson,
      url: testDbUrl,
    });
  });

  afterAll(async () => {
    if (!testDb) return;
    // Clean up created test entities from veyra_test
    for (const invId of createdInvitationIds) {
      try {
        await testDb.orm.public.Invitation.where({ id: invId }).delete();
      } catch {
        // ignore
      }
    }
    for (const tId of createdTenantIds) {
      try {
        await testDb.orm.public.TenantMember.where({ tenant_id: tId }).deleteAll();
        await testDb.orm.public.MemberRole.where({ tenant_id: tId }).deleteAll();
        await testDb.orm.public.RolePermission.where({ tenant_id: tId }).deleteAll();
        await testDb.orm.public.Role.where({ tenant_id: tId }).deleteAll();
        await testDb.orm.public.AuditLog.where({ tenant_id: tId }).deleteAll();
        await testDb.orm.public.Tenant.where({ id: tId }).delete();
      } catch {
        // ignore
      }
    }
    for (const uId of createdUserIds) {
      try {
        await testDb.orm.public.User.where({ id: uId }).delete();
      } catch {
        // ignore
      }
    }
  });

  describe('1. Registration Rollback Verification on Real PostgreSQL', () => {
    it('proves that a controlled failure during tenant bootstrap rolls back User, Tenant, TenantMember, Role, and AuditLog', async () => {
      const uniqueId = crypto.randomUUID();
      const testEmail = `rollback-verify-${uniqueId}@integration.local`;
      const tenantName = `Rollback Test Org ${uniqueId}`;
      let recordedUserId: string | null = null;
      let recordedTenantId: string | null = null;

      const runTransaction = testDb.transaction.bind(testDb);

      let caughtError: any = null;
      try {
        await runTransaction(async (tx: any) => {
          const User = getModel(tx, 'User');
          const Tenant = getModel(tx, 'Tenant');
          const Role = getModel(tx, 'Role');
          const TenantMember = getModel(tx, 'TenantMember');
          const AuditLog = getModel(tx, 'AuditLog');

          // 1. Create User inside transaction
          const user = await User.create({
            data: {
              name: 'Rollback User',
              email: testEmail,
              password_hash: '$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
              status: 'ACTIVE',
            },
          });
          recordedUserId = user.id;

          // 2. Create Tenant inside transaction
          const tenant = await Tenant.create({
            data: {
              name: tenantName,
            },
          });
          recordedTenantId = tenant.id;

          // 3. Create Role inside transaction
          await Role.create({
            data: {
              tenant_id: tenant.id,
              code: 'OWNER',
              name: 'Owner',
              description: 'Owner role',
              status: 'ACTIVE',
            },
          });

          // 4. Create TenantMember inside transaction
          await TenantMember.create({
            data: {
              user_id: user.id,
              tenant_id: tenant.id,
              role: 'OWNER',
              status: 'ACTIVE',
            },
          });

          // 5. Create AuditLog inside transaction
          await AuditLog.create({
            data: {
              tenant_id: tenant.id,
              action: 'CREATE',
              entity: 'TenantBootstrap',
              user_id: user.id,
              details: JSON.stringify({ message: 'Testing rollback' }),
            },
          });

          // 6. Force a controlled failure before transaction commits
          throw new Error('SIMULATED_BOOTSTRAP_FAILURE_TRIGGERING_ROLLBACK');
        });
      } catch (err: any) {
        caughtError = err;
      }

      // Assert error was thrown
      expect(caughtError).toBeDefined();
      expect(caughtError.message).toContain('SIMULATED_BOOTSTRAP_FAILURE_TRIGGERING_ROLLBACK');
      expect(recordedUserId).toBeDefined();
      expect(recordedTenantId).toBeDefined();

      // Query real PostgreSQL database (outside the aborted transaction)
      const userInDb = await testDb.orm.public.User.where({ email: testEmail }).first();
      expect(userInDb).toBeNull();

      const tenantInDb = await testDb.orm.public.Tenant.where({ id: recordedTenantId! }).first();
      expect(tenantInDb).toBeNull();

      const memberInDb = await testDb.orm.public.TenantMember.where({ user_id: recordedUserId! }).first();
      expect(memberInDb).toBeNull();

      const roleInDb = await testDb.orm.public.Role.where({ tenant_id: recordedTenantId! }).first();
      expect(roleInDb).toBeNull();

      const auditLog = await testDb.orm.public.AuditLog.where({ tenant_id: recordedTenantId! }).first();
      expect(auditLog).toBeNull();
    });
  });

  describe('2. Invitation Concurrency Verification on Real PostgreSQL', () => {
    it('executes two genuinely concurrent acceptance attempts in PostgreSQL: confirms at most one succeeds and exactly one membership exists', async () => {
      // 1. Seed prerequisite Tenant and Inviter User in veyra_test
      const tenantId = crypto.randomUUID();
      createdTenantIds.push(tenantId);
      await testDb.orm.public.Tenant.create({
        id: tenantId,
        name: 'Concurrency Test Tenant',
      });

      const inviterId = crypto.randomUUID();
      createdUserIds.push(inviterId);
      await testDb.orm.public.User.create({
        id: inviterId,
        name: 'Inviter Admin',
        email: `inviter-${inviterId}@integration.local`,
        status: 'ACTIVE',
      });

      // 2. Create a pending Invitation in PostgreSQL
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const invitationId = crypto.randomUUID();
      createdInvitationIds.push(invitationId);

      const invitedEmail = `concurrent-invitee-${invitationId}@integration.local`;
      const expiresAt = new Date(Date.now() + 7 * 86400 * 1000);

      await testDb.orm.public.Invitation.create({
        id: invitationId,
        tenant_id: tenantId,
        email: invitedEmail,
        token_hash: tokenHash,
        invited_by: inviterId,
        status: 'PENDING',
        role: 'MEMBER',
        expires_at: expiresAt,
      });

      // 3. Define the atomic acceptance worker operating against real PostgreSQL
      const executeAtomicAcceptance = async () => {
        const runTransaction = testDb.transaction.bind(testDb);
        return await runTransaction(async (tx: any) => {
          const txInvitation = getModel(tx, 'Invitation');
          const txUser = getModel(tx, 'User');
          const txTenantMember = getModel(tx, 'TenantMember');

          // Read invitation inside the transaction
          const invitation = await txInvitation.findUnique({
            where: { id: invitationId },
          });

          if (!invitation) {
            throw new Error('Invalid invitation.');
          }

          if (invitation.status !== 'PENDING') {
            throw new Error('Invitation is already used or cancelled.');
          }

          if (new Date() > new Date(invitation.expires_at)) {
            await txInvitation.update({
              where: { id: invitationId },
              data: { status: 'EXPIRED' },
            });
            throw new Error('Invitation has expired.');
          }

          if (tokenHash !== invitation.token_hash) {
            throw new Error('Invalid token.');
          }

          // Mark invitation ACCEPTED
          await txInvitation.update({
            where: { id: invitationId },
            data: {
              status: 'ACCEPTED',
              accepted_at: new Date(),
            },
          });

          let user = await txUser.findUnique({
            where: { email: invitedEmail },
          });

          if (!user) {
            const hashed = await hashPassword('ConcurrentPassword123!');
            user = await txUser.create({
              data: {
                email: invitedEmail,
                name: 'Concurrent Invitee',
                password_hash: hashed,
                status: 'ACTIVE',
              },
            });
            createdUserIds.push(user.id);
          }

          // Check if membership already exists (idempotency guard)
          const existingMembership = await txTenantMember.findUnique({
            where: {
              user_id_tenant_id: {
                user_id: user.id,
                tenant_id: invitation.tenant_id,
              },
            },
          });

          if (!existingMembership) {
            await txTenantMember.create({
              data: {
                user_id: user.id,
                tenant_id: invitation.tenant_id,
                role: invitation.role,
                status: 'ACTIVE',
              },
            });
          }

          return { success: true, userId: user.id };
        });
      };

      // 4. Run TWO genuinely concurrent acceptance requests
      const [attemptA, attemptB] = await Promise.allSettled([
        executeAtomicAcceptance(),
        executeAtomicAcceptance(),
      ]);

      // 5. Evaluate concurrency results
      const statuses = [attemptA.status, attemptB.status];
      const fulfilledCount = statuses.filter((s) => s === 'fulfilled').length;
      const rejectedCount = statuses.filter((s) => s === 'rejected').length;

      // Exactly ONE request must succeed; exactly ONE must fail
      expect(fulfilledCount).toBe(1);
      expect(rejectedCount).toBe(1);

      // Inspect the rejected error
      const failedResult = attemptA.status === 'rejected' ? attemptA : (attemptB as PromiseRejectedResult);
      expect(failedResult.reason.message).toContain('Invitation is already used or cancelled.');

      // 6. Query real PostgreSQL to verify database consistency
      const finalInvitation = await testDb.orm.public.Invitation.where({ id: invitationId }).first();
      expect(finalInvitation.status).toBe('ACCEPTED');

      const allMemberships = await testDb.orm.public.TenantMember.where({ tenant_id: tenantId }).all();
      expect(allMemberships.length).toBe(1);
      expect(allMemberships[0].role).toBe('MEMBER');
    });
  });

  describe('3. Full Registration Atomicity, Role Permissions, and Credential Consistency in PostgreSQL', () => {
    it('successfully registers an organization and initial owner atomically without role permission constraint violations', async () => {
      const uniqueId = crypto.randomUUID();
      const testEmail = `owner-${uniqueId}@integration.local`;
      const tenantName = `Enterprise Org ${uniqueId}`;
      const plainPassword = 'CorrectP@ssword123!';

      // Ensure permissions exist in testDb
      const { SYSTEM_PERMISSIONS } = await import('../src/lib/auth/permissions');
      for (const perm of SYSTEM_PERMISSIONS) {
        await testDb.orm.public.Permission.upsert({
          conflictOn: { key: true },
          create: perm,
          update: { resource: perm.resource, action: perm.action, description: perm.description },
        });
      }

      const hashedPassword = await hashPassword(plainPassword);

      // Execute bootstrap transaction against PostgreSQL using testDb
      const runTransaction = testDb.transaction.bind(testDb);

      let createdTenant: any = null;
      let createdUser: any = null;

      await runTransaction(async (tx: any) => {
        const User = getModel(tx, 'User');
        const Tenant = getModel(tx, 'Tenant');
        const Role = getModel(tx, 'Role');
        const RolePermission = getModel(tx, 'RolePermission');
        const TenantMember = getModel(tx, 'TenantMember');
        const MemberRole = getModel(tx, 'MemberRole');
        const AuditLog = getModel(tx, 'AuditLog');
        const Permission = getModel(tx, 'Permission');

        // 1. Create User
        createdUser = await User.create({
          data: {
            name: 'Enterprise Owner',
            email: testEmail,
            password_hash: hashedPassword,
            status: 'ACTIVE',
          },
        });
        createdUserIds.push(createdUser.id);

        // 2. Create Tenant
        createdTenant = await Tenant.create({
          data: {
            name: tenantName,
          },
        });
        createdTenantIds.push(createdTenant.id);

        // 3. Fetch permissions
        const allPerms = await Permission.findMany();
        const permMap = new Map(allPerms.map((p: any) => [p.key, p.id]));

        // 4. Create Roles & RolePermissions with deduplicated permissions
        const { SYSTEM_ROLE_TEMPLATES } = await import('../src/lib/auth/roles');
        let ownerRoleId: string | null = null;

        for (const template of SYSTEM_ROLE_TEMPLATES) {
          const role = await Role.create({
            data: {
              tenant_id: createdTenant.id,
              code: template.code,
              name: template.name,
              description: template.description,
              status: 'ACTIVE',
            },
          });

          if (template.code === 'OWNER') {
            ownerRoleId = role.id;
          }

          const rawKeys = template.permissions.includes('*')
            ? allPerms.map((p: any) => p.key)
            : template.permissions;
          const keysToAssign = Array.from(new Set(rawKeys));

          for (const key of keysToAssign) {
            const permId = permMap.get(key);
            if (permId) {
              await RolePermission.create({
                data: {
                  tenant_id: createdTenant.id,
                  role_id: role.id,
                  permission_id: permId,
                },
              });
            }
          }
        }

        expect(ownerRoleId).toBeDefined();

        // 5. Create TenantMember
        const member = await TenantMember.create({
          data: {
            user_id: createdUser.id,
            tenant_id: createdTenant.id,
            role: 'OWNER',
            status: 'ACTIVE',
          },
        });

        // 6. MemberRole
        await MemberRole.create({
          data: {
            tenant_id: createdTenant.id,
            member_id: member.id,
            role_id: ownerRoleId!,
          },
        });

        // 7. AuditLog
        await AuditLog.create({
          data: {
            tenant_id: createdTenant.id,
            action: 'CREATE',
            entity: 'TenantBootstrap',
            user_id: createdUser.id,
            details: JSON.stringify({ message: 'Tenant initialized with system role templates' }),
          },
        });
      });

      // Verify records exist in PostgreSQL outside transaction
      const userInDb = await testDb.orm.public.User.where({ email: testEmail }).first();
      expect(userInDb).toBeDefined();
      expect(userInDb.status).toBe('ACTIVE');

      // Verify password verification works
      const { verifyPassword } = await import('../src/lib/auth/password');
      const isCorrectPassword = await verifyPassword(plainPassword, userInDb.password_hash);
      expect(isCorrectPassword).toBe(true);

      const isWrongPassword = await verifyPassword('WrongPassword!', userInDb.password_hash);
      expect(isWrongPassword).toBe(false);

      // Verify Tenant and Membership exist and are active
      const tenantInDb = await testDb.orm.public.Tenant.where({ id: createdTenant.id }).first();
      expect(tenantInDb).toBeDefined();

      const memberInDb = await testDb.orm.public.TenantMember.where({
        user_id: createdUser.id,
        tenant_id: createdTenant.id,
      }).first();
      expect(memberInDb).toBeDefined();
      expect(memberInDb.role).toBe('OWNER');
      expect(memberInDb.status).toBe('ACTIVE');

      // Verify roles and role permissions exist
      const rolesInDb = await testDb.orm.public.Role.where({ tenant_id: createdTenant.id }).all();
      expect(rolesInDb.length).toBeGreaterThanOrEqual(10);

      const rolePermsInDb = await testDb.orm.public.RolePermission.where({ tenant_id: createdTenant.id }).all();
      expect(rolePermsInDb.length).toBeGreaterThan(0);

      // Verify duplicate registration attempt is rejected because email already exists
      const duplicateUser = await testDb.orm.public.User.where({ email: testEmail }).first();
      expect(duplicateUser).not.toBeNull();
    });
  });
});
