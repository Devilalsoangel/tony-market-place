"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiPost } from "@/lib/api-mutate";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { Search, Send, MessageSquare } from "lucide-react";

interface MessageRow {
  id: string;
  threadId: string;
  sender: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isAdmin: boolean;
}

interface ChatThread {
  id: string;
  name: string;
  lastMessage: string;
  lastAt: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function LiveChatPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const adminUser = useAuthStore((s) => s.user);
  const { data: messageRows, refresh } = useDbResource<MessageRow>("messages");

  useEffect(() => {
    const t = setInterval(() => refresh(), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const threads = useMemo<ChatThread[]>(() => {
    const byThread = new Map<string, MessageRow[]>();
    for (const row of messageRows ?? []) {
      const list = byThread.get(row.threadId) ?? [];
      list.push(row);
      byThread.set(row.threadId, list);
    }
    return Array.from(byThread.entries())
      .map(([threadId, rows]) => {
        const sorted = [...rows].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        const last = sorted[sorted.length - 1];
        const counterpart = [...sorted].reverse().find((m) => m.senderRole !== "agent");
        return {
          id: threadId,
          name: counterpart?.sender ?? last.sender,
          lastMessage: last.body,
          lastAt: last.createdAt,
        };
      })
      .sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
  }, [messageRows]);

  const activeChat = selected ?? threads[0]?.id ?? null;

  const messages = useMemo<ChatMessage[]>(() => {
    if (!activeChat) return [];
    return (messageRows ?? [])
      .filter((m) => m.threadId === activeChat)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.body,
        time: formatTime(m.createdAt),
        isAdmin: m.senderRole === "agent",
      }));
  }, [messageRows, activeChat]);

  const filteredThreads = useMemo(
    () => threads.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [threads, search]
  );

  async function send(text: string) {
    if (!activeChat || !text.trim()) return;
    try {
      await apiPost("messages", {
        threadId: activeChat,
        sender: adminUser?.name || "Admin",
        senderRole: "agent",
        body: text.trim(),
        createdAt: new Date().toISOString(),
      });
      setMessage("");
      refresh();
    } catch (e) {
      console.error(e);
    }
  }

  const activeName = threads.find((t) => t.id === activeChat)?.name ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#18181B] ">Live Chat</h1>
        <p className="mt-1 text-sm text-gray-500">Real-time customer support chat</p>
      </div>
      <div className="flex gap-4">
        <Card className="w-80 shrink-0">
          <CardHeader>
            <CardTitle>Active Chats</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Search chats..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {filteredThreads.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-8 w-8 text-gray-300" />}
                title="No active chats"
                description="Chat threads will appear here once customers message support."
                className="py-8"
              />
            ) : (
              filteredThreads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setSelected(thread.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                    activeChat === thread.id ? "bg-[#6C3BFF]/10" : "hover:bg-[#FAFAFA] "
                  }`}
                >
                  <Avatar name={thread.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#18181B] ">{thread.name}</p>
                    <p className="truncate text-xs text-gray-500">{thread.lastMessage}</p>
                  </div>
                  <span className="shrink-0 self-start text-[11px] text-gray-400">{formatDate(thread.lastAt, "relative")}</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Avatar name={activeName} size="sm" />
              <CardTitle className="text-base">{activeName || "Select a conversation"}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {!activeChat ? (
              <EmptyState
                icon={<MessageSquare className="h-8 w-8 text-gray-300" />}
                title="No conversation selected"
                description="Pick a chat thread on the left to view its messages."
                className="py-8"
              />
            ) : (
              <>
                <div className="mb-4 flex h-[400px] flex-col gap-3 overflow-y-auto">
                  {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <p className="rounded-xl bg-[#FAFAFA] px-4 py-3 text-center text-sm text-gray-500">No messages in this chat yet.</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.isAdmin ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          msg.isAdmin ? "bg-[#6C3BFF] text-white" : "bg-[#FAFAFA] text-[#18181B]  "
                        }`}>
                          <p className="text-sm">{msg.text}</p>
                          <p className={`mt-1 text-right text-xs ${msg.isAdmin ? "text-white/70" : "text-gray-400"}`}>{msg.time}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2 border-t border-[#E4E4E7] pt-4">
                  <Input
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && message.trim()) { send(message); } }}
                  />
                  <Button variant="primary" size="sm" onClick={() => send(message)}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
