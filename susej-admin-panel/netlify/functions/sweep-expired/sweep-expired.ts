export default async () => {
  const url = process.env.SITE_URL ?? "https://susej-adminpanel.netlify.app";
  const key = process.env.APP_API_KEY ?? "";
  try {
    await fetch(`${url}/api/v1/cron/sweep`, {
      method: "POST",
      headers: { "x-app-key": key },
    });
  } catch {
    // sweep also runs lazily on reads - this is best-effort
  }
  return { statusCode: 200 };
};