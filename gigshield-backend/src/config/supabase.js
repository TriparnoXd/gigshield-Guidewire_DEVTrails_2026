const { createClient } = require('@supabase/supabase-js');

// Use service role key on backend — bypasses RLS for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = supabase;
