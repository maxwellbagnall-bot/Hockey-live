"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import HockeyLiveApp from "./HockeyLiveApp";

export default function LiveGate() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      const onboarded = localStorage.getItem("hockey_live_onboarded") === "1";
      if (onboarded) {
        if (mounted) setAllowed(true);
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (data.user) {
        if (mounted) setAllowed(true);
        return;
      }

      if (mounted) {
        setAllowed(false);
        window.location.replace("/");
      }
    }

    void checkAccess();

    return () => {
      mounted = false;
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
