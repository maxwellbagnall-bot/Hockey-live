import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://zrpxgyxhvxazuekdechr.supabase.co";

const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_H1UNIkbIiBXRDtq51X5kww_Miby3ElJ";

export const supabase = createClient(url, publishableKey);
