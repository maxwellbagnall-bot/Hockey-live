import { createClient } from "@supabase/supabase-js";

const fallbackUrl = "https://zrpxgyxhvxazuekdechr.supabase.co";
const fallbackKey = "sb_publishable_H1UNIkbIiBXRDtq51X5kww_Miby3ElJ";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || fallbackUrl;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || fallbackKey;

export const supabase = createClient(url, publishableKey);
