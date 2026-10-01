// Test script: verify RLS policies are correctly restricting profile access
// Run with: node scripts/test-rls.js
// Requires: USER_A_EMAIL, USER_A_PASSWORD env vars for a test account
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function run() {
  // Sign in as user A
  const { data: { user }, error: signInErr } = await supabase.auth.signInWithPassword({
    email: process.env.USER_A_EMAIL,
    password: process.env.USER_A_PASSWORD,
  });
  if (signInErr) { console.error('FAIL: could not sign in:', signInErr.message); process.exit(1); }
  console.log('Signed in as', user.id);

  // Test 1: direct profiles read for OTHER users should return 0 rows
  const { data: otherProfiles } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', user.id);
  const test1 = (otherProfiles?.length ?? 0) === 0;
  console.log(test1 ? 'PASS' : 'FAIL', 'profiles SELECT for other users returns 0 rows (got', otherProfiles?.length ?? 'error', ')');

  // Test 2: public_profiles should return rows
  const { data: publicProfiles } = await supabase
    .from('public_profiles')
    .select('*')
    .neq('id', user.id)
    .limit(5);
  const test2 = (publicProfiles?.length ?? 0) > 0;
  console.log(test2 ? 'PASS' : 'FAIL', 'public_profiles returns rows for other users (got', publicProfiles?.length ?? 'error', ')');

  // Test 3: public_profiles must not expose sensitive fields
  const sensitiveFields = ['phone_verified_at', 'verified_at', 'gender', 'buddy_system', 'safety_checkins', 'privacy_settings', 'role'];
  const exposed = sensitiveFields.filter(f => publicProfiles?.[0]?.[f] !== undefined);
  const test3 = exposed.length === 0;
  console.log(test3 ? 'PASS' : 'FAIL', 'public_profiles does not expose sensitive fields', exposed.length ? `(exposed: ${exposed.join(', ')})` : '');

  process.exit(test1 && test2 && test3 ? 0 : 1);
}

run().catch(e => { console.error('FAIL:', e); process.exit(1); });
