import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jxciyjwcejvisrtfrtam.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4Y2l5andjZWp2aXNydGZydGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMjIwNTIsImV4cCI6MjEwODg5ODA1Mn0.A_ljnpf33cTBV8Iq1Ne-bhUyIlDBZGug7E8Sn0ERE8Q';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
