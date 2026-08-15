"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiPatch, apiPost } from "@/lib/api-mutate";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, LifeBuoy, Send, User, Calendar, Tag, MessageSquare } from "lucide-react";
import Link from "next/link";
import type { SupportTicket } from "@/types";

const priorityVariants: Record<string, "success" | "warning" | "danger" | "default"> = {
  low: "success",
  medium: "warning",
  high: "danger",
  urgent: "danger",
};

interface MessageRow {
  id: string;
  threadId: string;
  sender: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

interface ThreadMessage {
  id: string;
  from: "user" | "agent";
  author: string;
  text: string;
  at: string;
}

function buildFallbackThread(ticket: SupportTicket): ThreadMessage[] {
  const base = Date.parse(ticket.createdAt);
  const at = (h: number) => new Date(base + h * 60 * 60 * 1000).toISOString();
  return [
    { id: `${ticket.id}_m1`, from: "user", author: ticket.userName, text: `Hi, I need help with: ${ticket.subject.toLowerCase()}. Please assist as soon as possible.`, at: at(0) },
    { id: `${ticket.id}_m2`, from: "agent", author: "Support Agent", text: "Thanks for reaching out! We have received your ticket and are looking into it.", at: at(1.5) },
    { id: `${ticket.id}_m3`, from: "user", author: ticket.userName, text: "I can share more details if needed. Let me know what you require.", at: at(3) },
  ];
}

export default function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: tickets, refresh } = useDbResource<SupportTicket>("tickets");
  const { data: messageRows, refresh: refreshMessages } = useDbResource<MessageRow>("messages");
  const [assignee, setAssignee] = useState("Support Agent");
  const [reply, setReply] = useState("");
  const [ticket, setTicket] = useState<SupportTicket | null>(null);

  const fetched = useMemo(() => tickets?.find((t) => t.id === id) ?? null, [tickets, id]);

  useEffect(() => {
    if (fetched) setTicket(fetched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetched]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const thread = useMemo<ThreadMessage[]>(() => {
    const rows = (messageRows ?? []).filter((m) => m.threadId === id);
    if (rows.length === 0) {
      return ticket ? buildFallbackThread(ticket) : [];
    }
    return rows.map((m) => ({
      id: m.id,
      from: m.senderRole === "agent" ? ("agent" as const) : ("user" as const),
      author: m.sender,
      text: m.body,
      at: m.createdAt,
    }));
  }, [messageRows, id, ticket]);

  async function sendReply() {
    if (!reply.trim() || !ticket) return;
    try {
      await apiPost("messages", {
        threadId: ticket.id,
        sender: assignee,
        senderRole: "agent",
        body: reply.trim(),
        createdAt: new Date().toISOString(),
      });
      setReply("");
      refreshMessages();
    } catch (e) {
      console.error(e);
    }
  }

  if (!ticket) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Support", href: "/dashboard/support" }, { label: "Ticket" }]} />
        <EmptyState
          icon={<LifeBuoy className="h-8 w-8 text-gray-300" />}
          title="Ticket not found"
          description={`No ticket exists with ID ${id}.`}
          action={
            <Link href="/dashboard/support">
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4" /> Back to Support
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  async function patchTicket(patch: Partial<SupportTicket>) {
    const current = ticket;
    if (!current) return;
    setTicket({ ...current, ...patch });
    try {
      await apiPatch("tickets", current.id, patch);
    } catch (e) {
      console.error(e);
    }
  }

  const resolved = ticket.status !== "open";

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Support", href: "/dashboard/support" }, { label: ticket.id }]} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-[#18181B] ">{ticket.id}</h1>
            <Badge variant={priorityVariants[ticket.priority]}>
              <Tag className="mr-1 h-3 w-3" /> {ticket.priority}
            </Badge>
            <StatusBadge status={ticket.status} />
          </div>
          <p className="mt-1 text-sm font-medium text-[#18181B] ">{ticket.subject}</p>
          <p className="mt-0.5 text-xs text-gray-400">
            {ticket.userName} &middot; Opened {formatDate(ticket.createdAt, "long")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ticket.status === "open" ? (
            <>
              <Button variant="secondary" onClick={() => patchTicket({ status: "resolved", assignee })}>
                Resolve
              </Button>
              <Button variant="danger" onClick={() => patchTicket({ status: "closed" })}>
                Close
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => patchTicket({ status: "open" })}>
              Reopen
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Left: conversation */}
        <div className="col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {thread.map((m) => (
                  <div key={m.id} className={`flex ${m.from === "user" ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        m.from === "user" ? "rounded-tl-sm bg-[#F4F4F5]" : "rounded-tr-sm bg-[#6C3BFF]"
                      }`}
                    >
                      <p className={`text-xs font-medium ${m.from === "user" ? "text-gray-500" : "text-white/70"}`}>
                        {m.author} &middot; {formatDate(m.at, "relative")}
                      </p>
                      <p className={`mt-1 text-sm ${m.from === "user" ? "text-[#18181B]" : "text-white"}`}>{m.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {ticket.status === "open" ? (
                <div className="mt-6 flex items-center gap-3">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    className="h-24 flex-1 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 text-sm outline-none focus:border-[#6C3BFF]"
                    placeholder="Write a reply to the user..."
                  />
                  <Button
                    variant="primary"
                    disabled={!reply.trim()}
                    onClick={sendReply}
                  >
                    <Send className="h-4 w-4" /> Send
                  </Button>
                </div>
              ) : (
                <p className="mt-6 rounded-xl bg-[#FAFAFA] px-4 py-3 text-center text-sm text-gray-500">
                  This ticket is {ticket.status} — replies are disabled.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: ticket info */}
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                    <User className="h-4 w-4 text-[#6C3BFF]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">User</p>
                    <p className="text-sm font-medium text-[#18181B] ">{ticket.userName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                    <MessageSquare className="h-4 w-4 text-[#6C3BFF]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Subject</p>
                    <p className="text-sm font-medium text-[#18181B] ">{ticket.subject}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                    <Calendar className="h-4 w-4 text-[#6C3BFF]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Opened</p>
                    <p className="text-sm font-medium text-[#18181B] ">{formatDate(ticket.createdAt, "long")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="mb-1.5 text-xs text-gray-500">Assignee</p>
                  <Select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    options={[
                      { label: "Support Agent", value: "Support Agent" },
                      { label: "Admin John", value: "Admin John" },
                      { label: "Moderator Jane", value: "Moderator Jane" },
                    ]}
                  />
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    patchTicket({ assignee });
                  }}
                >
                  Assign Ticket
                </Button>
                {ticket.assignee && (
                  <p className="text-xs text-gray-400">Currently assigned to {ticket.assignee}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}