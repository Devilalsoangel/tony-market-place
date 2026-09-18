"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import {
  Send, Save, Clock, Eye, Mail, Megaphone, Bell,
  History, FileText, CheckCircle2, XCircle
} from "lucide-react";
import type { NotificationChannel, NotificationStatus, AudienceSegment, NotificationTemplate, NotificationHistoryItem } from "@/types";
import { useDbResource } from "@/hooks/use-db-resource";

const audienceOptions = [
  { label: "All Users", value: "all" },
  { label: "Buyers Only", value: "buyers" },
  { label: "Sellers Only", value: "sellers" },
  { label: "Verified Sellers", value: "verified_sellers" },
  { label: "Selected Users", value: "selected_users" },
];

const channelIcon: Record<NotificationChannel, typeof Bell> = {
  push: Bell,
  email: Mail,
  banner: Megaphone,
};

const statusBadge: Record<NotificationStatus, { variant: "success" | "warning" | "primary"; label: string }> = {
  sent: { variant: "success", label: "Sent" },
  logged: { variant: "warning", label: "Logged (no transport)" },
  draft: { variant: "warning", label: "Draft" },
  scheduled: { variant: "primary", label: "Scheduled" },
};

function previewBody(body: string): string {
  // Neutral placeholder tokens — the preview must not invent a real-looking
  // customer name, order ID, coupon code, or URL.
  return body
    .replace(/\{\{name\}\}/g, "[Customer Name]")
    .replace(/\{\{orderId\}\}/g, "[Order ID]")
    .replace(/\{\{discount\}\}/g, "[X]%")
    .replace(/\{\{code\}\}/g, "[COUPON CODE]")
    .replace(/\{\{link\}\}/g, "[Link]");
}

