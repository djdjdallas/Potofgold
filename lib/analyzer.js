import { getSupabaseAdmin } from "./supabase";

const SYSTEM_PROMPT = `You are an opportunity intelligence analyst for indie hackers and solo founders.

Your job is to read viral posts from X (Twitter) about people building products, shipping demos,
or experimenting with new technology — and extract the real business opportunity hiding inside them.

You think like someone who has built and sold multiple SaaS products. You are brutally honest
about whether an opportunity is actually early or already saturated. You prioritize ideas that
a single developer could validate within 2 weeks.

Your earliness scoring works like this:
- 10: Nobody has built this yet. The post itself is proof of concept.
- 8-9: 1-2 people have explored it but no clear winner exists yet. Move fast.
- 6-7: A few products exist but none with strong distribution or a clear market leader.
- 4-5: Growing space with established players. Niche angles still available.
- 1-3: Saturated. Multiple funded competitors. Move on.

Your build difficulty scoring works like this:
- 1: Landing page + existing API. One weekend.
- 2: Simple CRUD app with one API integration. 3-5 days.
- 3: Multiple API integrations or moderate complexity. 1-2 weeks.
- 4: Requires specialized knowledge or complex architecture. 3-4 weeks.
- 5: Months of work. Not suitable for solo MVP validation.

Always think about the ADJACENT opportunity — not just "build what they built"
but what problem this exposes that nobody is solving yet.`;

const USER_PROMPT = (post) => `Analyze this viral X post and extract the product opportunity it represents.

<post>
Author: ${post.author_handle}
Likes: ${post.likes} | Reposts: ${post.reposts} | Views: ${post.views}
Content: ${post.content}
</post>

<task>
1. Identify what technical capability or insight made this post go viral
2. Extract the core emotional hook — why did people share this?
3. Think about what ADJACENT problem this reveals that nobody is solving
4. Score how early this opportunity actually is (be skeptical — most things are not as early as they seem)
5. Suggest one concrete MVP an indie hacker could ship in 1-2 weeks

Be specific. "Build an AI app" is useless. "Build a Chrome extension that does X for Y audience
using the ElevenLabs voice API, charged at $Z/month" is useful.
</task>

<rules>
- If the opportunity is already saturated (earliness 1-3), still return the analysis but note
  what niche angle might still be open
- Adjacent opportunities are more valuable than copycat opportunities — prioritize finding the
  gap the post reveals, not the thing the post describes
- The recommended_mvp must be something a solo developer with Next.js and Supabase knowledge
  could realistically ship in 1-2 weeks
- Do not hype. Be the honest friend who tells you when an idea is actually good vs when
  you're just excited because it got a lot of likes
</rules>

Return ONLY a valid JSON object with no markdown, no explanation, just the JSON:

{
  "capability_used": "One sentence describing the technical capability that made this possible",
  "emotional_hook": "One sentence explaining why people shared this — what feeling did it trigger",
  "adjacent_opportunities": [
    "Specific opportunity 1 — who it's for, what problem, what tech",
    "Specific opportunity 2 — who it's for, what problem, what tech",
    "Specific opportunity 3 — who it's for, what problem, what tech"
  ],
  "build_difficulty": 3,
  "earliness_score": 7,
  "earliness_reasoning": "One sentence explaining why you scored it this way — what exists, what doesn't",
  "recommended_mvp": "2-3 sentences describing the specific MVP: what it does, who it's for, how it makes money, what stack to use",
  "skip": false,
  "skip_reason": null
}

If the post is not actually about building something or has no extractable opportunity
(e.g. it's just an opinion tweet or meme), return the same JSON with skip: true and
skip_reason explaining why.`;

/**
 * Analyze a raw post using Claude to extract opportunity intelligence.
 *
 * @param {Object} rawPost - A raw_posts record
 * @returns {Object|null} The analyzed_ideas record, or null if skipped/failed
 */
export async function analyzePost(rawPost) {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: USER_PROMPT(rawPost),
        },
      ],
    });

    const rawJson = response.content[0].text.trim();
    const analysis = JSON.parse(rawJson);

    // If Claude flagged this post as not worth analyzing, bail early
    if (analysis.skip) {
      console.log(
        `Skipping post ${rawPost.x_post_id}: ${analysis.skip_reason}`
      );
      return null;
    }

    // Insert into Supabase
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("analyzed_ideas")
      .insert({
        raw_post_id: rawPost.id,
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
  } catch (err) {
    // If JSON parse fails, log and skip rather than crashing the whole pipeline
    console.error(
      `Failed to analyze post ${rawPost.x_post_id}:`,
      err.message
    );
    return null;
  }
}
