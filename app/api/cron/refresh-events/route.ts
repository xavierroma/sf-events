import { NextResponse } from "next/server"
import { start } from "workflow/api"

import type { RefreshTrigger } from "@/lib/events"
import { appConfig } from "@/lib/env"
import { refreshEventsWorkflow } from "@/workflows/refresh-events"

export const dynamic = "force-dynamic"

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")

  if (!authorization) {
    return null
  }

  const [scheme, token] = authorization.split(" ")
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null
  }

  return token
}

export async function GET(request: Request) {
  if (!appConfig.cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 })
  }

  const providedToken = getBearerToken(request)
  if (!providedToken) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 })
  }

  if (providedToken !== appConfig.cronSecret) {
    return NextResponse.json({ error: "Invalid bearer token" }, { status: 403 })
  }

  const url = new URL(request.url)
  const reasonParam = url.searchParams.get("reason")
  const reason: RefreshTrigger["reason"] = reasonParam === "bootstrap" ? "bootstrap" : "cron"

  const trigger: RefreshTrigger = {
    reason,
    requestedAt: new Date().toISOString(),
  }

  const run = await start(refreshEventsWorkflow, [trigger])

  return NextResponse.json(
    {
      queued: true,
      runId: run.runId,
      reason,
    },
    { status: 202 },
  )
}
