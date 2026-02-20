import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);

  const minEarliness = parseInt(searchParams.get("minEarliness") || "0");
  const bucketId = searchParams.get("bucketId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  let query = supabase
    .from("analyzed_ideas")
    .select("*, raw_posts(x_post_id, content, author_handle, likes, reposts, views, posted_at, bucket_id)", { count: "exact" })
    .order("earliness_score", { ascending: false })
    .order("analyzed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (minEarliness > 0) {
    query = query.gte("earliness_score", minEarliness);
  }

  if (bucketId) {
    query = query.eq("raw_posts.bucket_id", bucketId);
  }

  if (dateFrom) {
    query = query.gte("analyzed_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("analyzed_at", dateTo);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ideas: data, total: count });
}
