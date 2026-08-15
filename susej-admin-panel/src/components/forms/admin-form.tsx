"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import type { AdminUser } from "@/types";

interface AdminFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<AdminUser>) => void;
  editAdmin?: AdminUser | null;
}

const roleOptions = [
  { label: "Super Admin", value: "super_admin" },
  { label: "Manager", value: "manager" },
  { label: "Moderator", value: "moderator" },
];

function generatePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let pwd = "";
  for (let i = 0; i < 16; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

export function AdminForm({ open, onClose, onSave, editAdmin }: AdminFormProps) {
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("manager");
  const [active, setActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (editAdmin) {
      setName(editAdmin.name);
      setLoginId(editAdmin.loginId);
      setEmail(editAdmin.email || "");
      setPassword("");
      setRole(editAdmin.role);
      setActive(editAdmin.status === "active");
    } else {
      setName("");
      setLoginId("");
      setEmail("");
      setPassword(generatePassword());
      setRole("manager");
      setActive(true);
    }
    setShowPassword(false);
  }, [editAdmin, open]);

  function handleSave() {
    if (!name.trim() || !loginId.trim()) return;
    onSave({
      name: name.trim(),
      loginId: loginId.trim(),
      email: email.trim(),
      password: password || undefined,
      role: role as AdminUser["role"],
      status: active ? "active" : "inactive",
    });
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={editAdmin ? "Edit Admin" : "Add Admin"} className="max-w-md">
      <div className="space-y-4">
        <div>
          <Label>Full Name <span className="text-[#EF4444]">*</span></Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Rivera" />
        </div>
        <div>
          <Label>Admin ID <span className="text-[#EF4444]">*</span></Label>
          <Input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="e.g. alexrivera" />
          <p className="mt-1 text-xs text-gray-400">Used to log in to the panel along with the password</p>
        </div>
        {!editAdmin && (
          <div>
            <Label>Password</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="Auto-generated"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4E4E7] text-gray-400 hover:bg-gray-50 "
                onClick={() => setPassword(generatePassword())}
                title="Generate new password"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">Auto-generated. Click refresh to regenerate.</p>
          </div>
        )}
        <div>
          <Label>Email <span className="text-gray-400">(optional)</span></Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. alex@admin.com" type="email" />
          {!editAdmin && (
            <p className="mt-1 text-xs text-gray-400">If provided, the Admin ID and password will be sent to this email.</p>
          )}
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value)} options={roleOptions} />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[#E4E4E7] px-4 py-3 ">
          <div>
            <p className="text-sm font-medium text-[#18181B] ">Active</p>
            <p className="text-xs text-gray-500">Admin can access the panel</p>
          </div>
          <Switch checked={active} onChange={setActive} />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-3 border-t border-[#E4E4E7] pt-4 ">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={!name.trim() || !loginId.trim()}>
          {editAdmin ? "Save Changes" : "Add Admin"}
        </Button>
      </div>
    </Dialog>
  );
}
