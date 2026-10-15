import { describe, it, expect } from 'vitest';
import { NAVIGATION_CONFIG } from '../src/config/navigation';

describe('Navigation Logic', () => {
  it('TEST C: User sees only navigation items permitted by RBAC', () => {
    const userPermissions = ['customer.view', 'ticket.view'];
    const isOwner = false;

    const permittedItems = NAVIGATION_CONFIG.filter((item) => {
      if (!item.permission) return true; // Items without explicit permissions are visible
      if (isOwner) return true;
      return userPermissions.includes(item.permission);
    });

    // Should see Dashboard (no perm), CRM (customer.view), Service Desk (ticket.view)
    const routes = permittedItems.map(i => i.route);
    expect(routes).toContain('/dashboard');
    expect(routes).toContain('/crm/customers');
    expect(routes).toContain('/service-desk');

    // Should NOT see Admin or Roles
    expect(routes).not.toContain('/admin');
    expect(routes).not.toContain('/admin/roles');
  });

  it('TEST D: User without administration permission cannot see administration navigation', () => {
    const userPermissions = ['opportunity.view'];
    const permittedItems = NAVIGATION_CONFIG.filter((item) => {
      if (!item.permission) return true;
      return userPermissions.includes(item.permission);
    });

    const adminSections = permittedItems.filter(i => i.section === 'ADMINISTRATION');
    expect(adminSections.length).toBe(0); // Only things with no perm or opportunity.view
  });

  it('TEST C & D (Owner): Owner sees all navigation items', () => {
    const userPermissions: string[] = [];
    const isOwner = true;

    const permittedItems = NAVIGATION_CONFIG.filter((item) => {
      if (!item.permission) return true;
      if (isOwner) return true;
      return userPermissions.includes(item.permission);
    });

    expect(permittedItems.length).toBe(NAVIGATION_CONFIG.length);
  });
});
