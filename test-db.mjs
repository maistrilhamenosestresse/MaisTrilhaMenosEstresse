const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase.from('notificacoes').select('mensagem').like('mensagem', 'CHECKOUT_MAPPING%').order('created_at', { ascending: false }).limit(5);
  console.log(data, error);
}
run();
