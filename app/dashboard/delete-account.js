"use client";

import { useState } from "react";

export default function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const canDelete = confirmText === "DELETE" && !deleting;

  function cancel() {
    setOpen(false);
    setConfirmText("");
    setError(null);
  }

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Deletion failed. Please try again.");
      }
      // Full navigation, not router.push: drops any cached client state and
      // forces a fresh request now that the session cookie has been cleared.
      window.location.href = "/";
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-sm font-medium text-[#c87d7b] underline-offset-4 transition hover:text-[#e09b99] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b8312f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1311]"
      >
        Delete account
      </button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby="delete-account-heading"
      className="mt-4 rounded-2xl border border-[#5c2b2a] bg-[#2a1413]/60 p-5"
    >
      <h3
        id="delete-account-heading"
        className="text-sm font-semibold text-[#f7f5ef]"
      >
        Permanently delete your account?
      </h3>
      <p className="mt-2 text-sm text-[#c4a9a8]">
        This removes your account, every team you follow, and your recap
        history. It cannot be undone. You&apos;ll get one final email
        confirming the deletion.
      </p>

      <label
        htmlFor="delete-confirm"
        className="mt-4 block text-xs font-medium text-[#c4a9a8]"
      >
        Type <span className="font-bold text-[#f7f5ef]">DELETE</span> to confirm
      </label>
      <input
        id="delete-confirm"
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        autoComplete="off"
        disabled={deleting}
        className="mt-1.5 w-full max-w-[220px] rounded-lg border border-[#5c2b2a] bg-[#0f1311] px-3 py-2 text-sm text-[#f7f5ef] focus:border-[#b8312f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b8312f]"
      />

      {error && (
        <p role="alert" className="mt-3 text-sm text-[#e09b99]">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={!canDelete}
          className="inline-flex items-center justify-center rounded-lg bg-[#b8312f] px-4 py-2 text-sm font-semibold text-[#f7f5ef] transition hover:bg-[#cf3a37] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e09b99] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1311] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {deleting ? "Deleting…" : "Permanently delete"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={deleting}
          className="text-sm font-medium text-[#a8a299] transition hover:text-[#f7f5ef] disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
