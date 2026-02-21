"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function BucketsPage() {
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formKeywords, setFormKeywords] = useState("");
  const [formMinLikes, setFormMinLikes] = useState(500);
  const [formActive, setFormActive] = useState(true);

  const fetchBuckets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/buckets");
      const data = await res.json();
      setBuckets(data.buckets || []);
    } catch (err) {
      console.error("Failed to fetch buckets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  function resetForm() {
    setFormName("");
    setFormKeywords("");
    setFormMinLikes(500);
    setFormActive(true);
    setEditingId(null);
  }

  function startEdit(bucket) {
    setEditingId(bucket.id);
    setFormName(bucket.name);
    setFormKeywords((bucket.keywords || []).join(", "));
    setFormMinLikes(bucket.min_likes);
    setFormActive(bucket.active);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const keywords = formKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (!formName || keywords.length === 0) return;

    const body = {
      name: formName,
      keywords,
      min_likes: formMinLikes,
      active: formActive,
    };

    try {
      if (editingId) {
        await fetch("/api/buckets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...body }),
        });
      } else {
        await fetch("/api/buckets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      resetForm();
      fetchBuckets();
    } catch (err) {
      console.error("Failed to save bucket:", err);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this keyword bucket?")) return;

    try {
      await fetch(`/api/buckets?id=${id}`, { method: "DELETE" });
      fetchBuckets();
    } catch (err) {
      console.error("Failed to delete bucket:", err);
    }
  }

  async function handleRunPipeline() {
    setPipelineRunning(true);
    setPipelineResult(null);

    const secret = prompt("Enter your CRON_SECRET to trigger the pipeline:");
    if (!secret) {
      setPipelineRunning(false);
      return;
    }

    try {
      const res = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, sendEmail: false }),
      });
      const data = await res.json();
      setPipelineResult(data);
    } catch (err) {
      setPipelineResult({ success: false, error: err.message });
    } finally {
      setPipelineRunning(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Keyword Buckets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure search terms and engagement thresholds for X post
            monitoring
          </p>
        </div>
        <Button
          onClick={handleRunPipeline}
          disabled={pipelineRunning}
          variant="outline"
        >
          {pipelineRunning ? "Running..." : "Run Pipeline Now"}
        </Button>
      </div>

      {/* Pipeline result */}
      {pipelineResult && (
        <Card
          className={
            pipelineResult.success
              ? "border-emerald-800"
              : "border-red-800"
          }
        >
          <CardContent className="py-3">
            {pipelineResult.success ? (
              <p className="text-sm text-emerald-400">
                Pipeline completed: {pipelineResult.postsFound} posts found,{" "}
                {pipelineResult.ideasAnalyzed} ideas analyzed.
                {pipelineResult.emailSent && " Digest email sent."}
              </p>
            ) : (
              <p className="text-sm text-red-400">
                Pipeline error: {pipelineResult.error}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? "Edit Bucket" : "Add New Bucket"}
          </CardTitle>
          <CardDescription>
            Define a group of keywords to monitor on X
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Bucket Name</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder='e.g. "AI demos"'
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minLikes">Min Likes Threshold</Label>
                <Input
                  id="minLikes"
                  type="number"
                  min="0"
                  value={formMinLikes}
                  onChange={(e) =>
                    setFormMinLikes(parseInt(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords (comma-separated)</Label>
              <Input
                id="keywords"
                value={formKeywords}
                onChange={(e) => setFormKeywords(e.target.value)}
                placeholder="AI demo, built with AI, GPT prototype"
                required
              />
              <p className="text-xs text-muted-foreground">
                Each keyword will be searched separately on X
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={formActive}
                onCheckedChange={setFormActive}
              />
              <Label>Active</Label>
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit">
                {editingId ? "Update Bucket" : "Add Bucket"}
              </Button>
              {editingId && (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing Buckets List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Existing Buckets
        </h2>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : buckets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No keyword buckets configured yet. Add one above.
            </CardContent>
          </Card>
        ) : (
          buckets.map((bucket) => (
            <Card key={bucket.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{bucket.name}</h3>
                      <Badge
                        variant={bucket.active ? "success" : "secondary"}
                      >
                        {bucket.active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">
                        {bucket.min_likes}+ likes
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(bucket.keywords || []).map((kw, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(bucket)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => handleDelete(bucket.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
