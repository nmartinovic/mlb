"use client";

import { useActionState } from "react";
import { runSchedulerAction, runMainCronAction } from "./actions";

const INITIAL = { ok: null, message: null, errors: null, ranAt: null };

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
      </div>
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
