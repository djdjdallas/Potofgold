// Uses Apify Tweet Scraper V2 instead of direct X API
// Cost: ~$0.40 per 1,000 tweets vs $100/month for X API Basic
// Upgrade to direct X API only if volume demands it

import { getSupabaseAdmin } from "./supabase";

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const ACTOR_ID = "apidojo/tweet-scraper";

/**
 * Fetch posts from X via Apify Tweet Scraper for a given keyword bucket.
 * Searches each keyword with engagement filters, deduplicates, and inserts into raw_posts.
 *
 * @param {Object} bucket - A keyword_bucket record
 * @returns {number} Count of new posts inserted
 */
export async function fetchPostsByBucket(bucket) {
  if (!APIFY_API_TOKEN) {
    throw new Error("APIFY_API_TOKEN environment variable is not set");
  }

  // Build search queries using X advanced search syntax
  // Apify supports the same query syntax as Twitter's search bar
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

  try {
    // Step 1: Start the Apify actor run
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

    // Step 2: Poll until the run finishes
    let status = "RUNNING";
    let attempts = 0;
    const maxAttempts = 30; // 30 x 10s = 5 minutes max wait

    while (status === "RUNNING" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
      );
      const statusData = await statusResponse.json();
      status = statusData.data.status;
      attempts++;
    }

    if (status !== "SUCCEEDED") {
      throw new Error(`Apify run failed with status: ${status}`);
    }

    // Step 3: Fetch results from the dataset
    const datasetResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}&clean=true`
    );
    const tweets = await datasetResponse.json();

    // Step 4: Map Apify output to our raw_posts schema
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

    // Step 5: Insert into Supabase, skipping duplicates
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("raw_posts")
      .upsert(mappedPosts, { onConflict: "x_post_id", ignoreDuplicates: true })
      .select();

    if (error) throw error;

    console.log(
      `Bucket "${bucket.name}": fetched ${tweets.length} tweets, inserted ${data?.length || 0} new`
    );
    return data?.length || 0;
  } catch (err) {
    console.error(`Failed to fetch bucket "${bucket.name}":`, err.message);
    return 0;
  }
}
