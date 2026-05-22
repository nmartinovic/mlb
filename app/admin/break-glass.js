"use client";

import { useActionState } from "react";
import {
  runSchedulerAction,
  runMainCronAction,
  forceRunMainCronAction,
  dryRunMainCronAction,
  resendLatestRecapAction,
} from "./actions";

const INITIAL = { ok: null, message: null, errors: null, ranAt: null };
const DRY_RUN_INITIAL = { ...INITIAL, dryRunReport: null };

export default function BreakGlass() {
  return (
    <div className="mb-8 rounded-lg border border-gray-800 bg-gray-900/40 p-4">
      <h2 className="mb-1 text-sm font-medium text-gray-200">Break-glass</h2>
      <p className="mb-3 text-xs text-gray-500">
        Manual cron triggers — bypass the bearer-token path. Auth is the same
        admin session check used to render this page.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <BreakGlassButton
          label="Run daily scheduler now"
          action={runSchedulerAction}
        />
        <BreakGlassButton
          label="Run main cron now"
          action={runMainCronAction}
        />
        <BreakGlassButton
          label="Force run main cron (catch up missed)"
          action={forceRunMainCronAction}
        />
        <BreakGlassButton
          label="Resend latest recap to me"
          action={resendLatestRecapAction}
        />
      </div>
      <DryRunButton />
    </div>
  );
}

function BreakGlassButton({ label, action }) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-100 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Running…" : label}
      </button>
      {state.ranAt && (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            state.ok
              ? "border-green-900/60 bg-green-950/20 text-green-300"
              : "border-red-900/60 bg-red-950/20 text-red-300"
          }`}
        >
          <div className="font-mono">{state.message}</div>
          {state.errors?.length > 0 && (
            <ul className="mt-1 space-y-0.5 font-mono">
              {state.errors.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}

// Dry run is its own full-width row (#180): it renders a report of would-be
// emails that needs more horizontal room than the 2-column button grid gives.
function DryRunButton() {
  const [state, formAction, isPending] = useActionState(
    dryRunMainCronAction,
    DRY_RUN_INITIAL
  );

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-indigo-800 bg-indigo-950/40 px-3 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-900/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending
          ? "Running dry run…"
          : "Dry run main cron (no emails sent)"}
      </button>
      {state.ranAt && (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            state.ok
              ? "border-indigo-900/60 bg-indigo-950/20 text-indigo-200"
              : "border-red-900/60 bg-red-950/20 text-red-300"
          }`}
        >
          <div className="font-mono">{state.message}</div>
          {state.errors?.length > 0 && (
            <ul className="mt-1 space-y-0.5 font-mono">
              {state.errors.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          )}
          {state.dryRunReport && (
            <DryRunReport report={state.dryRunReport} />
          )}
        </div>
      )}
    </form>
  );
}

function DryRunReport({ report }) {
  if (report.length === 0) {
    return (
      <p className="mt-2 text-gray-400">
        No emails would be sent (no new highlights for any subscriber).
      </p>
    );
  }

  const gameCount = new Set(report.map((r) => r.gamePk)).size;
  // The report keeps one row per game; emails are batched per recipient (#27),
  // so the email count is the number of distinct recipients, not report.length.
  const emailCount = new Set(report.map((r) => r.userId)).size;

  return (
    <div className="mt-3">
      <p className="mb-2 text-gray-300">
        {emailCount} email{emailCount === 1 ? "" : "s"} would be sent across{" "}
        {gameCount} game{gameCount === 1 ? "" : "s"}.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono">
          <thead className="text-gray-500">
            <tr>
              <th className="py-1 pr-3 font-medium">Game</th>
              <th className="py-1 pr-3 font-medium">Team</th>
              <th className="py-1 pr-3 font-medium">Recipient</th>
              <th className="py-1 pr-3 font-medium">Subject</th>
              <th className="py-1 font-medium">Highlight</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {report.map((r, i) => (
              <tr key={i} className="border-t border-gray-800">
                <td className="py-1 pr-3 tabular-nums">{r.gamePk}</td>
                <td className="py-1 pr-3">{r.teamName}</td>
                <td className="py-1 pr-3">{r.email}</td>
                <td className="py-1 pr-3">{r.subject}</td>
                <td className="py-1">
                  {r.highlightUrl ? (
                    <a
                      href={r.highlightUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-300 underline"
                    >
                      link
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
