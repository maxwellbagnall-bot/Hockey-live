"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ResetPasswordApp() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setReady(Boolean(data.session));
      if (!data.session) {
        setMessage(
          "Open the password reset link from your email on this device to continue."
        );
      }
    }

    void checkSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setMessage("");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Use at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setMessage("The passwords do not match.");
      return;
    }

    setBusy(true);

    const { error } = await supabase.auth.updateUser({ password });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Password updated. Taking you back to Hockey Live…");
    window.setTimeout(() => {
      window.location.replace("/live");
    }, 900);
  }

  return (
    <main className="onboardingShell">
      <header className="onboardingHeader">
        <a className="brand" href="/">
          <span className="brandMark">HL</span>
          <span>Hockey Live</span>
        </a>
      </header>

      <section className="onboardingStage">
        <div className="onboardingCard">
          <p className="eyebrow">PASSWORD RESET</p>
          <h2>Choose a new password</h2>
          <p className="onboardingCardCopy">
            This password will be used with your email whenever you log in.
          </p>

          <form className="onboardingForm" onSubmit={savePassword}>
            <label>
              New password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                disabled={!ready}
                required
              />
            </label>

            <label>
              Confirm password
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                disabled={!ready}
                required
              />
            </label>

            {message && <div className="onboardingMessage">{message}</div>}

            <button
              className="primaryButton onboardingSubmit"
              disabled={!ready || busy}
            >
              {busy ? "Saving…" : "Set password"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
