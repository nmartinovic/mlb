import { beforeAll, describe, expect, it, vi } from "vitest";
import { createStagingClient } from "@/lib/supabase-admin";

// Automated end-to-end dry-run against a real STAGING Supabase project (#180).
//
// Unlike lib/cron-jobs.integration.test.js (deterministic, fully mocked at the
// network boundary), this suite runs runMainCron against:
//   * a real staging Supabase project — real PostgREST queries, real
//     RLS-bypass via the service role, real mlb_game_cache upserts; and
//   * the live MLB Stats API.
// Only the Brevo send is stubbed — and stubbed to THROW, so a regression that
// tried to send during a dry run fails loudly instead of mailing anyone.
//
// It is a live smoke test. Report contents depend on MLB's actual slate, so it
// asserts the pipeline completes end-to-end and finalizes with the dry_run
// status — not a specific set of emails. That catches the class of bug only a
// real database surfaces: query-shape errors, client misconfiguration,
// PostgREST incompatibilities — which module-level mocks cannot.
//
// It is EXCLUDED from the default `npm test` / predeploy gate (see the
// `exclude` glob in vitest.config.mjs) and runs only via `npm run test:staging`
// (vitest.staging.config.mjs), so live MLB API flakiness can never block a
// deploy. When the SUPABASE_STAGING_* env vars are unset the suite skips
// cleanly — green on forks and before staging is provisioned.

const stagingConfigured =
  !!process.env.SUPABASE_STAGING_URL &&
  !!process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY;

// Stub Brevo to throw — a dry run must never reach it. Defined before vi.mock
// so the hoisted factory closes over an initialized reference.
const sendEmail = vi.fn(() => {
  throw new Error("staging dry run attempted a real Brevo send");
});
vi.mock("@/lib/brevo", () => ({
  sendEmail: (...args) => sendEmail(...args),
}));

describe.skipIf(!stagingConfigured)(
  "runMainCron — automated dry run against staging Supabase (#180)",
  () => {
    let runMainCron;
    let staging;

    beforeAll(async () => {
      ({ runMainCron } = await import("@/lib/cron-jobs"));
      staging = createStagingClient();
    });

    it(
      "runs the full pipeline end-to-end and finalizes with dry_run",
      async () => {
        const result = await runMainCron({
          supabase: staging,
          force: true,
          dryRun: true,
        });

        // The pipeline completed without throwing.
        expect(result.status).toBe(200);
        // No Brevo call was even attempted.
        expect(sendEmail).not.toHaveBeenCalled();
        // dryRun always returns a report array (possibly empty in the offseason
        // or on a day with no completed games for the fixture teams).
        expect(Array.isArray(result.body.dryRunReport)).toBe(true);

        // Every report entry carries the fields the /admin view and the
        // operator depend on.
        for (const entry of result.body.dryRunReport) {
          expect(entry).toMatchObject({
            gamePk: expect.any(Number),
            teamId: expect.any(Number),
            email: expect.any(String),
            subject: expect.any(String),
          });
        }

        // The run wrote a dry_run row to the staging health log.
        const { data: latestRun, error } = await staging
          .from("mlb_cron_runs")
          .select("status")
          .order("started_at", { ascending: false })
          .limit(1)
          .single();
        expect(error).toBeNull();
        expect(latestRun.status).toBe("dry_run");
      },
      180000
    );
  }
);

// Visibility net: if someone runs `npm run test:staging` without configuring
// the project, surface why nothing meaningful ran instead of a silent green.
describe.runIf(!stagingConfigured)("staging dry run (not configured)", () => {
  it("skips because SUPABASE_STAGING_* env vars are unset", () => {
    expect(stagingConfigured).toBe(false);
  });
});
