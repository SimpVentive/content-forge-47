// Exported courses never have access to the author's session or paid services.
export const supabase = {
  functions: { invoke: async () => ({ data: null, error: new Error("This action is only available in the course editor.") }) },
  auth: { getSession: async () => ({ data: { session: null }, error: null }) },
};