/**
 * Generate a clean HTML email digest for the top scored ideas.
 *
 * @param {Array} ideas - Array of analyzed_ideas joined with raw_posts data
 * @param {string} dateStr - The date string for the subject line
 * @returns {{ subject: string, html: string }}
 */
export function buildDigestEmail(ideas, dateStr) {
  const subject = `TrendForge: ${dateStr} — ${ideas.length} opportunities spotted`;

  const difficultyLabels = {
    1: "Weekend build",
    2: "3-5 days",
    3: "1-2 weeks",
    4: "3-4 weeks",
    5: "Major project",
  };

  const difficultyColors = {
    1: "#10b981",
    2: "#34d399",
    3: "#fbbf24",
    4: "#f97316",
    5: "#ef4444",
  };

  const earlinessColor = (score) => {
    if (score >= 8) return "#10b981";
    if (score >= 6) return "#fbbf24";
    if (score >= 4) return "#f97316";
    return "#ef4444";
  };

  const ideaCards = ideas
    .map(
      (idea, i) => `
    <tr>
      <td style="padding: 0 0 24px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #18181b; border-radius: 8px; border: 1px solid #27272a;">
          <tr>
            <td style="padding: 20px;">
              <!-- Header row with scores -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 13px; color: #a1a1aa;">
                      #${i + 1} &middot; @${idea.author_handle}
                    </span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background: ${earlinessColor(idea.earliness_score)}; color: #000; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 700;">
                      Earliness: ${idea.earliness_score}/10
                    </span>
                    <span style="display: inline-block; background: ${difficultyColors[idea.build_difficulty]}; color: #000; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; margin-left: 6px;">
                      ${difficultyLabels[idea.build_difficulty]}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Post snippet -->
              <p style="color: #d4d4d8; font-size: 14px; line-height: 1.5; margin: 12px 0; padding: 12px; background: #0f0f12; border-radius: 6px; border-left: 3px solid #3f3f46;">
                ${truncate(idea.content, 200)}
              </p>

              <!-- Capability + Hook -->
              <p style="color: #a1a1aa; font-size: 13px; margin: 8px 0 4px;">
                <strong style="color: #e4e4e7;">Capability:</strong> ${idea.capability_used}
              </p>
              <p style="color: #a1a1aa; font-size: 13px; margin: 4px 0;">
                <strong style="color: #e4e4e7;">Why it went viral:</strong> ${idea.emotional_hook}
              </p>

              <!-- Recommended MVP -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
                <tr>
                  <td style="background: #1a1a2e; border-radius: 6px; padding: 14px; border: 1px solid #27272a;">
                    <p style="color: #818cf8; font-size: 12px; font-weight: 700; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Recommended MVP
                    </p>
                    <p style="color: #e4e4e7; font-size: 14px; line-height: 1.5; margin: 0;">
                      ${idea.recommended_mvp}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Adjacent opportunities -->
              <p style="color: #818cf8; font-size: 12px; font-weight: 700; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                Adjacent Opportunities
              </p>
              ${(idea.adjacent_opportunities || [])
                .map(
                  (opp) => `
                <p style="color: #a1a1aa; font-size: 13px; margin: 4px 0; padding-left: 12px; border-left: 2px solid #3f3f46;">
                  ${opp}
                </p>
              `
                )
                .join("")}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #09090b;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0">
          <!-- Header -->
          <tr>
            <td style="padding: 0 0 32px;">
              <h1 style="color: #fafafa; font-size: 24px; margin: 0 0 4px;">
                TrendForge
              </h1>
              <p style="color: #71717a; font-size: 14px; margin: 0;">
                ${dateStr} &middot; ${ideas.length} opportunities ranked by earliness
              </p>
            </td>
          </tr>

          <!-- Idea Cards -->
          ${ideaCards}

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 0 0; border-top: 1px solid #27272a;">
              <p style="color: #52525b; font-size: 12px; margin: 0; text-align: center;">
                TrendForge — AI-powered opportunity intelligence for indie hackers
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, html };
}

function truncate(text, maxLen) {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}
