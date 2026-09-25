"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import HockeyLiveApp from "./HockeyLiveApp";

export default function LiveGate() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!data.session) {
        setAllowed(false);
        window.location.replace("/");
        return;
      }

      const { data: profile, error } = await supabase.rpc(
        "ensure_my_hockey_profile"
      );

      if (error) {
        setAllowed(false);
        window.location.replace("/");
        return;
      }

      const row = Array.isArray(profile) ? profile[0] : profile;

      if (!row?.completed_at) {
        setAllowed(false);
        window.location.replace("/");
        return;
      }

      localStorage.removeItem("hockey_live_access_token");
      localStorage.removeItem("hockey_live_onboarded");
      localStorage.removeItem("hockey_live_username");
      localStorage.removeItem("hockey_live_interests");

      setAllowed(true);
    }

    void checkAccess();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        window.location.replace("/");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (allowed !== true) {
    return (
      <main className="accessCheck">
        <div className="brand">
          <span className="brandMark">HL</span>
          <span>Hockey Live</span>
        </div>
        <p>Getting Hockey Live ready…</p>
      </main>
    );
  }

  return <HockeyLiveApp />;
}
