export const VITE_SUPABASE_URL =
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL
    ? import.meta.env.VITE_SUPABASE_URL
    : process.env.VITE_SUPABASE_URL;
export const VITE_SUPABASE_ANON_KEY =
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? import.meta.env.VITE_SUPABASE_ANON_KEY
    : process.env.VITE_SUPABASE_ANON_KEY;

export const backendUrl = import.meta.env?.VITE_BACKEND_URL || process.env.VITE_BACKEND_URL || "http://localhost:3000";