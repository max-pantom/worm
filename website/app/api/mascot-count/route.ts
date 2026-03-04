import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const KEY = "wormkey:mascot:generated";

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ count: 0 });
  }
  try {
    const count = await redis.get<number>(KEY);
    return NextResponse.json({ count: typeof count === "number" ? count : 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

export async function POST() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ count: 0 });
  }
  try {
    const count = await redis.incr(KEY);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

