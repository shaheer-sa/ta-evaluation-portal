"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReplyItem {
  id: string;
  message: string;
  created_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profiles: any;
}

interface QueryThreadProps {
  queryId: string;
  isOpen: boolean;
}

export function QueryThread({ queryId, isOpen }: QueryThreadProps) {
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newReply, setNewReply] = useState("");
  const [isSending, setIsSending] = useState(false);

  const fetchReplies = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/queries/replies?queryId=${queryId}`);
      if (res.ok) {
        const data = await res.json();
        setReplies(data.replies);
      }
    } catch {
      // Silent fail on fetch
    }
    setIsLoading(false);
  }, [queryId]);

  useEffect(() => {
    if (isOpen) fetchReplies();
  }, [isOpen, fetchReplies]);

  async function handleSend() {
    if (!newReply.trim()) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/queries/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryId, message: newReply }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send");
      }
      setNewReply("");
      fetchReplies();
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
    }
    setIsSending(false);
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (!isOpen) return null;

  return (
    <div className="mt-4 border-t pt-4 space-y-3">
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : replies.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No replies yet.</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {replies.map((r) => {
            const isTA = r.profiles?.role === "ta";
            return (
              <div
                key={r.id}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm max-w-[85%]",
                  isTA
                    ? "bg-primary/10 ml-auto text-right"
                    : "bg-muted"
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium">
                    {r.profiles?.full_name || "Unknown"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {isTA ? "TA" : "Student"}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{r.message}</p>
                <span className="text-[10px] text-muted-foreground">
                  {formatTime(r.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply input */}
      <div className="flex gap-2">
        <textarea
          value={newReply}
          onChange={(e) => setNewReply(e.target.value)}
          placeholder="Write a reply..."
          rows={2}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={isSending || !newReply.trim()}
          className="self-end"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
