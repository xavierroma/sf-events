import { waitUntil } from "@vercel/functions"
import { NextResponse } from "next/server"

import type { RefreshTrigger } from "@/lib/events"
import { appConfig } from "@/lib/env"
import { enrichMissingDetails, runRefresh } from "@/server/events/refresh"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")
  if (!authorization) return null
  const [scheme, token] = authorization.split(" ")
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null
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

  const result = await runRefresh({ reason, requestedAt: new Date().toISOString() })

  waitUntil(enrichMissingDetails().catch(() => { }))

  return NextResponse.json(result)
}
