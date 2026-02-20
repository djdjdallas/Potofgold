// Supabase Edge Function: daily-pipeline
// Schedule: "0 7 * * *" (daily at 7am UTC)
//
// This function runs the full TrendForge pipeline:
// 1. Fetches viral posts from X via Apify Tweet Scraper
// 2. Analyzes new posts with Claude AI
// 3. Picks top 5 ideas by earliness score
// 4. Sends digest email via Resend

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "TrendForge <digest@trendforge.dev>";
const DIGEST_RECIPIENT_EMAIL = Deno.env.get("DIGEST_RECIPIENT_EMAIL") || "founder@example.com";
const ACTOR_ID = "apidojo/tweet-scraper";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Apify Tweet Fetcher ---

async function fetchPostsByBucket(bucket) {
  const queries = bucket.keywords.map((keyword) => {
    return `${keyword} min_faves:${bucket.min_likes} lang:en -is:retweet`;
  });

  const input = {
    searchTerms: queries,
    sort: "Latest",
    maxItems: 100,
    onlyVerifiedUsers: false,
    tweetLanguage: "en",
  };

  // Start the Apify actor run
  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    }
  );

  const run = await runResponse.json();
  const runId = run.data.id;

  // Poll until completion
  let status = "RUNNING";
  let attempts = 0;
  while (status === "RUNNING" && attempts < 30) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
    );
    const statusData = await statusRes.json();
    status = statusData.data.status;
    attempts++;
  }

  if (status !== "SUCCEEDED") {
    throw new Error(`Apify run failed with status: ${status}`);
  }

  // Fetch results
  const datasetRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}&clean=true`
  );
  const tweets = await datasetRes.json();

  const mappedPosts = tweets.map((tweet) => ({
    x_post_id: tweet.id,
    content: tweet.text,
    author_handle: tweet.author?.userName,
    likes: tweet.likeCount || 0,
    reposts: tweet.retweetCount || 0,
    views: tweet.viewCount || 0,
    posted_at: new Date(tweet.createdAt).toISOString(),
    bucket_id: bucket.id,
    fetched_at: new Date().toISOString(),
  }));

  const { data } = await supabase
    .from("raw_posts")
    .upsert(mappedPosts, { onConflict: "x_post_id", ignoreDuplicates: true })
    .select();

  return data?.length || 0;
}

// --- Claude Analyzer ---

const SYSTEM_PROMPT = `You are an opportunity intelligence analyst for indie hackers and solo founders.
Analyze viral posts from X about people building products, shipping demos, or experimenting with new tech.
Extract the real business opportunity. Be brutally honest about earliness. Prioritize ideas a solo dev could validate in 2 weeks.
Earliness: 10=nobody built this, 8-9=1-2 exploring, 6-7=few exist no leader, 4-5=established players, 1-3=saturated.
Difficulty: 1=weekend, 2=3-5 days, 3=1-2 weeks, 4=3-4 weeks, 5=months.
Focus on ADJACENT opportunities, not copycats.`;

async function analyzePost(post) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Analyze this viral X post. Author: ${post.author_handle}, Likes: ${post.likes}, Reposts: ${post.reposts}, Views: ${post.views}. Content: ${post.content}

Return ONLY valid JSON: {"capability_used":"...","emotional_hook":"...","adjacent_opportunities":["...","...","..."],"build_difficulty":3,"earliness_score":7,"earliness_reasoning":"...","recommended_mvp":"...","skip":false,"skip_reason":null}`
      }],
    }),
  });

  const result = await response.json();
  const analysis = JSON.parse(result.content[0].text.trim());

  if (analysis.skip) return null;

  const { data, error } = await supabase
    .from("analyzed_ideas")
    .insert({
      raw_post_id: post.id,
      capability_used: analysis.capability_used,
      emotional_hook: analysis.emotional_hook,
      adjacent_opportunities: analysis.adjacent_opportunities,
      build_difficulty: analysis.build_difficulty,
      earliness_score: analysis.earliness_score,
      earliness_reasoning: analysis.earliness_reasoning,
      recommended_mvp: analysis.recommended_mvp,
      analyzed_at: new Date().toISOString(),
      included_in_digest: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// --- Email Builder ---

function buildDigestHtml(ideas, dateStr) {
  const difficultyLabels = { 1: "Weekend", 2: "3-5 days", 3: "1-2 weeks", 4: "3-4 weeks", 5: "Major" };

  const cards = ideas.map((idea, i) => `
    <div style="background:#18181b;border-radius:8px;border:1px solid #27272a;padding:20px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="color:#a1a1aa;font-size:13px;">#${i + 1} · @${idea.author_handle}</span>
        <div>
          <span style="background:${idea.earliness_score >= 8 ? '#10b981' : idea.earliness_score >= 6 ? '#fbbf24' : '#ef4444'};color:#000;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;">Earliness: ${idea.earliness_score}/10</span>
          <span style="background:#3b82f6;color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;margin-left:6px;">${difficultyLabels[idea.build_difficulty]}</span>
        </div>
      </div>
      <p style="color:#d4d4d8;font-size:14px;line-height:1.5;padding:12px;background:#0f0f12;border-radius:6px;border-left:3px solid #3f3f46;">${(idea.content || '').slice(0, 200)}${(idea.content || '').length > 200 ? '...' : ''}</p>
      <p style="color:#a1a1aa;font-size:13px;"><strong style="color:#e4e4e7;">Capability:</strong> ${idea.capability_used}</p>
      <p style="color:#a1a1aa;font-size:13px;"><strong style="color:#e4e4e7;">Why viral:</strong> ${idea.emotional_hook}</p>
      <div style="background:#1a1a2e;border-radius:6px;padding:14px;border:1px solid #27272a;margin-top:12px;">
        <p style="color:#818cf8;font-size:12px;font-weight:700;margin:0 0 6px;text-transform:uppercase;">Recommended MVP</p>
        <p style="color:#e4e4e7;font-size:14px;line-height:1.5;margin:0;">${idea.recommended_mvp}</p>
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html><html><body style="margin:0;padding:40px 20px;background:#09090b;font-family:-apple-system,sans-serif;">
    <div style="max-width:600px;margin:0 auto;">
      <h1 style="color:#fafafa;font-size:24px;">TrendForge</h1>
      <p style="color:#71717a;font-size:14px;">${dateStr} · ${ideas.length} opportunities ranked by earliness</p>
      ${cards}
      <p style="color:#52525b;font-size:12px;text-align:center;margin-top:24px;border-top:1px solid #27272a;padding-top:24px;">TrendForge — AI-powered opportunity intelligence for indie hackers</p>
    </div>
  </body></html>`;
}

// --- Main Handler ---

Deno.serve(async (req) => {
  try {
    console.log("TrendForge daily pipeline starting...");

    // 1. Fetch active buckets
    const { data: buckets } = await supabase
      .from("keyword_buckets")
      .select("*")
      .eq("active", true);

    if (!buckets?.length) {
      return new Response(JSON.stringify({ message: "No active buckets" }), { status: 200 });
    }

    // 2. Fetch posts for each bucket
    let totalPosts = 0;
    for (const bucket of buckets) {
      try {
        const count = await fetchPostsByBucket(bucket);
        totalPosts += count;
        console.log(`Bucket "${bucket.name}": ${count} new posts`);
      } catch (err) {
        console.error(`Bucket "${bucket.name}" error:`, err.message);
      }
    }

    // 3. Get unanalyzed posts
    const { data: analyzedIds } = await supabase.from("analyzed_ideas").select("raw_post_id");
    const analyzedSet = new Set((analyzedIds || []).map((r) => r.raw_post_id));

    const { data: allPosts } = await supabase
      .from("raw_posts")
      .select("*")
      .order("fetched_at", { ascending: false })
      .limit(50);

    const unanalyzed = (allPosts || []).filter((p) => !analyzedSet.has(p.id));

    // 4. Analyze new posts
    let ideasAnalyzed = 0;
    for (const post of unanalyzed) {
      try {
        const idea = await analyzePost(post);
        if (idea) ideasAnalyzed++;
      } catch (err) {
        console.error(`Analyze error for ${post.x_post_id}:`, err.message);
      }
    }

    // 5. Build and send digest email
    const { data: topIdeas } = await supabase
      .from("analyzed_ideas")
      .select("*, raw_posts(content, author_handle)")
      .eq("included_in_digest", false)
      .order("earliness_score", { ascending: false })
      .limit(5);

    let emailSent = false;

    if (topIdeas?.length > 0) {
      const emailIdeas = topIdeas.map((idea) => ({
        ...idea,
        content: idea.raw_posts?.content || "",
        author_handle: idea.raw_posts?.author_handle || "unknown",
      }));

      const dateStr = new Date().toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      });

      const subject = `TrendForge: ${dateStr} — ${emailIdeas.length} opportunities spotted`;
      const html = buildDigestHtml(emailIdeas, dateStr);

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: DIGEST_RECIPIENT_EMAIL,
          subject,
          html,
        }),
      });

      if (emailRes.ok) {
        emailSent = true;
        const ids = topIdeas.map((i) => i.id);
        await supabase.from("analyzed_ideas").update({ included_in_digest: true }).in("id", ids);
        console.log(`Digest sent with ${topIdeas.length} ideas`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, postsFound: totalPosts, ideasAnalyzed, emailSent }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Pipeline error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
