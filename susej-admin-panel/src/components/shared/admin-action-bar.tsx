"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, FileQuestion } from "lucide-react";

interface AdminActionBarProps {
  status: "pending" | "approved" | "rejected";
  onApprove: () => void;
  onReject: (reason: string) => void;
  onRequestDocuments: (message: string) => void;
}

export function AdminActionBar({ status, onApprove, onReject, onRequestDocuments }: AdminActionBarProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [requestMessage, setRequestMessage] = useState("");

  if (status !== "pending") return null;

  return (
    <>
      <div className="space-y-3">
        <p className="text-sm font-medium text-[#18181B] ">Admin Actions</p>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={onApprove}>
            <CheckCircle className="h-4 w-4" /> Approve
          </Button>
          <Button variant="danger" onClick={() => setRejectOpen(true)}>
            <XCircle className="h-4 w-4" /> Reject
          </Button>
          <Button variant="secondary" onClick={() => setRequestOpen(true)}>
            <FileQuestion className="h-4 w-4" /> Request Documents
          </Button>
        </div>
      </div>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject Verification">
        <div className="space-y-4">
          <div>
            <Label>Reason for Rejection</Label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-1 h-24 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 text-sm outline-none focus:border-[#6C3BFF]  "
              placeholder="Explain why this seller was rejected..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!rejectReason.trim()}
              onClick={() => {
                onReject(rejectReason);
                setRejectOpen(false);
                setRejectReason("");
              }}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={requestOpen} onClose={() => setRequestOpen(false)} title="Request Additional Documents">
        <div className="space-y-4">
          <div>
            <Label>Message to Seller</Label>
            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              className="mt-1 h-24 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 text-sm outline-none focus:border-[#6C3BFF]  "
              placeholder="Tell the seller which documents are needed..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!requestMessage.trim()}
              onClick={() => {
                onRequestDocuments(requestMessage);
                setRequestOpen(false);
                setRequestMessage("");
              }}
            >
              Send Request
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
