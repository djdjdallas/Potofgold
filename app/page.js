"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function earlinessVariant(score) {
  if (score >= 8) return "success";
  if (score >= 6) return "warning";
  return "destructive";
}

function difficultyLabel(d) {
  const labels = {
    1: "Weekend",
    2: "3-5 days",
    3: "1-2 weeks",
    4: "3-4 weeks",
    5: "Major project",
  };
  return labels[d] || `${d}/5`;
}

function IdeaCard({ idea, expanded, onToggle }) {
  const post = idea.raw_posts || {};

  return (
    <Card
      className="cursor-pointer hover:border-zinc-600 transition-colors"
      onClick={onToggle}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">
              @{post.author_handle || "unknown"}
              {post.likes ? ` · ${post.likes.toLocaleString()} likes` : ""}
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              {expanded
                ? post.content
                : (post.content || "").slice(0, 150) +
                  ((post.content || "").length > 150 ? "..." : "")}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Badge variant={earlinessVariant(idea.earliness_score)}>
              {idea.earliness_score}/10 early
            </Badge>
            <Badge variant="secondary">{difficultyLabel(idea.build_difficulty)}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Always-visible MVP recommendation */}
        <div className="bg-accent/50 rounded-md p-3 mb-3">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">
            Recommended MVP
          </p>
          <p className="text-sm text-foreground leading-relaxed">
            {idea.recommended_mvp}
          </p>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="space-y-3 mt-3 border-t border-border pt-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Capability Used
              </p>
              <p className="text-sm">{idea.capability_used}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Why It Went Viral
              </p>
              <p className="text-sm">{idea.emotional_hook}</p>
            </div>
            {idea.earliness_reasoning && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Earliness Reasoning
                </p>
                <p className="text-sm">{idea.earliness_reasoning}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                Adjacent Opportunities
              </p>
              <ul className="space-y-1.5">
                {(idea.adjacent_opportunities || []).map((opp, i) => (
                  <li
                    key={i}
                    className="text-sm text-muted-foreground pl-3 border-l-2 border-zinc-700"
                  >
                    {opp}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              Analyzed{" "}
              {new Date(idea.analyzed_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {idea.included_in_digest && " · Included in digest"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [ideas, setIdeas] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [minEarliness, setMinEarliness] = useState(0);
  const [selectedBucket, setSelectedBucket] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (minEarliness > 0) params.set("minEarliness", minEarliness);
    if (selectedBucket) params.set("bucketId", selectedBucket);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    try {
      const res = await fetch(`/api/ideas?${params}`);
      const data = await res.json();
      setIdeas(data.ideas || []);
    } catch (err) {
      console.error("Failed to fetch ideas:", err);
    } finally {
      setLoading(false);
    }
  }, [minEarliness, selectedBucket, dateFrom, dateTo]);

  const fetchBuckets = useCallback(async () => {
    try {
      const res = await fetch("/api/buckets");
      const data = await res.json();
      setBuckets(data.buckets || []);
    } catch (err) {
      console.error("Failed to fetch buckets:", err);
    }
  }, []);

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <aside className="lg:w-64 shrink-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Keyword Buckets</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <button
                onClick={() => setSelectedBucket("")}
                className={`w-full text-left text-sm px-2 py-1.5 rounded transition-colors ${
                  !selectedBucket
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All buckets
              </button>
              {buckets.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBucket(b.id)}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded transition-colors flex items-center justify-between ${
                    selectedBucket === b.id
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{b.name}</span>
                  {!b.active && (
                    <span className="text-xs text-zinc-600">off</span>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Filters</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Min Earliness Score
                </label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={minEarliness || ""}
                  onChange={(e) =>
                    setMinEarliness(parseInt(e.target.value) || 0)
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  From Date
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  To Date
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setMinEarliness(0);
                  setDateFrom("");
                  setDateTo("");
                  setSelectedBucket("");
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        </aside>

        {/* Main Ideas Feed */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Opportunity Feed
              {ideas.length > 0 && (
                <span className="text-muted-foreground font-normal ml-2 text-sm">
                  ({ideas.length} ideas)
                </span>
              )}
            </h2>
            <Button variant="outline" size="sm" onClick={fetchIdeas}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading ideas...
            </div>
          ) : ideas.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No ideas found. Run the pipeline to start fetching and
                  analyzing posts.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Go to{" "}
                  <a href="/buckets" className="text-indigo-400 hover:underline">
                    Buckets
                  </a>{" "}
                  to configure keywords and trigger a manual run.
                </p>
              </CardContent>
            </Card>
          ) : (
            ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                expanded={expandedId === idea.id}
                onToggle={() =>
                  setExpandedId(expandedId === idea.id ? null : idea.id)
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
