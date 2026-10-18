const http = require('http');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'stg10-runtime-config.json');
if (!fs.existsSync(configPath)) {
  console.error("Missing stg10-runtime-config.json");
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const BASE_PORT = process.env.PORT || 3999;
const BASE_URL = `http://localhost:${BASE_PORT}`;

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: BASE_PORT,
      path: options.path,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runTests() {
  console.log(`Starting STG-10 Live HTTP Test Suite against ${BASE_URL}...`);
  const results = [];

  const testCases = [
    {
      id: 'TC-10.1',
      name: 'Unauthenticated GET /crm/customers',
      description: 'Request without session token or cookies must be redirected to /login with redirectTo param',
      request: {
        path: '/crm/customers',
        headers: {}
      },
      assert: (res) => {
        const isRedirect = res.statusCode === 307 || res.statusCode === 302 || res.statusCode === 308;
        const location = res.headers['location'] || '';
        const hasLogin = location.includes('/login');
        const pass = isRedirect && hasLogin;
        return {
          pass,
          details: `Status: ${res.statusCode}, Location: ${location}`
        };
      }
    },
    {
      id: 'TC-10.2',
      name: 'User A on Normal Tenant (Active, Unrestricted)',
      description: 'Valid authenticated session with normal tenant cookie should succeed (HTTP 200)',
      request: {
        path: '/crm/customers',
        headers: {
          'Cookie': `session=${config.tokenUserA}; active_tenant_id=${config.tenants.normal}`
        }
      },
      assert: (res) => {
        const isOk = res.statusCode === 200;
        const hasContent = !res.headers['location'];
        return {
          pass: isOk && hasContent,
          details: `Status: ${res.statusCode}, Location: ${res.headers['location'] || 'none'}, Body Length: ${res.body.length}`
        };
      }
    },
    {
      id: 'TC-10.3',
      name: 'User A on Security-Restricted Tenant',
      description: 'Valid authenticated session targeting security-restricted tenant must be blocked from tenant data',
      request: {
        path: '/crm/customers',
        headers: {
          'Cookie': `session=${config.tokenUserA}; active_tenant_id=${config.tenants.securityRestricted}`
        }
      },
      assert: (res) => {
        // Next.js streaming redirects render NEXT_REDIRECT;replace;/select-tenant;307 in body or HTTP 307 Location
        const isHttpRedirect = res.statusCode === 307 || res.statusCode === 302 || res.statusCode === 308;
        const location = res.headers['location'] || '';
        const isStreamingRedirect = res.body.includes('NEXT_REDIRECT') && res.body.includes('/select-tenant');
        const blocked = (isHttpRedirect && location.includes('/select-tenant')) || isStreamingRedirect || res.statusCode === 403;
        return {
          pass: blocked,
          details: `Status: ${res.statusCode}, HttpLocation: ${location || 'none'}, StreamingRedirect: ${isStreamingRedirect}`
        };
      }
    },
    {
      id: 'TC-10.4',
      name: 'User A on Billing-Restricted Tenant',
      description: 'Valid authenticated session targeting billing-restricted tenant must be blocked from tenant operations',
      request: {
        path: '/crm/customers',
        headers: {
          'Cookie': `session=${config.tokenUserA}; active_tenant_id=${config.tenants.billingRestricted}`
        }
      },
      assert: (res) => {
        const isHttpRedirect = res.statusCode === 307 || res.statusCode === 302 || res.statusCode === 308;
        const location = res.headers['location'] || '';
        const isStreamingRedirect = res.body.includes('NEXT_REDIRECT') && res.body.includes('/select-tenant');
        const blocked = (isHttpRedirect && location.includes('/select-tenant')) || isStreamingRedirect || res.statusCode === 403;
        return {
          pass: blocked,
          details: `Status: ${res.statusCode}, HttpLocation: ${location || 'none'}, StreamingRedirect: ${isStreamingRedirect}`
        };
      }
    },
    {
      id: 'TC-10.5',
      name: 'Cross-Tenant Access: User B on Security Tenant',
      description: 'User B (not a member of Security Tenant) targeting Security Tenant cookie must be rejected',
      request: {
        path: '/crm/customers',
        headers: {
          'Cookie': `session=${config.tokenUserB}; active_tenant_id=${config.tenants.securityRestricted}`
        }
      },
      assert: (res) => {
        const isHttpRedirect = res.statusCode === 307 || res.statusCode === 302 || res.statusCode === 308;
        const location = res.headers['location'] || '';
        const isStreamingRedirect = res.body.includes('NEXT_REDIRECT') && (res.body.includes('/select-tenant') || res.body.includes('/login'));
        const rejected = (isHttpRedirect && (location.includes('/select-tenant') || location.includes('/login'))) || isStreamingRedirect || res.statusCode === 403;
        return {
          pass: rejected,
          details: `Status: ${res.statusCode}, HttpLocation: ${location || 'none'}, StreamingRedirect: ${isStreamingRedirect}`
        };
      }
    },
    {
      id: 'TC-10.6',
      name: 'Platform Admin accessing /platform-admin',
      description: 'Platform Admin with platform email can access platform-wide operational interface (HTTP 200)',
      request: {
        path: '/platform-admin',
        headers: {
          'Cookie': `session=${config.tokenAdmin}`
        }
      },
      assert: (res) => {
        const isOk = res.statusCode === 200;
        const notRedirectedToLogin = !res.headers['location'];
        return {
          pass: isOk && notRedirectedToLogin,
          details: `Status: ${res.statusCode}, Location: ${res.headers['location'] || 'none'}, Body Length: ${res.body.length}`
        };
      }
    },
    {
      id: 'TC-10.7',
      name: 'Standard User A attempting /platform-admin',
      description: 'Non-admin user accessing /platform-admin must receive Access Restricted or be redirected',
      request: {
        path: '/platform-admin',
        headers: {
          'Cookie': `session=${config.tokenUserA}`
        }
      },
      assert: (res) => {
        const isRedirect = res.statusCode === 307 || res.statusCode === 302 || res.statusCode === 308;
        const isForbidden = res.statusCode === 403;
        const hasRestrictedUi = res.statusCode === 200 && (res.body.includes('Access Restricted') || res.body.includes('Access denied') || res.body.includes('unauthorized'));
        const pass = isRedirect || isForbidden || hasRestrictedUi;
        return {
          pass,
          details: `Status: ${res.statusCode}, Location: ${res.headers['location'] || 'none'}, Body snippet: ${res.body.slice(0, 100).replace(/\s+/g, ' ')}`
        };
      }
    }
  ];

  for (const tc of testCases) {
    try {
      const res = await makeRequest(tc.request);
      const assertion = tc.assert(res);
      const record = {
        id: tc.id,
        name: tc.name,
        pass: assertion.pass,
        statusCode: res.statusCode,
        location: res.headers['location'] || null,
        details: assertion.details
      };
      results.push(record);
      console.log(`[${record.pass ? 'PASS' : 'FAIL'}] ${tc.id}: ${tc.name} (${record.details})`);
    } catch (err) {
      console.error(`[ERROR] ${tc.id}: ${err.message}`);
      results.push({
        id: tc.id,
        name: tc.name,
        pass: false,
        error: err.message
      });
    }
  }

  const passedCount = results.filter(r => r.pass).length;
  console.log(`\nSTG-10 Complete: ${passedCount}/${results.length} PASSED`);
  fs.writeFileSync(path.join(__dirname, 'stg10-results.json'), JSON.stringify(results, null, 2));
}

runTests().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
