import type { NextRequest } from "next/server"

// Realtime-ish multiplayer for Slither using HTTP polling.
//
// Each player POSTs their snake state ~9x/sec and receives everyone else's.
// State lives in a shared store keyed by room:
//   • If a Vercel KV / Upstash Redis store is configured (env vars present),
//     it is used — this works across serverless instances in production.
//   • Otherwise we fall back to an in-memory map on globalThis. That only
//     works within a single process (fine for `next dev` across browser tabs),
//     so the game degrades gracefully to single-player + bots in production
//     until a KV store is connected.

export const dynamic = "force-dynamic"

const ROOM_PREFIX = "slither:room:"
const STALE_MS = 4000      // drop players we haven't heard from in this long
const ROOM_TTL_MS = 60000  // auto-expire the whole room key

interface PlayerEntry {
  id: string
  name?: string
  skin?: string
  score?: number
  pts?: number[]
  ts: number
}

// ── Redis (Vercel KV / Upstash) via REST ──────────────────────────────────────

function redisCreds(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

async function redisPipeline(
  creds: { url: string; token: string },
  commands: (string | number)[][],
): Promise<{ result?: unknown; error?: string }[]> {
  const res = await fetch(`${creds.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`redis ${res.status}`)
  return res.json()
}

// ── In-memory fallback ────────────────────────────────────────────────────────

type MemStore = Map<string, Map<string, PlayerEntry>>
function memStore(): MemStore {
  const g = globalThis as unknown as { __slitherMem?: MemStore }
  if (!g.__slitherMem) g.__slitherMem = new Map()
  return g.__slitherMem
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    room?: string
    leave?: boolean
    me?: PlayerEntry
  }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const room = typeof body.room === "string" ? body.room.slice(0, 40) : "global"
  const key = ROOM_PREFIX + room
  const me = body.me
  const leave = !!body.leave
  const now = Date.now()
  const creds = redisCreds()

  // ── Redis path ──
  if (creds) {
    try {
      if (leave) {
        if (me?.id) await redisPipeline(creds, [["HDEL", key, me.id]])
        return Response.json({ enabled: true, mode: "redis", players: [] })
      }

      const cmds: (string | number)[][] = []
      if (me?.id) {
        const stored = JSON.stringify({ ...me, ts: now } satisfies PlayerEntry)
        cmds.push(["HSET", key, me.id, stored])
        cmds.push(["PEXPIRE", key, ROOM_TTL_MS])
      }
      cmds.push(["HGETALL", key])

      const results = await redisPipeline(creds, cmds)
      const flat = (results[results.length - 1]?.result as string[]) || []

      const players: PlayerEntry[] = []
      const staleIds: string[] = []
      for (let i = 0; i < flat.length; i += 2) {
        const id = flat[i]
        if (me?.id && id === me.id) continue
        let p: PlayerEntry | null = null
        try {
          p = JSON.parse(flat[i + 1])
        } catch {
          continue
        }
        if (!p || typeof p.ts !== "number") continue
        if (now - p.ts > STALE_MS) {
          staleIds.push(id)
          continue
        }
        players.push(p)
      }
      if (staleIds.length) {
        redisPipeline(creds, [["HDEL", key, ...staleIds]]).catch(() => {})
      }
      return Response.json({ enabled: true, mode: "redis", players })
    } catch (e) {
      // Fall through to memory on transient Redis errors
      return Response.json({ enabled: false, mode: "error", players: [], error: String(e) })
    }
  }

  // ── In-memory fallback path ──
  const store = memStore()
  let room_ = store.get(key)
  if (!room_) {
    room_ = new Map()
    store.set(key, room_)
  }

  if (leave) {
    if (me?.id) room_.delete(me.id)
    return Response.json({ enabled: true, mode: "memory", players: [] })
  }

  if (me?.id) room_.set(me.id, { ...me, ts: now })

  const players: PlayerEntry[] = []
  for (const [id, p] of room_) {
    if (now - p.ts > STALE_MS) {
      room_.delete(id)
      continue
    }
    if (me?.id && id === me.id) continue
    players.push(p)
  }

  return Response.json({ enabled: true, mode: "memory", players })
}
