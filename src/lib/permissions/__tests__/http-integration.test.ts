import test from "node:test";
import assert from "node:assert";

// Polyfill WebSocket for node runtime with @supabase/supabase-js
// @ts-ignore
global.WebSocket = class {};

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ovnzqhlamphfkqegvekb.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92bnpxaGxhbXBoZmtxZWd2ZWtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTkxNTU2MCwiZXhwIjoyMTA3NDkxNTYwfQ.oErO_Sx5d0JimpxP7bevLdMoO_BYvhuNg76Y28QEt6M";

const TEST_WORKSPACE_ID = "22e93fd7-e046-48a1-89f5-0ea89f9c278f";

test("Real HTTP Integration: Seeded Roles in TEST Supabase Project", async () => {
  const url = `${SUPABASE_URL}/rest/v1/roles?workspaceId=eq.${TEST_WORKSPACE_ID}&select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });

  assert.strictEqual(res.status, 200, "Should return 200 from Supabase roles endpoint");
  const roles = await res.json();
  assert.ok(Array.isArray(roles), "Roles should be an array");
  assert.ok(roles.length >= 4, "Should have seeded roles in workspace");

  const roleNames = roles.map((r: { name: string }) => r.name);
  assert.ok(roleNames.includes("Owner"), "Should contain seeded Owner role");
  assert.ok(roleNames.includes("Admin"), "Should contain seeded Admin role");
  assert.ok(roleNames.includes("Project Manager"), "Should contain seeded Project Manager role");
  assert.ok(roleNames.includes("Member"), "Should contain seeded Member role");
});

test("Real HTTP Integration: 003 has_permission signature and RPC availability", async () => {
  // Test calling /rpc/has_permission via HTTP POST
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_permission`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_workspace_id: TEST_WORKSPACE_ID,
      p_perm_key: "workspace:delete",
    }),
  });

  assert.strictEqual(res.status, 200, "RPC /rpc/has_permission should be callable and return 200");
  const result = await res.json();
  // Without authenticated auth.uid(), has_permission returns false (deny by default)
  assert.strictEqual(result, false, "Unauthenticated RPC caller returns false by default");
});

test("Real HTTP Integration: 003 Policy Tables (roles, teams, project_members, permission_audit)", async () => {
  const tables = ["roles", "teams", "project_members", "permission_audit"];

  for (const table of tables) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });

    assert.strictEqual(
      res.status,
      200,
      `Table '${table}' must be accessible and respond with 200 via HTTP`
    );
  }
});

test("Real HTTP Integration: Seeded Members and Role IDs", async () => {
  const url = `${SUPABASE_URL}/rest/v1/members?workspaceId=eq.${TEST_WORKSPACE_ID}&select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });

  assert.strictEqual(res.status, 200, "Should return 200 from Supabase members endpoint");
  const members = await res.json();
  assert.ok(Array.isArray(members) && members.length > 0, "Should have seeded members in test workspace");

  // Verify that members have roleId column
  for (const m of members) {
    assert.ok("roleId" in m, "Member record must contain roleId column");
    assert.ok("userId" in m, "Member record must contain userId column");
    assert.ok("workspaceId" in m, "Member record must contain workspaceId column");
  }
});
