import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("keyword_buckets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ buckets: data });
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();
  const body = await request.json();

  const { name, keywords, min_likes, active } = body;

  if (!name || !keywords || !Array.isArray(keywords)) {
    return NextResponse.json(
      { error: "name and keywords (array) are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("keyword_buckets")
    .insert({
      name,
      keywords,
      min_likes: min_likes || 500,
      active: active !== false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bucket: data }, { status: 201 });
}

export async function PUT(request) {
  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("keyword_buckets")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bucket: data });
}

export async function DELETE(request) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("keyword_buckets")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
