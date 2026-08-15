"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiPost } from "@/lib/api-mutate";
import { Search, Send, Phone, Video, MoreVertical } from "lucide-react";

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
  system?: boolean;
}

interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  status: "online" | "away" | "offline";
  unread: number;
  lastMessage: string;
}

const chatUsers: ChatUser[] = [
  { id: "u1", name: "Alice Johnson", avatar: "AJ", status: "online", unread: 2, lastMessage: "I need help with my order" },
  { id: "u2", name: "Bob Smith", avatar: "BS", status: "away", unread: 0, lastMessage: "Thanks for the help!" },
  { id: "u3", name: "Charlie Lee", avatar: "CL", status: "online", unread: 5, lastMessage: "My payment is stuck" },
  { id: "u4", name: "Diana Ross", avatar: "DR", status: "offline", unread: 0, lastMessage: "Never mind, resolved" },
  { id: "u5", name: "Eve Chen", avatar: "EC", status: "online", unread: 1, lastMessage: "How do I become a seller?" },
];

const initialMessages: Record<string, ChatMessage[]> = {
  u1: [
    { id: "m1", sender: "Alice Johnson", text: "Hi, I need help with my order #ORD-1001", time: "10:30 AM", isAdmin: false },
    { id: "m2", sender: "Support Agent", text: "Hello Alice! I'd be happy to help. What seems to be the issue?", time: "10:31 AM", isAdmin: true },
    { id: "m3", sender: "Alice Johnson", text: "The package hasn't arrived yet and it's been 2 weeks", time: "10:32 AM", isAdmin: false },
    { id: "m4", sender: "Support Agent", text: "Let me check the tracking details for you. One moment please.", time: "10:33 AM", isAdmin: true },
  ],
  u3: [
    { id: "m5", sender: "Charlie Lee", text: "My payment of $129 is stuck on pending", time: "9:15 AM", isAdmin: false },
    { id: "m6", sender: "Support Agent", text: "I can see the transaction. Let me escalate this to the payments team.", time: "9:20 AM", isAdmin: true },
  ],
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function LiveChatPage() {
  const [activeChat, setActiveChat] = useState("u1");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const { data: messageRows, refresh } = useDbResource<MessageRow>("messages");

  useEffect(() => {
    const t = setInterval(() => refresh(), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const threadId = `lc_${activeChat}`;

  const messages = useMemo<ChatMessage[]>(() => {
    const rows = (messageRows ?? []).filter((m) => m.threadId === threadId);
    if (rows.length === 0) return initialMessages[activeChat] ?? [];
    return rows.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.body,
      time: formatTime(m.createdAt),
      isAdmin: m.senderRole === "agent",
    }));
  }, [messageRows, threadId, activeChat]);

  const filteredUsers = useMemo(
    () => chatUsers.filter((u) => u.name.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  async function send(text: string, isAdmin: boolean) {
    const user = chatUsers.find((u) => u.id === activeChat);
    if (!user || !text.trim()) return;
    try {
      await apiPost("messages", {
        threadId: `lc_${activeChat}`,
        sender: isAdmin ? "Support Agent" : user.name,
        senderRole: isAdmin ? "agent" : "user",
        body: text.trim(),
        createdAt: new Date().toISOString(),
      });
      setMessage("");
      refresh();
    } catch (e) {
      console.error(e);
    }
  }

  async function startCall(kind: "voice" | "video") {
    await send(`${kind === "voice" ? "Voice call" : "Video call"} started with ${chatUsers.find((u) => u.id === activeChat)?.name ?? "user"}`, true);
  }

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
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => setActiveChat(user.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                  activeChat === user.id ? "bg-[#6C3BFF]/10" : "hover:bg-[#FAFAFA] "
                }`}
              >
                <div className="relative">
                  <Avatar name={user.name} size="sm" />
                  <div className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                    user.status === "online" ? "bg-[#16A34A]" : user.status === "away" ? "bg-[#F59E0B]" : "bg-gray-300"
                  }`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#18181B] ">{user.name}</p>
                  <p className="truncate text-xs text-gray-500">{user.lastMessage}</p>
                </div>
                {user.unread > 0 && <Badge variant="danger">{user.unread}</Badge>}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={chatUsers.find((u) => u.id === activeChat)?.name || ""} size="sm" />
              <div>
                <CardTitle className="text-base">{chatUsers.find((u) => u.id === activeChat)?.name}</CardTitle>
                <p className="text-xs text-[#16A34A]">Online</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => startCall("voice")} title="Start voice call">
                <Phone className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => startCall("video")} title="Start video call">
                <Video className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => send("More options requested by agent.", true)} title="Open options">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex h-[400px] flex-col gap-3 overflow-y-auto">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isAdmin ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    msg.isAdmin ? "bg-[#6C3BFF] text-white" : "bg-[#FAFAFA] text-[#18181B]  "
                  }`}>
                    <p className="text-sm">{msg.text}</p>
                    <p className={`mt-1 text-right text-xs ${msg.isAdmin ? "text-white/70" : "text-gray-400"}`}>{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-[#E4E4E7] pt-4">
              <Input
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && message.trim()) { send(message, true); } }}
              />
              <Button variant="primary" size="sm" onClick={() => send(message, true)}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}