"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatDate, formatNumber } from "@/lib/utils";
import {
  ArrowLeft, Users, FileText, MessageSquare, Flag, Pin, ShieldCheck,
  Lock, MessageCircleOff, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import Link from "next/link";
import type { Community } from "@/types";

const roleBadgeVariant: Record<string, "primary" | "success" | "warning" | "danger" | "default"> = {
  admin: "danger",
  moderator: "warning",
  member: "default",
};

export default function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: communities, refresh } = useDbResource<Community>("communities");
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [community, setCommunity] = useState<Community | null>(null);

  const fetched = useMemo(() => communities?.find((c) => c.id === id) ?? null, [communities, id]);

  useEffect(() => {
    if (fetched) setCommunity(fetched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetched]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!community) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Communities", href: "/dashboard/communities" }, { label: "Community" }]} />
        <EmptyState
          icon={<Users className="h-8 w-8 text-gray-300" />}
          title="Community not found"
          description={`No community exists with ID ${id}.`}
          action={
            <Link href="/dashboard/communities">
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4" /> Back to Communities
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  function patchCommunity(patch: Partial<Community>) {
    const current = community;
    if (!current) return;
    setCommunity({ ...current, ...patch });
    void fetch("/api/data/communities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, data: patch }),
    });
  }

  const bannedMembers = community.memberList.filter((m) => m.status === "banned");
  const pinnedPosts = community.postList.filter((p) => p.pinned);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Communities", href: "/dashboard/communities" }, { label: community.name }]} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#18181B] ">{community.name}</h1>
            <Badge variant={community.type === "public" ? "primary" : "default"}>
              {community.type === "public" ? "Public" : "Private"}
            </Badge>
            <StatusBadge status={community.status} />
            {community.reports > 0 && (
              <Badge variant="danger">
                <Flag className="mr-1 h-3 w-3" /> {community.reports} reports
              </Badge>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{community.description}</p>
          <p className="mt-1 text-xs text-gray-400">
            Owned by {community.ownerName} &middot; Created {formatDate(community.createdAt, "long")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {community.status === "active" ? (
            <Button variant="danger" onClick={() => setSuspendOpen(true)}>
              <AlertTriangle className="h-4 w-4" /> Suspend Community
            </Button>
          ) : (
            <Button variant="outline" onClick={() => patchCommunity({ status: "active" })}>
              <CheckCircle2 className="h-4 w-4" /> Reactivate
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4">
          <p className="text-sm text-gray-500">Members</p>
          <p className="text-xl font-bold text-[#18181B] ">{formatNumber(community.members)}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4">
          <p className="text-sm text-gray-500">Posts</p>
          <p className="text-xl font-bold text-[#18181B] ">{formatNumber(community.posts)}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4">
          <p className="text-sm text-gray-500">Reported Items</p>
          <p className="text-xl font-bold text-[#EF4444]">{community.reportedList.length}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4">
          <p className="text-sm text-gray-500">Banned Members</p>
          <p className="text-xl font-bold text-[#18181B] ">{bannedMembers.length}</p>
        </div>
      </div>

      {/* Moderation toggles */}
      <div className="flex items-center gap-8 rounded-xl border border-[#E4E4E7] bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <Lock className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-[#18181B] ">Lock Posting</p>
            <p className="text-xs text-gray-500">Members cannot create new posts</p>
          </div>
          <Switch checked={community.postingLocked} onChange={(v) => patchCommunity({ postingLocked: v })} />
        </div>
        <div className="flex items-center gap-3">
          <MessageCircleOff className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-[#18181B] ">Disable Comments</p>
            <p className="text-xs text-gray-500">Comments hidden on all posts</p>
          </div>
          <Switch checked={community.commentsDisabled} onChange={(v) => patchCommunity({ commentsDisabled: v })} />
        </div>
      </div>

      <Tabs
        tabs={[
          { label: "Members", value: "members" },
          { label: "Posts", value: "posts" },
          { label: "Comments", value: "comments" },
          { label: "Reported", value: "reported" },
          { label: "Pinned", value: "pinned" },
          { label: "Moderation Log", value: "modlog" },
        ]}
      >
        {(active) => (
          <>
            {active === "members" && (
              <Card>
                <CardHeader>
                  <CardTitle>Members ({community.memberList.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {community.memberList.map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#6C3BFF]/10 text-sm font-semibold text-[#6C3BFF]">
                            {m.name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#18181B] ">{m.name}</p>
                            <p className="text-xs text-gray-500">{m.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={roleBadgeVariant[m.role]}>{m.role}</Badge>
                          {m.status === "banned" && <Badge variant="danger">Banned</Badge>}
                          <span className="text-xs text-gray-400">Joined {formatDate(m.joinedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "posts" && (
              <Card>
                <CardHeader>
                  <CardTitle>Posts ({community.postList.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {community.postList.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                            <FileText className="h-4 w-4 text-[#6C3BFF]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#18181B] ">
                              {p.title} {p.pinned && <Pin className="ml-1 inline h-3.5 w-3.5 text-[#F59E0B]" />}
                            </p>
                            <p className="text-xs text-gray-500">
                              {p.authorName} &middot; {p.comments} comments &middot; {formatDate(p.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {p.hidden && <Badge variant="warning">Hidden</Badge>}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              patchCommunity({
                                postList: community.postList.map((x) => (x.id === p.id ? { ...x, hidden: !x.hidden } : x)),
                              })
                            }
                          >
                            {p.hidden ? "Unhide" : "Hide"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "comments" && (
              <Card>
                <CardHeader>
                  <CardTitle>Comments ({community.commentList.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {community.commentList.map((c) => (
                      <div key={c.id} className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                            <p className="text-sm font-medium text-[#18181B] ">{c.authorName}</p>
                            <span className="text-xs text-gray-400">on {c.postTitle}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {c.hidden && <Badge variant="warning">Hidden</Badge>}
                            <span className="text-xs text-gray-400">{formatDate(c.createdAt)}</span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">{c.text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "reported" && (
              <Card>
                <CardHeader>
                  <CardTitle>Reported Content ({community.reportedList.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {community.reportedList.length === 0 ? (
                    <EmptyState icon={<Flag className="h-8 w-8 text-gray-300" />} title="No reports" description="Nothing has been reported in this community." />
                  ) : (
                    <div className="space-y-3">
                      {community.reportedList.map((r) => (
                        <div key={r.id} className="flex items-center justify-between rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EF4444]/10">
                              <Flag className="h-4 w-4 text-[#EF4444]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium capitalize text-[#18181B] ">
                                {r.type} &middot; {r.reason}
                              </p>
                              <p className="text-xs text-gray-500">
                                Reported {r.reportCount}x by {r.reporterName}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {active === "pinned" && (
              <Card>
                <CardHeader>
                  <CardTitle>Pinned Posts ({pinnedPosts.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {pinnedPosts.length === 0 ? (
                    <EmptyState icon={<Pin className="h-8 w-8 text-gray-300" />} title="No pinned posts" description="Pin important posts so members see them first." />
                  ) : (
                    <div className="space-y-3">
                      {pinnedPosts.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F59E0B]/10">
                              <Pin className="h-4 w-4 text-[#F59E0B]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#18181B] ">{p.title}</p>
                              <p className="text-xs text-gray-500">{p.authorName} &middot; {p.comments} comments</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              patchCommunity({
                                postList: community.postList.map((x) => (x.id === p.id ? { ...x, pinned: false } : x)),
                              })
                            }
                          >
                            Unpin
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {active === "modlog" && (
              <Card>
                <CardHeader>
                  <CardTitle>Moderation Log ({community.moderationLog.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0">
                    {community.moderationLog.map((m, i) => (
                      <div key={m.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6C3BFF]/10">
                            {m.action.includes("ban") ? (
                              <XCircle className="h-4 w-4 text-[#EF4444]" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                            )}
                          </div>
                          {i < community.moderationLog.length - 1 && <div className="mt-1 w-px flex-1 bg-[#E4E4E7]" />}
                        </div>
                        <div className="flex-1 pb-6">
                          <p className="text-sm font-medium capitalize text-[#18181B] ">{m.action.replace("_", " ")}</p>
                          <p className="mt-0.5 text-sm text-gray-500">{m.note}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                            <ShieldCheck className="h-3 w-3" />
                            <span>{m.adminName}</span>
                            <span>&middot;</span>
                            <span>{formatDate(m.timestamp, "long")}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Tabs>

      {/* Suspend confirm */}
      {suspendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSuspendOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <AlertTriangle className="mx-auto h-10 w-10 text-[#EF4444]" />
            <h3 className="mt-3 text-center text-lg font-semibold text-[#18181B] ">Suspend {community.name}</h3>
            <p className="mt-2 text-center text-sm text-gray-500">
              The community becomes read-only for all members. This can be undone by reactivating.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setSuspendOpen(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => { patchCommunity({ status: "suspended" }); setSuspendOpen(false); }}>
                Suspend Community
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}