"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { apiPatch, apiPost } from "@/lib/api-mutate";
import { Save, Copy, Plus, Check, CheckCircle2, KeyRound } from "lucide-react";

interface AppSettingRow {
  key: string;
  value: unknown;
}

async function persistSetting(key: string, value: unknown) {
  try {
    await apiPatch("app-settings", key, { value });
  } catch {
    // key may not exist yet - create it
    await apiPost("app-settings", { key, value });
  }
}

// Loads every saved app-settings row so tabs hydrate real values instead of
// useState defaults (same pattern as the apiKeys tab).
function useSavedSettings(): Record<string, unknown> {
  const [saved, setSaved] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/data/app-settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        const next: Record<string, unknown> = {};
        for (const row of (body.rows as AppSettingRow[] | undefined) ?? []) {
          next[row.key] = row.value;
        }
        setSaved(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return saved;
}

function SaveChangesButton({ onSave }: { onSave: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function confirm() {
    setSaving(true);
    try {
      await onSave();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Button onClick={() => setOpen(true)}>
          <Save className="h-4 w-4" /> Save Changes
        </Button>
        {saved && <p className="text-sm text-[#16A34A]">Settings saved successfully!</p>}
      </div>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#16A34A]/10">
            <CheckCircle2 className="h-6 w-6 text-[#16A34A]" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[#18181B] ">Save Changes</h3>
          <p className="mt-2 text-sm text-gray-500">Are you sure you want to save these settings?</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={confirm} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

const tabs = [
  { label: "General", value: "general" },
  { label: "Security", value: "security" },
  { label: "Email", value: "email" },
  { label: "Storage", value: "storage" },
  { label: "API Keys", value: "api-keys" },
  { label: "Maintenance", value: "maintenance" },
];

function GeneralSettings() {
  const saved = useSavedSettings();
  const [siteName, setSiteName] = useState("SUSEJ");
  const [tagline, setTagline] = useState("Social Commerce Marketplace");
  const [supportEmail, setSupportEmail] = useState("support@susej.com");
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("utc");
  const [currency, setCurrency] = useState("inr");
  const [maintenance, setMaintenance] = useState(false);
  const [registrations, setRegistrations] = useState(true);
  const [guestCheckout, setGuestCheckout] = useState(true);

  useEffect(() => {
    if (typeof saved.siteName === "string") setSiteName(saved.siteName);
    if (typeof saved.tagline === "string") setTagline(saved.tagline);
    if (typeof saved.supportEmail === "string") setSupportEmail(saved.supportEmail);
    if (typeof saved.defaultLanguage === "string") setLanguage(saved.defaultLanguage);
    if (typeof saved.timezone === "string") setTimezone(saved.timezone);
    if (typeof saved.currency === "string") setCurrency(saved.currency);
    if (typeof saved.maintenanceMode === "boolean") setMaintenance(saved.maintenanceMode);
    if (typeof saved.allowNewRegistrations === "boolean") setRegistrations(saved.allowNewRegistrations);
    if (typeof saved.allowGuestCheckout === "boolean") setGuestCheckout(saved.allowGuestCheckout);
  }, [saved]);

  async function save() {
    await Promise.all([
      persistSetting("siteName", siteName),
      persistSetting("tagline", tagline),
      persistSetting("supportEmail", supportEmail),
      persistSetting("defaultLanguage", language),
      persistSetting("timezone", timezone),
      persistSetting("currency", currency),
      persistSetting("maintenanceMode", maintenance),
      persistSetting("allowNewRegistrations", registrations),
      persistSetting("allowGuestCheckout", guestCheckout),
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Site Name</Label><Input value={siteName} onChange={(e) => setSiteName(e.target.value)} /></div>
        <div><Label>Tagline</Label><Input value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
        <div><Label>Support Email</Label><Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} /></div>
        <div><Label>Default Language</Label><Select options={[{ label: "English", value: "en" }, { label: "Hindi", value: "hi" }, { label: "Spanish", value: "es" }]} value={language} onChange={(e) => setLanguage(e.target.value)} /></div>
        <div><Label>Timezone</Label><Select options={[{ label: "UTC", value: "utc" }, { label: "IST", value: "ist" }, { label: "EST", value: "est" }]} value={timezone} onChange={(e) => setTimezone(e.target.value)} /></div>
        <div><Label>Currency (locked to INR — money formatting is INR-only)</Label><Select options={[{ label: "INR (₹)", value: "inr" }]} value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
      </div>
      <Separator />
      <div className="space-y-4">
        <Switch label="Maintenance Mode" checked={maintenance} onChange={setMaintenance} />
        <Switch label="Allow New Registrations" checked={registrations} onChange={setRegistrations} />
        <Switch label="Allow Guest Checkout" checked={guestCheckout} onChange={setGuestCheckout} />
      </div>
      <SaveChangesButton onSave={save} />
    </div>
  );
}

function SecuritySettings() {
  const saved = useSavedSettings();
  const [timeoutMins, setTimeoutMins] = useState("60");
  const [maxAttempts, setMaxAttempts] = useState("5");
  const [require2fa, setRequire2fa] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [rateLimit, setRateLimit] = useState(true);

  useEffect(() => {
    if (typeof saved.sessionTimeout === "number") setTimeoutMins(String(saved.sessionTimeout));
    if (typeof saved.maxLoginAttempts === "number") setMaxAttempts(String(saved.maxLoginAttempts));
    if (typeof saved.require2faForAdmins === "boolean") setRequire2fa(saved.require2faForAdmins);
    if (typeof saved.loginAlerts === "boolean") setLoginAlerts(saved.loginAlerts);
    if (typeof saved.rateLimitApi === "boolean") setRateLimit(saved.rateLimitApi);
  }, [saved]);

  async function save() {
    await Promise.all([
      persistSetting("sessionTimeout", Number(timeoutMins) || 60),
      persistSetting("maxLoginAttempts", Number(maxAttempts) || 5),
      persistSetting("require2faForAdmins", require2fa),
      persistSetting("loginAlerts", loginAlerts),
      persistSetting("rateLimitApi", rateLimit),
    ]);
  }

  return (
    <div className="space-y-6">
      <p className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 text-xs text-[#92400E]">
        Recorded settings — session timeout, 2FA, login alerts and API rate limiting are saved but not enforced yet. Enforcement is on the security roadmap; do not rely on these toggles today.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Session Timeout (minutes)</Label><Input value={timeoutMins} onChange={(e) => setTimeoutMins(e.target.value)} type="number" /></div>
        <div><Label>Max Login Attempts</Label><Input value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} type="number" /></div>
      </div>
      <div className="space-y-4">
        <Switch label="Require 2FA for Admins" checked={require2fa} onChange={setRequire2fa} />
        <Switch label="Send Login Alerts" checked={loginAlerts} onChange={setLoginAlerts} />
        <Switch label="Rate Limit API Requests" checked={rateLimit} onChange={setRateLimit} />
      </div>
      <SaveChangesButton onSave={save} />
      <Rotate2faCard />
    </div>
  );
}

function Rotate2faCard() {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function rotate() {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login/rotate-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.code) {
        setError(body?.error ?? "Rotation failed.");
        return;
      }
      setCode(String(body.code));
      setPassword("");
    } catch {
      setError("Network error — code not rotated.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5">
      <h3 className="text-[14px] font-semibold text-[#18181B]">My 2FA code</h3>
      <p className="mt-1 text-[12px] text-[#71717A]">
        Seeded accounts share a bootstrap code — rotate it to a private one. The new code shows once; write it down.
      </p>
      {code ? (
        <div className="mt-3 rounded-xl bg-[#F4F4F5] p-4 text-center">
          <p className="text-[11px] text-[#71717A]">Your new 2FA code (shown once)</p>
          <p className="mt-1 text-[28px] font-bold tracking-[0.3em] text-[#18181B]">{code}</p>
          <button className="mt-2 text-[12px] font-medium text-[#6C3BFF]" onClick={() => setCode(null)}>I saved it — hide</button>
        </div>
      ) : (
        <div className="mt-3 flex items-end gap-3">
          <div className="flex-1">
            <Label>Current password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Confirm your password" />
          </div>
          <button
            disabled={!password || busy}
            onClick={rotate}
            className="h-9 shrink-0 rounded-[6px] bg-[#18181B] px-4 text-sm font-medium text-white outline-none disabled:opacity-40"
          >
            {busy ? "…" : "Rotate code"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-[12px] text-[#EF4444]">{error}</p>}
    </div>
  );
}

function EmailSettings() {
  const saved = useSavedSettings();
  const [smtpHost, setSmtpHost] = useState("smtp.sendgrid.net");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("apikey");
  const [smtpPass, setSmtpPass] = useState("SG.xxxxx");
  const [fromEmail, setFromEmail] = useState("noreply@susej.com");
  const [fromName, setFromName] = useState("SUSEJ");
  const [testEmailSent, setTestEmailSent] = useState(false);

  useEffect(() => {
    if (typeof saved.smtpHost === "string") setSmtpHost(saved.smtpHost);
    if (typeof saved.smtpPort === "number") setSmtpPort(String(saved.smtpPort));
    if (typeof saved.smtpUsername === "string") setSmtpUser(saved.smtpUsername);
    if (typeof saved.smtpPassword === "string" && saved.smtpPassword.length > 0) setSmtpPass(saved.smtpPassword);
    if (typeof saved.fromEmail === "string") setFromEmail(saved.fromEmail);
    if (typeof saved.fromName === "string") setFromName(saved.fromName);
  }, [saved]);

  async function save() {
    await Promise.all([
      persistSetting("smtpHost", smtpHost),
      persistSetting("smtpPort", Number(smtpPort) || 587),
      persistSetting("smtpUsername", smtpUser),
      persistSetting("smtpPassword", smtpPass),
      persistSetting("fromEmail", fromEmail),
      persistSetting("fromName", fromName),
    ]);
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[#18181B] ">SMTP Configuration</h3>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>SMTP Host</Label><Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} /></div>
        <div><Label>SMTP Port</Label><Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} type="number" /></div>
        <div><Label>Username</Label><Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} /></div>
        <div><Label>Password</Label><Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} /></div>
        <div><Label>From Email</Label><Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} /></div>
        <div><Label>From Name</Label><Input value={fromName} onChange={(e) => setFromName(e.target.value)} /></div>
      </div>
      <Separator />
      <h3 className="text-lg font-semibold text-[#18181B] ">Test Email (save-only — no SMTP send yet)</h3>
      <div className="flex items-end gap-4">
        <div className="flex-1"><Label>Send Test To</Label><Input placeholder="admin@susej.com" /></div>
        <Button variant="secondary" onClick={async () => {
          await save();
          setTestEmailSent(true);
        }}>Save Config</Button>
      </div>
      {testEmailSent && <p className="text-sm text-[#16A34A]">SMTP settings saved. No test email was sent — wire an SMTP provider to enable delivery.</p>}
      <SaveChangesButton onSave={save} />
    </div>
  );
}

function StorageSettings() {
  const saved = useSavedSettings();
  const [maxSize, setMaxSize] = useState("10");
  const [quality, setQuality] = useState("80");
  const [cdnUrl, setCdnUrl] = useState("https://cdn.susej.com");
  const [fileTypes, setFileTypes] = useState<string[]>(["jpg", "png", "gif", "webp", "pdf", "mp4"]);
  const allTypes = ["jpg", "png", "gif", "webp", "pdf", "mp4", "mp3", "zip", "docx", "xlsx", "svg"];

  useEffect(() => {
    if (typeof saved.maxUploadSize === "number") setMaxSize(String(saved.maxUploadSize));
    if (typeof saved.imageQuality === "number") setQuality(String(saved.imageQuality));
    if (typeof saved.cdnUrl === "string") setCdnUrl(saved.cdnUrl);
    if (Array.isArray(saved.allowedFileTypes)) {
      setFileTypes(saved.allowedFileTypes.filter((t): t is string => typeof t === "string"));
    }
  }, [saved]);

  function toggleType(type: string) {
    setFileTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function save() {
    await Promise.all([
      persistSetting("maxUploadSize", Number(maxSize) || 10),
      persistSetting("imageQuality", Number(quality) || 80),
      persistSetting("cdnUrl", cdnUrl),
      persistSetting("allowedFileTypes", fileTypes),
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Max Upload Size (MB)</Label><Input value={maxSize} onChange={(e) => setMaxSize(e.target.value)} type="number" /></div>
        <div><Label>Image Quality (%)</Label><Input value={quality} onChange={(e) => setQuality(e.target.value)} type="number" /></div>
        <div><Label>CDN URL</Label><Input value={cdnUrl} onChange={(e) => setCdnUrl(e.target.value)} /></div>
      </div>
      <div>
        <Label>Allowed File Types</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {allTypes.map((type) => {
            const selected = fileTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selected
                    ? "border-[#6C3BFF] bg-[#6C3BFF] text-white"
                    : "border-[#E4E4E7] bg-[#FAFAFA] text-gray-500 hover:border-gray-300   "
                }`}
              >
                {selected && <Check className="h-3.5 w-3.5" />}
                {type.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
      <SaveChangesButton onSave={save} />
    </div>
  );
}

interface ApiKeyEntry {
  name: string;
  key: string;
  lastUsed: string;
  permissions?: string[];
  expiresAt?: string | null;
  createdAt?: string;
}

function isApiKeyEntry(value: unknown): value is ApiKeyEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ApiKeyEntry).name === "string" &&
    typeof (value as ApiKeyEntry).key === "string" &&
    typeof (value as ApiKeyEntry).lastUsed === "string"
  );
}

function ApiKeysSettings() {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [permissions, setPermissions] = useState<string[]>(["read"]);
  const [expiration, setExpiration] = useState("30 days");
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/data/app-settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        const row = (body.rows as AppSettingRow[] | undefined)?.find((r) => r.key === "apiKeys");
        if (Array.isArray(row?.value)) {
          setKeys(row.value.filter(isApiKeyEntry));
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const permissionOptions = [
    { label: "Read", value: "read" },
    { label: "Write", value: "write" },
    { label: "Admin", value: "admin" },
  ];

  function togglePermission(value: string) {
    setPermissions((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  }

  function generateKey(): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let random = "";
    for (let i = 0; i < 28; i++) random += chars[Math.floor(Math.random() * chars.length)];
    return `susej_${random}`;
  }

  function handleCreate() {
    if (!keyName.trim()) return;
    const key = generateKey();
    // Permissions + expiry are persisted (previously chosen in the dialog then
    // silently dropped). Expiry is advisory until the API gateway enforces it.
    const next: ApiKeyEntry[] = [
      {
        name: keyName.trim(),
        key,
        lastUsed: "Never",
        permissions: [...permissions],
        expiresAt: expiration === "never" || expiration === "Never" ? null : expiration,
        createdAt: new Date().toISOString(),
      },
      ...keys,
    ];
    setKeys(next);
    void persistSetting("apiKeys", next);
    setNewKey(key);
    setKeyName("");
    setPermissions(["read"]);
    setExpiration("30 days");
  }

  function handleRevoke(name: string) {
    const next = keys.filter((k) => k.name !== name);
    setKeys(next);
    void persistSetting("apiKeys", next);
  }

  return (
    <div className="space-y-6">
      <p className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 text-xs text-[#92400E]">
        Keys are shown once at creation. The list below shows only the last 4 characters — there is no bulk reveal.
        Permissions and expiry are stored with each key; expiry is advisory until the API gateway enforces it.
      </p>
      {keys.length > 0 && (
        <div className="space-y-3">
          {keys.map((k, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-[#E4E4E7] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[#18181B] ">{k.name}</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-gray-500">••••{k.key.slice(-4)}</code>
                  <button title="Copy full key" onClick={() => navigator.clipboard.writeText(k.key)}><Copy className="h-3.5 w-3.5 text-gray-400" /></button>
                </div>
                <p className="mt-0.5 text-xs text-gray-400">
                  Last used: {k.lastUsed}
                  {(k.permissions?.length ?? 0) > 0 ? ` · ${k.permissions!.join(", ")}` : ""}
                  {k.expiresAt ? ` · expires ${k.expiresAt}` : ""}
                </p>
              </div>
              <Button variant="danger" size="sm" onClick={() => handleRevoke(k.name)}>Revoke</Button>
            </div>
          ))}
        </div>
      )}
      {loaded && keys.length === 0 && (
        <EmptyState
          icon={<KeyRound className="h-8 w-8 text-gray-300" />}
          title="No API keys issued yet"
          description="Generate an API key to grant programmatic access to the platform."
          className="py-8"
        />
      )}
      <Button variant="secondary" onClick={() => setDialogOpen(true)}>
        <Plus className="h-4 w-4" /> Add New Key
      </Button>

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setNewKey(null); }}>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[#18181B] ">Add New API Key</h3>
          {newKey ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#16A34A]/10">
                <CheckCircle2 className="h-6 w-6 text-[#16A34A]" />
              </div>
              <p className="mt-4 text-sm font-medium text-[#18181B] ">Key created successfully!</p>
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[#FAFAFA] px-4 py-3 ">
                <code className="truncate text-xs text-gray-600 ">{newKey}</code>
                <button onClick={() => navigator.clipboard.writeText(newKey)}>
                  <Copy className="h-4 w-4 text-gray-400" />
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">Copy it now — you won&apos;t be able to see it again.</p>
              <Button className="mt-5 w-full" onClick={() => setDialogOpen(false)}>Done</Button>
            </div>
          ) : (
            <>
              <div>
                <Label>Key Name</Label>
                <Input placeholder="e.g. Mobile App API Key" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
              </div>
              <div>
                <Label>Permissions</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {permissionOptions.map((opt) => {
                    const selected = permissions.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => togglePermission(opt.value)}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? "border-[#6C3BFF] bg-[#6C3BFF] text-white"
                            : "border-[#E4E4E7] bg-[#FAFAFA] text-gray-500 hover:border-gray-300   "
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Expiration</Label>
                <Select
                  options={[
                    { label: "30 days", value: "30 days" },
                    { label: "90 days", value: "90 days" },
                    { label: "1 year", value: "1 year" },
                    { label: "Never expires", value: "never" },
                  ]}
                  value={expiration}
                  onChange={(e) => setExpiration(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!keyName.trim()}>Create Key</Button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}

function MaintenanceSettings() {
  const saved = useSavedSettings();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("We are currently undergoing scheduled maintenance. Please check back shortly.");

  useEffect(() => {
    if (typeof saved.maintenanceMode === "boolean") setEnabled(saved.maintenanceMode);
    if (typeof saved.maintenanceMessage === "string") setMessage(saved.maintenanceMessage);
  }, [saved]);

  async function save() {
    await Promise.all([
      persistSetting("maintenanceMode", enabled),
      persistSetting("maintenanceMessage", message),
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border border-[#E4E4E7] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[#18181B] ">Maintenance Mode</p>
          <p className="text-xs text-gray-500">When enabled, only admins can access the platform</p>
        </div>
        <Switch checked={enabled} onChange={setEnabled} />
      </div>
      <Separator />
      <div>
        <Label>Maintenance Message</Label>
        <textarea className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-transparent p-3 text-sm outline-none focus:border-[#6C3BFF]" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <SaveChangesButton onSave={save} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#18181B] ">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Configure platform settings</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Platform Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs tabs={tabs}>
            {(active) => (
              <>
                {active === "general" && <GeneralSettings />}
                {active === "security" && <SecuritySettings />}
                {active === "email" && <EmailSettings />}
                {active === "storage" && <StorageSettings />}
                {active === "api-keys" && <ApiKeysSettings />}
                {active === "maintenance" && <MaintenanceSettings />}
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}