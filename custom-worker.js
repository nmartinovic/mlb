import { getRequestHandler } from "@opennextjs/cloudflare";

const handler = await getRequestHandler();

export default {
  async fetch(request, env, ctx) {
    return handler(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    const url = `${env.SITE_URL}/api/cron`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const body = await res.text();
    console.log(`Cron response (${res.status}): ${body}`);
  },
};
