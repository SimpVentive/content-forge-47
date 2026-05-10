// Single shared Supabase client. Re-exports the existing instance from
// `@/integrations/supabase/client` so we never create two clients (which
// would split auth state).
export { supabase } from "@/integrations/supabase/client";
export type { Database } from "@/integrations/supabase/types";
