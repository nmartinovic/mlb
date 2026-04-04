export default {
  async scheduled(event, env, ctx) {
    const url = `${env.APP_URL}/api/cron`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const body = await res.text();
    console.log(`Cron response (${res.status}): ${body}`);
  },
};
