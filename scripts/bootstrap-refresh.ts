async function main() {
  const baseUrlInput =
    process.env.BOOTSTRAP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL

  const cronSecret = process.env.CRON_SECRET

  if (!baseUrlInput) {
    throw new Error("Set BOOTSTRAP_BASE_URL (or NEXT_PUBLIC_APP_URL / VERCEL_URL) before running bootstrap:refresh")
  }

  if (!cronSecret) {
    throw new Error("CRON_SECRET is required to trigger bootstrap refresh")
  }

  const baseUrl = baseUrlInput.startsWith("http") ? baseUrlInput : `https://${baseUrlInput}`
  const url = new URL("/api/cron/refresh-events", baseUrl)
  url.searchParams.set("reason", "bootstrap")

  const response = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${cronSecret}`,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Bootstrap refresh failed (${response.status}): ${body}`)
  }

  const payload = (await response.json()) as { runId?: string }
  console.log(`Bootstrap refresh queued${payload.runId ? ` (run ${payload.runId})` : ""}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
