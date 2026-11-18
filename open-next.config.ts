import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Pages are rendered per request (Supabase data), so no incremental cache is set up yet.
// If static/ISR pages are added later, connect an R2 incremental cache here.
export default defineCloudflareConfig();