export default function NotificationsPage() {
  const { data: dbTemplates } = useDbResource<NotificationTemplate>("notification-templates");
  const { data: dbHistory } = useDbResource<NotificationHistoryItem>("notification-history");
  const templates = dbTemplates ?? [];
  const [history, setHistory] = useState<NotificationHistoryItem[]>(dbHistory ?? []);
  useEffect(() => {
    if (dbHistory) setHistory(dbHistory);
  }, [dbHistory]);
  // Due-sweep: no runner exists for scheduled sends, so a past-due schedule
  // used to sit "Scheduled" forever. On load, flip due rows to logged (the
  // transport is log-only and labeled as such — the date now MEANS something:
  // the entry joined history when due). Best-effort per row, never blocking.
  useEffect(() => {
    if (!dbHistory) return;
    const now = Date.now();
    const due = dbHistory.filter(
      (h) => h.status === "scheduled" && h.scheduledFor && !Number.isNaN(Date.parse(h.scheduledFor)) && Date.parse(h.scheduledFor) <= now
    );
    if (!due.length) return;
    let cancelled = false;
    (async () => {
      for (const h of due) {
        if (cancelled) return;
        try {
          const res = await fetch("/api/data/notification-history", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ id: h.id, data: { status: "logged", sentAt: new Date().toISOString() } }),
          });
          if (res.ok && !cancelled) {
            setHistory((prev) => prev.map((x) => (x.id === h.id ? { ...x, status: "logged" as const, sentAt: new Date().toISOString() } : x)));
          }
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [dbHistory]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [fromName, setFromName] = useState("SUSEJ Team");
  const [emailBody, setEmailBody] = useState("");
  const [bannerText, setBannerText] = useState("");
  const [bannerLink, setBannerLink] = useState("");
  const [audience, setAudience] = useState<AudienceSegment>("all");
  const [selectedUsers, setSelectedUsers] = useState("");
  const [schedule, setSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<NotificationChannel>("email");

  function applyTemplate(templateId: string) {
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;
    if (tmpl.channel === "email") {
      setSubject(tmpl.subject || "");
      setEmailBody(tmpl.body);
      setPreviewChannel("email");
    } else if (tmpl.channel === "push") {
      setTitle(tmpl.title || "");
      setMessage(tmpl.body);
      setPreviewChannel("push");
    } else {
      setBannerText(tmpl.body.replace(/\{\{message\}\}/g, ""));
      setPreviewChannel("banner");
    }
  }

  function openPreview(channel: NotificationChannel) {
    setPreviewChannel(channel);
    setShowPreview(true);
  }

  // Sends are LOG-ONLY until a push/email provider is wired: this writes the
  // history row so the desk has a record, but no device/email is contacted.
  // Status reads "logged" (never "sent"), the audience carries a "log only"
  // marker, and the POST carries the session — a 401 rolls the optimistic
  // row back instead of faking a send.
  function sendNow(channel: NotificationChannel) {
    const selectedList =
      audience === "selected_users"
        ? selectedUsers.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean).slice(0, 200)
        : [];
    const audienceLabel =
      (audienceOptions.find((o) => o.value === audience)?.label || audience) +
      (selectedList.length ? ` (${selectedList.length}, log only)` : " (log only)");
    const entry: NotificationHistoryItem = {
      id: `n${Date.now()}`,
      channel,
      title: channel === "email" ? subject : channel === "push" ? title : bannerText,
      audience: audienceLabel,
      status: "logged",
      sentAt: new Date().toISOString(),
    };
    setHistory((prev) => [entry, ...prev]);
    // Known-fields ONLY: the history table has channel/title/audience/status/
    // scheduledFor/sentAt — the old body spread transport:"log-only" +
    // selectedUsers[] (unknown Prisma args) threw on every send, so Send-Now
    // and Schedule silently rolled back 100% of the time. The selected scope
    // rides in the audience label (log-only lane: no provider to address).
    fetch("/api/data/notification-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        channel,
        title: entry.title,
        audience: audienceLabel,
        status: "logged",
        scheduledFor: null,
        sentAt: entry.sentAt || null,
      }),
    }).then((res) => {
      if (!res.ok) setHistory((prev) => prev.filter((h) => h.id !== entry.id));
    }).catch(() => {
      setHistory((prev) => prev.filter((h) => h.id !== entry.id));
    });
  }

  function saveDraft(channel: NotificationChannel) {
    const entry: NotificationHistoryItem = {
      id: `n${Date.now()}`,
      channel,
      title: channel === "email" ? subject : channel === "push" ? title : bannerText,
      audience: audienceOptions.find((o) => o.value === audience)?.label || audience,
      status: "draft",
      sentAt: "",
    };
    setHistory((prev) => [entry, ...prev]);
    fetch("/api/data/notification-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ channel, title: entry.title, audience: entry.audience, status: "draft", scheduledFor: null, sentAt: null }),
    }).then((res) => {
      if (!res.ok) setHistory((prev) => prev.filter((h) => h.id !== entry.id));
    }).catch(() => {
      setHistory((prev) => prev.filter((h) => h.id !== entry.id));
    });
  }

  function scheduleSend(channel: NotificationChannel) {
    if (!scheduleDate) return;
    // Safe ISO: datetime-local has no zone — interpret as local, persist UTC.
    // The old `${scheduleDate}:00.000Z` concat shifted hours for +05:30 desks.
    const selectedCount =
      audience === "selected_users"
        ? selectedUsers.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean).length
        : 0;
    const audienceLabel =
      (audienceOptions.find((o) => o.value === audience)?.label || audience) +
      (selectedCount ? ` (${selectedCount}, log only)` : " (log only)");
    const entry: NotificationHistoryItem = {
      id: `n${Date.now()}`,
      channel,
      title: channel === "email" ? subject : channel === "push" ? title : bannerText,
      audience: audienceLabel,
      status: "scheduled",
      scheduledFor: scheduleDate,
      sentAt: "",
    };
    setHistory((prev) => [entry, ...prev]);
    const scheduledFor = (() => {
      const d = new Date(scheduleDate);
      return Number.isNaN(d.getTime()) ? scheduleDate : d.toISOString();
    })();
    // Known-fields ONLY (same Prisma unknown-arg 503 as sendNow had).
    fetch("/api/data/notification-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ channel, title: entry.title, audience: audienceLabel, status: "scheduled", scheduledFor, sentAt: null }),
    }).then((res) => {
      if (!res.ok) setHistory((prev) => prev.filter((h) => h.id !== entry.id));
    }).catch(() => {
      setHistory((prev) => prev.filter((h) => h.id !== entry.id));
    });
    setSchedule(false);
    setScheduleDate("");
  }

  const pushTemplates = templates.filter((t) => t.channel === "push");
  const emailTemplates = templates.filter((t) => t.channel === "email");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#18181B] ">Notification Builder</h1>
          <p className="mt-1 text-sm text-gray-500">Sends are logged to history only — no push/email provider is wired yet, so nothing reaches a device.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs tabs={[
            { label: "Push Notifications", value: "push" },
            { label: "Email Campaigns", value: "email" },
            { label: "Announcement Banners", value: "banner" },
            { label: "History", value: "history" },
          ]}>
            {(active) => (
              <div className="p-6">
                {active === "push" && (
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div>
                        <Label>Notification Title</Label>
                        <Input placeholder="e.g. Flash Sale Live!" value={title} onChange={(e) => setTitle(e.target.value)} />
                      </div>
                      <div>
                        <Label>Message</Label>
                        <textarea
                          className="h-28 w-full rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 text-sm outline-none focus:border-[#6C3BFF]  "
                          placeholder="Write your push notification message..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Target Audience</Label>
                        <Select options={audienceOptions} value={audience} onChange={(e) => setAudience(e.target.value as AudienceSegment)} />
                      </div>
                      {audience === "selected_users" && (
                        <div>
                          <Label>User Emails (one per line)</Label>
                          <textarea
                            className="h-20 w-full rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 text-sm outline-none focus:border-[#6C3BFF]  "
                            placeholder="user1@email.com&#10;user2@email.com"
                            value={selectedUsers}
                            onChange={(e) => setSelectedUsers(e.target.value)}
                          />
                        </div>
                      )}
                      <div>
                        <Label>Ready-made Template</Label>
                        <Select
                          options={[{ label: "Select a template...", value: "" }, ...pushTemplates.map((t) => ({ label: t.name, value: t.id }))]}
                          value={selectedTemplate}
                          onChange={(e) => { setSelectedTemplate(e.target.value); if (e.target.value) applyTemplate(e.target.value); }}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-[#FAFAFA] px-4 py-3 ">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-500">Schedule for later</span>
                        </div>
                        <Switch checked={schedule} onChange={setSchedule} />
                      </div>
                      {schedule && (
                        <div>
                          <Label>Send Date & Time</Label>
                          <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                        </div>
                      )}
                      <div className="flex gap-3">
                        <Button className="flex-1" onClick={schedule ? () => scheduleSend("push") : () => sendNow("push")}>
                          <Send className="h-4 w-4" /> {schedule ? "Schedule" : "Send Now"}
                        </Button>
                        <Button variant="secondary" onClick={() => saveDraft("push")}>
                          <Save className="h-4 w-4" /> Draft
                        </Button>
                        <Button variant="ghost" onClick={() => openPreview("push")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-6 ">
                      <p className="mb-3 text-sm font-medium text-[#18181B] ">Push Preview</p>
                      <div className="rounded-2xl bg-white p-4 shadow-sm ">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6C3BFF] text-xs font-bold text-white">S</div>
                          <div>
                            <p className="text-xs font-medium text-[#18181B] ">SUSEJ</p>
                            <p className="text-xs text-gray-400">now</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-[#18181B] ">{title || "Notification Title"}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{message || "Your notification message will appear here"}</p>
                      </div>
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium text-gray-400">TEMPLATES</p>
                        {pushTemplates.length === 0 && (
                          <p className="rounded-xl border border-dashed border-[#E4E4E7] px-3 py-2.5 text-xs text-gray-400">No push templates saved yet.</p>
                        )}
                        {pushTemplates.map((t) => (
                          <button
                            key={t.id}
                            className="w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2.5 text-left text-sm text-gray-500 transition-colors hover:border-[#6C3BFF]/40 hover:bg-[#6C3BFF]/5   "
                            onClick={() => { setSelectedTemplate(t.id); applyTemplate(t.id); }}
                          >
                            <span className="font-medium text-[#18181B] ">{t.name}</span>
                            <p className="mt-0.5 text-xs text-gray-400">{t.preview}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {active === "email" && (
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Subject Line</Label>
                          <Input placeholder="e.g. Welcome to SUSEJ!" value={subject} onChange={(e) => setSubject(e.target.value)} />
                        </div>
                        <div>
                          <Label>From Name</Label>
                          <Input value={fromName} onChange={(e) => setFromName(e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <Label>Target Audience</Label>
                        <Select options={audienceOptions} value={audience} onChange={(e) => setAudience(e.target.value as AudienceSegment)} />
                      </div>
                      {audience === "selected_users" && (
                        <div>
                          <Label>User Emails (one per line)</Label>
                          <textarea
                            className="h-20 w-full rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 text-sm outline-none focus:border-[#6C3BFF]  "
                            placeholder="user1@email.com&#10;user2@email.com"
                            value={selectedUsers}
                            onChange={(e) => setSelectedUsers(e.target.value)}
                          />
                        </div>
                      )}
                      <div>
                        <Label>Ready-made Template</Label>
                        <Select
                          options={[{ label: "Select a template...", value: "" }, ...emailTemplates.map((t) => ({ label: t.name, value: t.id }))]}
                          value={selectedTemplate}
                          onChange={(e) => { setSelectedTemplate(e.target.value); if (e.target.value) applyTemplate(e.target.value); }}
                        />
                      </div>
                      <div>
                        <Label>Email Body</Label>
                        <textarea
                          className="h-40 w-full rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 font-mono text-sm outline-none focus:border-[#6C3BFF]  "
                          placeholder="<h1>Hello {{name}}</h1><p>{{message}}</p>"
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-[#FAFAFA] px-4 py-3 ">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-500">Schedule for later</span>
                        </div>
                        <Switch checked={schedule} onChange={setSchedule} />
                      </div>
                      {schedule && (
                        <div>
                          <Label>Send Date & Time</Label>
                          <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                        </div>
                      )}
                      <div className="flex gap-3">
                        <Button className="flex-1" onClick={schedule ? () => scheduleSend("email") : () => sendNow("email")}>
                          <Send className="h-4 w-4" /> {schedule ? "Schedule" : "Send Now"}
                        </Button>
                        <Button variant="secondary" onClick={() => saveDraft("email")}>
                          <Save className="h-4 w-4" /> Draft
                        </Button>
                        <Button variant="ghost" onClick={() => openPreview("email")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-6 ">
                      <p className="mb-3 text-sm font-medium text-[#18181B] ">Email Preview</p>
                      <div className="max-h-[400px] overflow-auto rounded-2xl bg-white p-4 shadow-sm ">
                        <div className="space-y-4">
                          <div className="border-b border-[#E4E4E7] pb-3">
                            <p className="text-xs text-gray-400">From: {fromName || "SUSEJ Team"} &lt;no-reply@susej.com&gt;</p>
                            <p className="text-xs text-gray-400">To: [Recipient]</p>
                            <p className="mt-1 text-sm font-medium text-[#18181B] ">{subject || "Email Subject"}</p>
                          </div>
                          <div
                            className="prose prose-sm max-w-none text-sm text-gray-600"
                            dangerouslySetInnerHTML={{ __html: emailBody ? previewBody(emailBody) : "<p>Your email content will appear here</p>" }}
                          />
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium text-gray-400">TEMPLATES</p>
                        {emailTemplates.length === 0 && (
                          <p className="rounded-xl border border-dashed border-[#E4E4E7] px-3 py-2.5 text-xs text-gray-400">No email templates saved yet.</p>
                        )}
                        {emailTemplates.map((t) => (
                          <button
                            key={t.id}
                            className="w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2.5 text-left text-sm text-gray-500 transition-colors hover:border-[#6C3BFF]/40 hover:bg-[#6C3BFF]/5   "
                            onClick={() => { setSelectedTemplate(t.id); applyTemplate(t.id); }}
                          >
                            <span className="font-medium text-[#18181B] ">{t.name}</span>
                            <p className="mt-0.5 text-xs text-gray-400">{t.preview}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {active === "banner" && (
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div>
                        <Label>Banner Text</Label>
                        <Input placeholder="e.g. Site maintenance on Sunday 2AM-4AM" value={bannerText} onChange={(e) => setBannerText(e.target.value)} />
                      </div>
                      <div>
                        <Label>Link URL (optional)</Label>
                        <Input placeholder="https://..." value={bannerLink} onChange={(e) => setBannerLink(e.target.value)} />
                      </div>
                      <div>
                        <Label>Target Audience</Label>
                        <Select options={audienceOptions} value={audience} onChange={(e) => setAudience(e.target.value as AudienceSegment)} />
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-[#FAFAFA] px-4 py-3 ">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-500">Schedule for later</span>
                        </div>
                        <Switch checked={schedule} onChange={setSchedule} />
                      </div>
                      {schedule && (
                        <div>
                          <Label>Publish Date & Time</Label>
                          <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                        </div>
                      )}
                      <div className="flex gap-3">
                        <Button className="flex-1" onClick={schedule ? () => scheduleSend("banner") : () => sendNow("banner")}>
                          <Megaphone className="h-4 w-4" /> {schedule ? "Schedule" : "Publish Now"}
                        </Button>
                        <Button variant="secondary" onClick={() => saveDraft("banner")}>
                          <Save className="h-4 w-4" /> Draft
                        </Button>
                        <Button variant="ghost" onClick={() => openPreview("banner")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-6 ">
                      <p className="mb-3 text-sm font-medium text-[#18181B] ">Banner Preview</p>
                      <div className="rounded-2xl bg-[#6C3BFF] p-4 text-white shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Megaphone className="h-4 w-4" />
                            <p className="text-sm font-medium">{bannerText || "Your announcement text"}</p>
                          </div>
                          {bannerLink && <Badge variant="primary">Learn More</Badge>}
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium text-gray-400">TEMPLATES</p>
                        {templates.filter((t) => t.channel === "banner").length === 0 && (
                          <p className="rounded-xl border border-dashed border-[#E4E4E7] px-3 py-2.5 text-xs text-gray-400">No banner templates saved yet.</p>
                        )}
                        {templates.filter((t) => t.channel === "banner").map((t) => (
                          <button
                            key={t.id}
                            className="w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2.5 text-left text-sm text-gray-500 transition-colors hover:border-[#6C3BFF]/40 hover:bg-[#6C3BFF]/5   "
                            onClick={() => { setSelectedTemplate(t.id); applyTemplate(t.id); }}
                          >
                            <span className="font-medium text-[#18181B] ">{t.name}</span>
                            <p className="mt-0.5 text-xs text-gray-400">{t.preview}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {active === "history" && (
                  <div>
                    {history.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <History className="mb-2 h-8 w-8 text-gray-300" />
                        <p className="text-sm text-gray-500">No notifications yet. Create your first one!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {history.map((item) => {
                          const Icon = channelIcon[item.channel];
                          const badge = statusBadge[item.status];
                          return (
                            <div key={item.id} className="flex items-center justify-between rounded-xl border border-[#E4E4E7] px-4 py-3 ">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FAFAFA] ">
                                  <Icon className="h-4 w-4 text-gray-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-[#18181B] ">{item.title}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">{item.audience}</span>
                                    <span className="text-xs text-gray-300">Â·</span>
                                    <span className="text-xs text-gray-400 capitalize">{item.channel}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {item.status === "scheduled" && item.scheduledFor && (
                                  <span className="text-xs text-gray-400">Scheduled for {formatDate(item.scheduledFor)}</span>
                                )}
                                {(item.status === "sent" || item.status === "logged") && item.sentAt && (
                                  <span className="text-xs text-gray-400">{formatDate(item.sentAt, "relative")}</span>
                                )}
                                <Badge variant={badge.variant}>{badge.label}</Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showPreview} onClose={() => setShowPreview(false)} title="Notification Preview" className="max-w-2xl">
        {previewChannel === "push" && (
          <div className="space-y-4">
            <div className="mx-auto max-w-xs rounded-3xl border border-[#E4E4E7] bg-white p-4 shadow-lg ">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6C3BFF] text-sm font-bold text-white">S</div>
                <div>
                  <p className="text-sm font-medium text-[#18181B] ">SUSEJ</p>
                  <p className="text-xs text-gray-400">just now</p>
                </div>
              </div>
              <p className="font-medium text-[#18181B] ">{title || "Notification Title"}</p>
              <p className="mt-1 text-sm text-gray-500">{message || "Your message here"}</p>
            </div>
          </div>
        )}
        {previewChannel === "email" && (
          <div className="rounded-2xl border border-[#E4E4E7] bg-white p-6 shadow-sm ">
            <div className="space-y-4">
              <div className="border-b border-[#E4E4E7] pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#6C3BFF] text-xs font-bold text-white">S</div>
                  <p className="text-sm font-medium text-[#18181B] ">{fromName || "SUSEJ Team"}</p>
                </div>
                <p className="mt-1 text-xs text-gray-400">to [Recipient]</p>
                <p className="mt-2 text-base font-semibold text-[#18181B] ">{subject || "Email Subject"}</p>
              </div>
              <div
                className="prose prose-sm max-w-none text-sm text-gray-600"
                dangerouslySetInnerHTML={{ __html: emailBody ? previewBody(emailBody) : "<p>No content</p>" }}
              />
              <div className="border-t border-[#E4E4E7] pt-4 text-center">
                <p className="text-xs text-gray-400">SUSEJ Marketplace</p>
                <p className="mt-1 text-xs text-gray-400">
                  <a href="#" className="text-[#6C3BFF]">Unsubscribe</a> from these emails
                </p>
              </div>
            </div>
          </div>
        )}
        {previewChannel === "banner" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#6C3BFF] p-5 text-white shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Megaphone className="h-5 w-5" />
                  <p className="font-medium">{bannerText || "Your announcement text"}</p>
                </div>
                {bannerLink && (
                  <span className="cursor-pointer rounded-full bg-white/20 px-3 py-1 text-xs font-medium">Learn More â†’</span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-6 text-center ">
              <p className="text-sm text-gray-500">The banner above will appear at the top of the page for selected audience.</p>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
