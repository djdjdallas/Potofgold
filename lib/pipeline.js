import { getSupabaseAdmin } from "./supabase";
import { fetchPostsByBucket } from "./xFetcher";
import { analyzePost } from "./analyzer";
import { buildDigestEmail } from "./emailTemplate";

/**
 * Run the full TrendForge pipeline:
 * 1. Fetch posts for all active keyword buckets
 * 2. Analyze new posts with Claude
 * 3. Pick top 5 by earliness score
 * 4. Send digest email via Resend
 *
 * @param {{ sendEmail?: boolean }} options
 * @returns {{ postsFound: number, ideasAnalyzed: number, emailSent: boolean }}
 */
export async function runPipeline({ sendEmail = true } = {}) {
  const supabase = getSupabaseAdmin();

  // Step 1: Fetch all active keyword buckets
  const { data: buckets, error: bucketsError } = await supabase
    .from("keyword_buckets")
    .select("*")
    .eq("active", true);

  if (bucketsError) throw new Error(`Failed to fetch buckets: ${bucketsError.message}`);
  if (!buckets || buckets.length === 0) {
    console.log("No active keyword buckets found");
    return { postsFound: 0, ideasAnalyzed: 0, emailSent: false };
  }

  // Step 2: Fetch posts for each bucket
  let totalPostsFound = 0;
  for (const bucket of buckets) {
    try {
      const count = await fetchPostsByBucket(bucket);
      totalPostsFound += count;
      console.log(`Bucket "${bucket.name}": ${count} new posts`);
    } catch (err) {
      console.error(`Error fetching bucket "${bucket.name}":`, err.message);
    }
  }

  // Step 3: Get all unanalyzed posts
  const { data: unanalyzedPosts, error: postsError } = await supabase
    .from("raw_posts")
    .select("*")
    .not(
      "id",
      "in",
      `(select raw_post_id from analyzed_ideas)`
    );

  // Fallback: if the subquery approach isn't supported, use a different method
  let postsToAnalyze = unanalyzedPosts;
  if (postsError) {
    // Get all already-analyzed post IDs first
    const { data: analyzedIds } = await supabase
      .from("analyzed_ideas")
      .select("raw_post_id");

    const analyzedSet = new Set((analyzedIds || []).map((r) => r.raw_post_id));

    const { data: allPosts } = await supabase
      .from("raw_posts")
      .select("*")
      .order("fetched_at", { ascending: false })
      .limit(100);

    postsToAnalyze = (allPosts || []).filter((p) => !analyzedSet.has(p.id));
  }

  // Step 4: Analyze each new post with Claude
  let ideasAnalyzed = 0;
  const newIdeas = [];

  for (const post of postsToAnalyze || []) {
    try {
      const idea = await analyzePost(post);
      if (idea) {
        ideasAnalyzed++;
        newIdeas.push({ ...idea, content: post.content, author_handle: post.author_handle });
      }
    } catch (err) {
      console.error(`Error analyzing post ${post.x_post_id}:`, err.message);
    }
  }

  // Step 5: Pick top 5 ideas by earliness score for the digest
  // Include any ideas from today that haven't been included in a digest yet
  const { data: digestCandidates } = await supabase
    .from("analyzed_ideas")
    .select("*, raw_posts(content, author_handle)")
    .eq("included_in_digest", false)
    .order("earliness_score", { ascending: false })
    .limit(5);

  let emailSent = false;

  if (sendEmail && digestCandidates && digestCandidates.length > 0) {
    // Flatten for the email template
    const emailIdeas = digestCandidates.map((idea) => ({
      ...idea,
      content: idea.raw_posts?.content || "",
      author_handle: idea.raw_posts?.author_handle || "unknown",
    }));

    const dateStr = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const { subject, html } = buildDigestEmail(emailIdeas, dateStr);

    // Send via Resend
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "TrendForge <digest@trendforge.dev>",
        to: process.env.DIGEST_RECIPIENT_EMAIL || "founder@example.com",
        subject,
        html,
      });

      emailSent = true;

      // Mark these ideas as included in the digest
      const ids = digestCandidates.map((i) => i.id);
      await supabase
        .from("analyzed_ideas")
        .update({ included_in_digest: true })
        .in("id", ids);

      console.log(`Digest email sent with ${digestCandidates.length} ideas`);
    } catch (err) {
      console.error("Failed to send digest email:", err.message);
    }
  }

  return {
    postsFound: totalPostsFound,
    ideasAnalyzed,
    emailSent,
  };
}
