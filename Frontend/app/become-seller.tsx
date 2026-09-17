import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../utils/theme';
import { BackIcon, CheckIcon, CameraIcon, ShopIcon, StarIcon, LockArrowIcon, ArrowRightIcon } from '../utils/icons';
import { useAuth } from '../contexts/AuthContext';
import { sellerImages } from '../utils/screenImages';
import { CATEGORY_TREE } from '../utils/categories';
import { serverApi } from '../utils/serverApi';
import { uriToDataUrl, resolveImageUrl } from '../utils/mediaUpload';
import { getAdminUrl } from '../utils/adminSync';
import { MapLocationPicker, type PickedLocation } from '../components/MapLocationPicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Usernames approved as sellers — the profile dispatcher reads this so a
// brand-new seller (zero posts yet) gets a storefront, never the insta view.
const SELLERS_KEY = '@susej_sellers';

// Expo Go SDK 57 builds can be missing the expo-image-picker native module
// ('Cannot find native module ExponentImagePicker'); importing at module scope
// would redbox the whole screen. Lazy-load with a fallback instead.
type ImagePickerLike = typeof import('expo-image-picker');

function getImagePicker(): ImagePickerLike | null {
  try {
    return require('expo-image-picker') as ImagePickerLike;
  } catch {
    return null;
  }
}

// Become a Seller — 4-step wizard matching Stitch refs:
//   245:2151 Step 1 (hero + seller type) · 245:2718 Business Details ·
//   Store Location (live map, mandatory physical place) ·
//   245:2540 Identity Verification · 245:2627 Verification Success.
type Step = 1 | 2 | 3 | 4 | 5; // 5 = success view
type SellerType = 'individual' | 'business';
type IdType = 'aadhaar' | 'pan' | 'passport';

const SHOP_CATEGORIES_FALLBACK = CATEGORY_TREE.map((c) => c.label);

const BENEFITS = [
  { icon: 'post', title: 'Product Posts', desc: 'Your items become social posts with likes and comments.' },
  { icon: 'store', title: 'Built-in Storefront', desc: 'Automatic shop page with banner, deals and categories.' },
  { icon: 'lock', title: 'Safe Payments', desc: 'Escrow-protected transactions and buyer verification.' },
] as const;

function UserIcon({ size = 24, color = colors.primaryContainer }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill={color} />
    </Svg>
  );
}

function ImageIcon({ size = 24, color = colors.primaryContainer }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="2" fill="none" />
      <Circle cx="8.5" cy="8.5" r="1.5" stroke={color} strokeWidth="2" fill="none" />
      <Path d="M21 15.5l-5-5L5 21" stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

function TagIcon({ size = 24, color = colors.primaryContainer }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" fill={color} />
    </Svg>
  );
}

function ShieldIcon({ size = 24, color = colors.primaryContainer }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l8 3v6c0 5.25-3.4 10.04-8 11-4.6-.96-8-5.75-8-11V5l8-3z" stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
      <Path d="M8.5 12l2.5 2.5 4.5-4.5" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Wizard draft survives activity death: the Android camera intent can kill
// Expo mid-application (Vivo aggressive backgrounding), so every field is
// mirrored to storage and restored on remount instead of restarting from zero.
const DRAFT_KEY_BASE = '@susej_seller_draft';

// Identity fields that must never rest in device storage after the server
// acknowledges the application (the Seller row + documents carry them from
// then on). AsyncStorage is sandboxed but unencrypted — a rooted phone or a
// backup scrape turns a forever-kept PAN/bank/ID number into a breach.
const SENSITIVE_IDENTITY_KEYS = ['pan', 'bankAccount', 'idNumber', 'gstin', 'dob', 'nameOnId', 'aadhaar'];
// Hosted document URLs (ID photos, selfie-with-ID, proofs, logo): the admin
// Seller row + documents carry them server-side after ack. Keeping them in
// device storage alongside the numbers doubles the breach value for zero
// retry benefit (acked records are never refiled).
const SENSITIVE_DOC_URL_KEYS = ['idDocUrl', 'idBackUrl', 'addrProofUrl', 'gstCertUrl', 'logoUrl', 'selfieUrl', 'logo'];
const SENSITIVE_DOC_LIST_KEYS = ['documents', 'docs'];

/**
 * Scrub-on-ack: flip synced + strip sensitive identity fields from the stored
 * record AND its retry payload. Unsynced records keep everything (the mount
 * retry needs the full payload for first filing). A scrubbed record is never
 * silently refiled (see identityScrubbed guard) — if the server row ever
 * vanishes, the wizard offers a fresh application instead of filing an
 * incomplete one. Document URLs are stripped too (server holds them); only
 * the filed-doc labels + count stay for the tracker display.
 */
function scrubIdentityOnAck(a: Record<string, unknown>): Record<string, unknown> {
  const stripUrls = (o: Record<string, unknown>) => {
    for (const k of SENSITIVE_DOC_URL_KEYS) delete o[k];
    for (const k of SENSITIVE_DOC_LIST_KEYS) {
      const v = o[k];
      if (Array.isArray(v)) {
        o[`${k}Filed`] = v.length;
        o[k] = v.map((d) => (d && typeof d === 'object' ? { type: (d as any).type, label: (d as any).label, fileName: (d as any).fileName } : d));
      }
    }
  };
  const next: Record<string, unknown> = { ...a, synced: true, identityScrubbed: true };
  for (const k of SENSITIVE_IDENTITY_KEYS) delete next[k];
  stripUrls(next);
  const si = next.syncInput;
  if (si && typeof si === 'object' && !Array.isArray(si)) {
    const clean: Record<string, unknown> = { ...(si as Record<string, unknown>) };
    for (const k of SENSITIVE_IDENTITY_KEYS) delete clean[k];
    stripUrls(clean);
    next.syncInput = clean;
  }
  return next;
}

export default function BecomeSellerScreen() {
  const insets = useSafeAreaInsets();
  const { updateUser, user } = useAuth();
  // Draft is PER-ACCOUNT: a single shared key leaked one user's application
  // (shop name, category, ID document, selfie) into the next account's wizard.
  const draftKey = `${DRAFT_KEY_BASE}:${user?.username ?? 'anon'}`;
  const [step, setStep] = useState<Step>(1);
  const [sellerType, setSellerType] = useState<SellerType | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [about, setAbout] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  // Business sellers (step-1 card promises GST, PAN, bank details): collected
  // here. GSTIN rides taxId to the admin Seller row; PAN + bank ride the sync
  // payload to their Seller columns, then scrubIdentityOnAck strips every
  // identity number from device storage on ack — never kept at rest.
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  // Mandatory physical store location picked on the live map (ORDER: store
  // location != per-listing selling location; every shop pins ONE place).
  const [storeLoc, setStoreLoc] = useState<PickedLocation | null>(null);

  const [idType, setIdType] = useState<IdType>('aadhaar');
  const [aadhaar, setAadhaar] = useState('');
  const [idUploaded, setIdUploaded] = useState(false);
  const [idUri, setIdUri] = useState<string | null>(null);
  // Back side of the ID (address/signature side) — required for all ID types.
  const [idBackUri, setIdBackUri] = useState<string | null>(null);
  const [idBackUploaded, setIdBackUploaded] = useState(false);
  // CKYC identity binding: name exactly as printed on the ID + date of birth.
  // Prefilled from the profile; the admin matches these against the document.
  const [nameOnId, setNameOnId] = useState('');
  const [dob, setDob] = useState('');
  // Address proof: Aadhaar back doubles as PoA (toggleable); PAN/passport
  // holders must upload a separate proof (bill / rent / bank statement).
  const [useAadhaarAsAddress, setUseAadhaarAsAddress] = useState(true);
  const [addrProofUri, setAddrProofUri] = useState<string | null>(null);
  const [addrProofUploaded, setAddrProofUploaded] = useState(false);
  // Business-only KYC media: GST certificate (required) + store logo.
  // The logo becomes the admin Seller row logo; the selfie is identity-only
  // and never doubles as the logo anymore.
  const [gstCertUri, setGstCertUri] = useState<string | null>(null);
  const [gstCertUploaded, setGstCertUploaded] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [selfieAdded, setSelfieAdded] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [agreeVerify, setAgreeVerify] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Server-truth application status (industry: a pending verdict survives
  // reopen/relogin/reinstall — local updateUser({verification:'pending'}) alone
  // is wiped by the next reconcileIdentity pull, which is exactly how
  // "waiting progress" became untraceable).
  type ServerApplication = {
    id: string; businessName: string; category: string; status: string;
    submittedAt: number; docCount: number; verifiedDocs: number;
    lastDecision: { action: string; note: string; at: number } | null;
  };
  const [serverApp, setServerApp] = useState<ServerApplication | null>(null);
  const [serverAppLoaded, setServerAppLoaded] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  // Rejected sellers may file a fresh application (server upserts by
  // app_<username> and resets rejected -> pending for re-review).
  const [reapplying, setReapplying] = useState(false);
  const refreshServerApp = async () => {
    try {
      const res = await serverApi.getSellerApplication();
      if (res.ok) setServerApp(res.data?.application ?? null);
    } catch {}
    finally { setServerAppLoaded(true); }
  };
  // Per-field identity errors: shown under their own field, never as one
  // generic banner. Enabled for the step-3 form after the first Continue tap.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  // Section Y offsets for scrolling to the first faulty field on step 3.
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});

  // Shop Category chips come from the ADMIN-OWNED catalog in Postgres
  // (/api/app/categories) — a category added in the admin panel appears
  // here on the next visit. CATEGORY_TREE stays only as the offline fallback.
  const [adminCatLabels, setAdminCatLabels] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    serverApi.getCategories().then((res) => {
      if (!alive) return;
      if (res.ok && res.data?.categories?.length) {
        setAdminCatLabels(res.data.categories.map((c: { name: string }) => c.name));
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const shopCategories = adminCatLabels.length > 0 ? adminCatLabels : SHOP_CATEGORIES_FALLBACK;
  // One-shop-one-category: approved sellers cannot switch primary category via re-apply.
  const isCategoryLocked = user?.verification === 'approved' && !!user?.category;
  const lockedCategory = isCategoryLocked ? String(user!.category) : '';

  // If already approved, seed category from server truth and never allow drift.
  useEffect(() => {
    if (isCategoryLocked && !category) setCategory(lockedCategory);
    if (isCategoryLocked && category && category !== lockedCategory) setCategory(lockedCategory);
  }, [isCategoryLocked, lockedCategory]);

  // Restore the draft once per account (only resumes if real progress exists).
  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    if (!user?.username) return;
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(draftKey);
        if (raw && alive) {
          const d = JSON.parse(raw);
          // Draft TTL (abandoned PII must not rest forever): drafts older
          // than 7 days are purged instead of restored.
          if (typeof d.savedAt === 'number' && Date.now() - d.savedAt > 7 * 86400000) {
            AsyncStorage.removeItem(draftKey).catch(() => {});
            return;
          }
          // Self-heal legacy drafts: strip any stored identity numbers once
          // (older builds mirrored them). From here on they are never written.
          if (SENSITIVE_IDENTITY_KEYS.some((k) => d[k] !== undefined)) {
            const clean: Record<string, unknown> = { ...(d as Record<string, unknown>) };
            for (const k of SENSITIVE_IDENTITY_KEYS) delete clean[k];
            AsyncStorage.setItem(draftKey, JSON.stringify(clean)).catch(() => {});
          }
          if (d.sellerType) setSellerType(d.sellerType);
          if (d.businessName) setBusinessName(d.businessName);
          if (d.category && !isCategoryLocked) setCategory(d.category);
          else if (isCategoryLocked) setCategory(lockedCategory);
          if (d.about) setAbout(d.about);
          if (d.city) setCity(d.city);
          if (d.pincode) setPincode(d.pincode);
          if (d.gstin) setGstin(String(d.gstin));
          if (d.pan) setPan(String(d.pan));
          if (d.bankAccount) setBankAccount(String(d.bankAccount));
          if (typeof d.agreeTerms === 'boolean') setAgreeTerms(d.agreeTerms);
          if (d.idType) setIdType(d.idType);
          if (d.aadhaar) setAadhaar(String(d.aadhaar));
          if (d.idUri) { setIdUri(d.idUri); setIdUploaded(true); }
          if (d.idBackUri) { setIdBackUri(d.idBackUri); setIdBackUploaded(true); }
          if (d.nameOnId) setNameOnId(String(d.nameOnId));
          else if (user?.name) setNameOnId(String(user.name));
          if (d.dob) setDob(String(d.dob));
          if (typeof d.useAadhaarAsAddress === 'boolean') setUseAadhaarAsAddress(d.useAadhaarAsAddress);
          if (d.addrProofUri) { setAddrProofUri(d.addrProofUri); setAddrProofUploaded(true); }
          if (d.gstCertUri) { setGstCertUri(d.gstCertUri); setGstCertUploaded(true); }
          if (d.logoUri) setLogoUri(d.logoUri);
          if (d.selfieUri) { setSelfieUri(d.selfieUri); setSelfieAdded(true); }
          if (typeof d.agreeVerify === 'boolean') setAgreeVerify(d.agreeVerify);
          if (d.storeLoc && typeof d.storeLoc.lat === 'number') setStoreLoc(d.storeLoc);
          if (Number.isInteger(d.step) && d.step >= 1 && d.step <= 4 && (d.businessName || d.sellerType)) {
            setStep(d.step as Step);
          }
        }
      } catch {}
      finally { if (alive) setDraftLoaded(true); }
    })();
    return () => { alive = false; };
  }, [draftKey, user?.username, isCategoryLocked, lockedCategory]);

  // Refile applications whose admin-queue sync never acked (offline submit).
  // SINGLE owner (this effect only): an earlier second filer on the same
  // mount double-POSTed every offline filing. Runs once per account: replays
  // the stored payload (server upserts by app_<username>, so retries never
  // duplicate) and flips synced on ack.
  const [filingPending, setFilingPending] = useState(false);

  // Application status is server truth: fetch on every mount (reopen-safe).
  // Self-heal: a local record marked synced that the server no longer has
  // (deleted/DB swap) is refiled once — upsert by app_<username> makes the
  // retry idempotent, so progress can never strand silently again.
  // Username compare is lowercase: records store lowercased usernames, and a
  // raw-case compare stranded mixed-case owners' refiles silently.
  useEffect(() => {
    if (!user?.username) return;
    const meLower = user.username.trim().toLowerCase();
    let alive = true;
    (async () => {
      await refreshServerApp();
      if (!alive) return;
      try {
        const raw = await AsyncStorage.getItem('@susej_seller_applicants');
        const list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) return;
        const mine = list.find(
          (a: { username?: string; synced?: boolean; syncInput?: Record<string, unknown> }) =>
            String(a.username ?? '').trim().toLowerCase() === meLower && a.syncInput
        );
        if (!mine) return;
        const res = await serverApi.getSellerApplication().catch(() => null);
        if (!alive) return;
        if (res?.ok && !res.data?.application) {
          // Scrubbed records (identity already on the server) are never
          // silently refiled — offer a fresh application instead.
          if (mine && !(mine as { identityScrubbed?: boolean }).identityScrubbed) {
            if (alive) setFilingPending(true);
            const m = await import('../utils/adminSync');
            const ok = await m.syncSellerApplicant(
              mine.syncInput as Parameters<typeof m.syncSellerApplicant>[0]
            );
            if (ok && alive) {
              const next = list.map((a: { username?: string }) =>
                String(a.username ?? '').trim().toLowerCase() === meLower ? scrubIdentityOnAck(a as Record<string, unknown>) : a
              );
              await AsyncStorage.setItem('@susej_seller_applicants', JSON.stringify(next)).catch(() => {});
              await refreshServerApp();
              setFilingPending(false);
            } else if (alive) {
              setFilingPending(true);
            }
          } else if (alive) {
            setServerApp(null);
          }
        } else if (res?.ok) {
          setServerApp(res.data?.application ?? null);
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [user?.username]);

  // Approved on the server while away: leave the wizard for the store.
  useEffect(() => {
    if (serverAppLoaded && serverApp?.status === 'approved') {
      updateUser({ isSeller: true, verification: 'approved', role: 'both' });
      router.replace('/seller-dashboard-hub');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverAppLoaded, serverApp?.status]);

  const withdrawApplication = () => {
    Alert.alert(
      'Withdraw application?',
      'Your seller application and its documents will be removed. You can apply again anytime.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            setWithdrawing(true);
            try {
              const res = await serverApi.withdrawSellerApplication();
              if (res.ok) {
                const u = user?.username;
                try {
                  const raw = await AsyncStorage.getItem('@susej_seller_applicants');
                  const list = raw ? JSON.parse(raw) : [];
                  const next = Array.isArray(list) ? list.filter((a: { username?: string }) => a.username !== u) : [];
                  await AsyncStorage.setItem('@susej_seller_applicants', JSON.stringify(next));
                  if (u) await AsyncStorage.removeItem(`${DRAFT_KEY_BASE}:${u}`);
                } catch {}
                updateUser({ isSeller: false, verification: 'none', role: 'buyer' });
                setServerApp(null);
                setStep(1);
              } else {
                Alert.alert('Could not withdraw', res.error || 'Check your connection and try again.');
              }
            } catch {
              Alert.alert('Could not withdraw', 'Check your connection and try again.');
            } finally {
              setWithdrawing(false);
            }
          },
        },
      ]
    );
  };

  // Mirror every NON-SENSITIVE field to storage so a camera/picker bounce
  // costs seconds. ID numbers (PAN / bank / Aadhaar / GSTIN / DOB / name-on-ID)
  // are NEVER mirrored — vault rule: they live in memory only until submit
  // (the submit-time applicant record carries them, scrubbed on server ack).
  // A user who abandons mid-wizard leaves zero identity numbers at rest.
  useEffect(() => {
    if (!draftLoaded || !user?.username) return;
    const draft = JSON.stringify({
      savedAt: Date.now(),
      step, sellerType, businessName, category, about, city, pincode,
      agreeTerms, idType, idUri, idUploaded,
      idBackUri, idBackUploaded,
      useAadhaarAsAddress, addrProofUri, addrProofUploaded,
      gstCertUri, gstCertUploaded, logoUri,
      selfieUri, selfieAdded, agreeVerify, storeLoc,
    });
    AsyncStorage.setItem(draftKey, draft).catch(() => {});
  }, [draftLoaded, draftKey, step, sellerType, businessName, category, about, city, pincode, agreeTerms, idType, idUri, idUploaded, idBackUri, idBackUploaded, useAadhaarAsAddress, addrProofUri, addrProofUploaded, gstCertUri, gstCertUploaded, logoUri, selfieUri, selfieAdded, agreeVerify, storeLoc]);

  // Shared library picker for every KYC upload box (front / back / address
  // proof / GST certificate / logo). One code path, identical permission +
  // failure copy, so no box can silently behave differently.
  const pickImage = async (onPicked: (uri: string) => void) => {
    try {
      const ImagePicker = getImagePicker();
      if (!ImagePicker) {
        Alert.alert('Photo library unavailable', 'Document upload is not available in this preview build. Update Expo Go to enable it.');
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photo access needed', 'Allow photo library access to upload your document.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        onPicked(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Upload failed', "We couldn't open your photo library. Please try again.");
    }
  };

  const pickIdDocument = async () => {
    await pickImage((uri) => { setIdUri(uri); setIdUploaded(true); });
  };

  const pickIdBack = async () => {
    await pickImage((uri) => { setIdBackUri(uri); setIdBackUploaded(true); });
  };

  const pickAddrProof = async () => {
    await pickImage((uri) => { setAddrProofUri(uri); setAddrProofUploaded(true); });
  };

  const pickGstCert = async () => {
    await pickImage((uri) => { setGstCertUri(uri); setGstCertUploaded(true); });
  };

  const pickLogo = async () => {
    await pickImage((uri) => { setLogoUri(uri); });
  };

  const takeSelfie = async () => {
    try {
      const ImagePicker = getImagePicker();
      if (!ImagePicker) {
        Alert.alert('Camera unavailable', 'Camera capture is not available in this preview build. Update Expo Go to enable it.');
        return;
      }
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera access needed', 'Allow camera access to take your verification selfie.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setSelfieUri(result.assets[0].uri);
        setSelfieAdded(true);
      }
    } catch {
      Alert.alert('Camera failed', "We couldn't open the camera. Please try again.");
    }
  };

  // ---------- Step-3 identity validation (CKYC-shaped, per-field errors) ----------
  // Every fault returns { fieldKey: message }; the form renders each message
  // under its own field so the seller always knows exactly what is wrong.
  const FIELD_ORDER = [
    'nameOnId', 'dob', 'idNumber', 'idFront', 'idBack',
    'addrProof', 'gstCert', 'selfie', 'consent',
  ];

  const SECTION_FOR_FIELD: Record<string, string> = {
    nameOnId: 'sec_who', dob: 'sec_who',
    idNumber: 'sec_iddoc', idFront: 'sec_iddoc', idBack: 'sec_iddoc',
    addrProof: 'sec_address', gstCert: 'sec_business',
    selfie: 'sec_selfie', consent: 'sec_selfie',
  };

  const isSequentialDigits = (s: string) => {
    const runs = ['0123456789', '1234567890', '9876543210', '0987654321'];
    return runs.some((r) => r.includes(s));
  };

  const parseDob = (v: string): Date | null => {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v.trim());
    if (!m) return null;
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  };

  const ageOn = (birth: Date, now: Date) => {
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
    return age;
  };

  const formatDobInput = (t: string) => {
    const digits = t.replace(/[^0-9]/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  };

  const needsAddrUpload = idType !== 'aadhaar' || !useAadhaarAsAddress;

  const idNumberError = (): string | null => {
    const num = aadhaar.trim().toUpperCase();
    if (idType === 'aadhaar') {
      if (!/^\d{12}$/.test(num)) return 'Aadhaar must be exactly 12 digits';
      if (/^(\d)\1{11}$/.test(num) || isSequentialDigits(num)) {
        return "This number doesn't look like a real Aadhaar — check and re-enter";
      }
      return null;
    }
    if (idType === 'pan') {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(num)) return 'PAN looks like ABCDE1234F (5 letters, 4 digits, 1 letter)';
      return null;
    }
    if (!/^[A-Z][0-9]{7}$/.test(num)) return 'Passport looks like M0000000 (1 letter + 7 digits)';
    return null;
  };

  const validateStep3 = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (nameOnId.trim().length < 3) errs.nameOnId = 'Enter your full name exactly as printed on the ID';
    const birth = parseDob(dob);
    if (!birth) {
      errs.dob = 'Enter date of birth as DD-MM-YYYY';
    } else if (birth.getTime() > Date.now()) {
      errs.dob = 'Date of birth cannot be in the future';
    } else if (ageOn(birth, new Date()) < 18) {
      errs.dob = 'Sellers must be 18 or older';
    }
    const numErr = idNumberError();
    if (numErr) errs.idNumber = numErr;
    if (!idUploaded) errs.idFront = 'Upload the front of your document';
    if (!idBackUploaded) errs.idBack = 'Upload the back of your document';
    if (needsAddrUpload && !addrProofUploaded) errs.addrProof = 'Upload an address proof document';
    if (sellerType === 'business' && !gstCertUploaded) errs.gstCert = 'Upload your GST certificate';
    if (!selfieAdded) errs.selfie = 'Take a selfie holding your ID next to your face';
    if (!agreeVerify) errs.consent = 'Consent is required to verify your identity';
    return errs;
  };

  // A field error is visible once its field was touched or a Continue attempt
  // was made — the seller is never ambushed before interacting.
  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const scrollToField = (key: string) => {
    const sec = SECTION_FOR_FIELD[key];
    const y = sec ? sectionY.current[sec] : undefined;
    if (typeof y === 'number') {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
    }
  };

  const canContinue = () => {
    if (step === 1) return !!sellerType;
    if (step === 2) {
      const pin = pincode.trim();
      const pinOk = /^\d{6}$/.test(pin);
      // Business sellers must supply the tax identity the step-1 card
      // promises (GSTIN + PAN; bank account optional but collected).
      // GSTIN: 15 chars (2-digit state + 10-char PAN + entity/checksum).
      const bizOk =
        sellerType !== 'business' ||
        (/^[0-9A-Z]{15}$/i.test(gstin.trim()) &&
          /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(pan.trim()) &&
          (bankAccount.trim() === '' || /^\d{9,18}$/.test(bankAccount.trim())));
      return !!businessName.trim() && !!category && !!city.trim() && pinOk && city.trim().length >= 2 && agreeTerms && bizOk;
    }
    if (step === 3) {
      return Object.keys(validateStep3()).length === 0;
    }
    if (step === 4) {
      return !!storeLoc && !!storeLoc.label && storeLoc.label !== 'Resolving address…';
    }
    return false;
  };

  const handleNext = () => {
    // Step 3 validates per-field: every fault appears under its own field
    // and the view scrolls to the first one. The generic banner becomes a
    // count summary instead of the only signal.
    if (step === 3) {
      const errs = validateStep3();
      setFieldErrors(errs);
      setShowFieldErrors(true);
      const keys = FIELD_ORDER.filter((k) => errs[k]);
      if (keys.length > 0) {
        setError(`${keys.length} item${keys.length === 1 ? '' : 's'} need${keys.length === 1 ? 's' : ''} attention above`);
        scrollToField(keys[0]);
        return;
      }
      setError('');
      setStep(4);
      return;
    }
    if (!canContinue()) {
      setError('Please complete this step before continuing');
      return;
    }
    // No double-fire: rapid Submit taps used to run the whole upload+file
    // pipeline twice (duplicate hosted uploads + duplicate filings).
    if (submitting) return;
    setError('');
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else if (step === 4) {
      // REAL submission — no fake timers. The captured ID document + selfie are
      // uploaded to the admin panel FIRST; an application without its actual
      // verification media is rejected here so the admin queue never receives
      // a doc-less seller (logo + documents must always exist for review).
      setSubmitting(true);
      (async () => {
        try {
          // Every required file uploads FIRST; a single failure aborts so the
          // admin queue never receives a half-evidenced seller.
          const up = async (uri: string | null) =>
            uri ? serverApi.uploadBannerImage(await uriToDataUrl(uri)) : null;
          const idUp = await up(idUri);
          const backUp = await up(idBackUri);
          const addrUp = needsAddrUpload ? await up(addrProofUri) : null;
          const selfieUp = await up(selfieUri);
          const gstUp = sellerType === 'business' ? await up(gstCertUri) : null;
          const logoUp = logoUri ? await up(logoUri) : null;
          const mustHave: Array<[string, typeof idUp]> = [
            ['ID front', idUp],
            ['ID back', backUp],
            ['selfie', selfieUp],
          ];
          if (needsAddrUpload) mustHave.push(['Address proof', addrUp]);
          if (sellerType === 'business') mustHave.push(['GST certificate', gstUp]);
          const failed = mustHave.find(([, r]) => !r?.ok || !r.data?.url);
          if (failed) {
            Alert.alert(
              'Upload failed',
              `${failed[0]} could not be uploaded. Check your connection and try again.`
            );
            setSubmitting(false);
            return;
          }
          if (logoUri && (!logoUp?.ok || !logoUp.data?.url)) {
            Alert.alert(
              'Upload failed',
              'Store logo could not be uploaded. Check your connection and try again.'
            );
            setSubmitting(false);
            return;
          }
          // Upload returns a root-relative /uploads/... path — absolutize
          // against the admin base so documents render in every surface.
          const base = await getAdminUrl();
          const abs = (p: string) => resolveImageUrl(p, base);
          updateUser({
            isSeller: true,
            verification: 'pending',
            businessName: businessName.trim(),
            category: category.trim(),
            role: 'both',
          });
          // Register as a known seller so /seller/<username> routes to the
          // storefront even before the first post exists.
          const raw = await AsyncStorage.getItem(SELLERS_KEY);
          const list: string[] = raw ? JSON.parse(raw) : [];
          // Normalize to lowercase: the storefront check lowercases before
          // matching, so a mixed-case write routed sellers to the buyer
          // profile. Self-heals legacy mixed entries on every application.
          const normed = Array.from(new Set(list.map((s) => String(s).toLowerCase())));
          const u = String(user?.username || '').toLowerCase();
          if (u && !normed.includes(u)) {
            normed.push(u);
            await AsyncStorage.setItem(SELLERS_KEY, JSON.stringify(normed));
          } else if (normed.length !== list.length || list.some((s) => s !== String(s).toLowerCase())) {
            await AsyncStorage.setItem(SELLERS_KEY, JSON.stringify(normed));
          }
          // File the application for the in-app admin verification queue.
          const APPLICANTS_KEY = '@susej_seller_applicants';
          const idLabel = idType === 'aadhaar' ? 'Aadhaar' : idType === 'pan' ? 'PAN' : 'Passport';
          const docs = [
            idLabel,
            `${idLabel} back`,
            ...(needsAddrUpload ? ['Address proof'] : ['Aadhaar (address)']),
            ...(sellerType === 'business' ? ['GST certificate'] : []),
            'Selfie with ID',
          ];
          const aRaw = await AsyncStorage.getItem(APPLICANTS_KEY);
          let applicants: any[] = aRaw ? JSON.parse(aRaw) : [];
          if (!Array.isArray(applicants)) applicants = [];
          const nextApplicant = {
            username: u,
            name: user?.name || businessName.trim(),
            businessName: businessName.trim(),
            category: category.trim(),
            // synced flips true only when the admin queue acknowledges the
            // application (see below + mount retry). Until then the success
            // screen says so honestly instead of claiming receipt. syncInput
            // is the exact retry payload (server upserts by app_<username>).
            synced: false,
            syncInput: null as null | Record<string, unknown>,
            sellerType,
            // Business tax identity (step-1 card promise). GSTIN also rides
            // taxId to the admin Seller row; PAN + bank ride the sync payload
            // to their columns, then scrubIdentityOnAck strips them on ack.
            gstin: sellerType === 'business' ? gstin.trim().toUpperCase() : '',
            pan: sellerType === 'business' ? pan.trim().toUpperCase() : '',
            bankAccount: sellerType === 'business' ? bankAccount.trim() : '',
            submitted: 'Just now',
            docs,
            idType,
            idNumber: aadhaar.trim().toUpperCase(),
            nameOnId: nameOnId.trim(),
            dob: dob.trim(),
            idDocUrl: abs(idUp!.data!.url),
            idBackUrl: abs(backUp!.data!.url),
            addrProofUrl: addrUp?.data?.url ? abs(addrUp.data.url) : '',
            gstCertUrl: gstUp?.data?.url ? abs(gstUp.data.url) : '',
            logoUrl: logoUp?.data?.url ? abs(logoUp.data.url) : '',
            selfieUrl: abs(selfieUp!.data!.url),
            storeLat: storeLoc?.lat ?? null,
            storeLng: storeLoc?.lng ?? null,
            storeAddress: storeLoc?.label ?? '',
          };
          const idx = applicants.findIndex((a) => a.username === u);
          if (idx >= 0) applicants[idx] = nextApplicant;
          else applicants.push(nextApplicant);
          await AsyncStorage.setItem(APPLICANTS_KEY, JSON.stringify(applicants));
            // Keep the picked place for the create-post flow's optional
            // selling-location prefill (store != listing location).
            if (u) {
              await AsyncStorage.setItem(
                `@susej_store_location:${u}`,
                JSON.stringify({ lat: storeLoc!.lat, lng: storeLoc!.lng, label: storeLoc!.label })
              ).catch(() => {});
            }
            // Application filed - the draft has served its purpose.
            await AsyncStorage.removeItem(draftKey).catch(() => {});
          // Mirror to the admin panel verification queue, now WITH the real
          // uploaded document URLs + seller logo. The ack flips synced:true;
          // a mount-time retry (below) refiles anything still unsynced, so an
          // offline submit can never vanish silently.
          const syncPayload = {
              username: u,
              name: user?.name || businessName.trim(),
              businessName: businessName.trim(),
              category: category.trim(),
              taxId: sellerType === 'business' ? gstin.trim().toUpperCase() : undefined,
              pan: sellerType === 'business' ? pan.trim().toUpperCase() : undefined,
              bankAccount: sellerType === 'business' ? bankAccount.trim() || undefined : undefined,
              idType,
              idNumber: aadhaar.trim().toUpperCase(),
              nameOnId: nameOnId.trim(),
              dob: dob.trim(),
              selfieUrl: abs(selfieUp!.data!.url),
              docs,
              logo: logoUp?.data?.url ? abs(logoUp.data.url) : '',
              documents: [
                {
                  type: 'government_id',
                  label: idLabel,
                  fileName: 'id-document-front.jpg',
                  url: abs(idUp!.data!.url),
                },
                {
                  type: 'government_id_back',
                  label: `${idLabel} back`,
                  fileName: 'id-document-back.jpg',
                  url: abs(backUp!.data!.url),
                },
                ...(needsAddrUpload && addrUp?.data?.url
                  ? [
                      {
                        type: 'address_proof',
                        label: 'Address proof',
                        fileName: 'address-proof.jpg',
                        url: abs(addrUp.data.url),
                      },
                    ]
                  : []),
                ...(sellerType === 'business' && gstUp?.data?.url
                  ? [
                      {
                        type: 'gst_certificate',
                        label: 'GST certificate',
                        fileName: 'gst-certificate.jpg',
                        url: abs(gstUp.data.url),
                      },
                    ]
                  : []),
                {
                  type: 'additional',
                  label: 'Selfie with ID',
                  fileName: 'selfie-with-id.jpg',
                  url: abs(selfieUp!.data!.url),
                },
              ],
                storeLat: storeLoc?.lat ?? null,
                storeLng: storeLoc?.lng ?? null,
                storeAddress: storeLoc?.label ?? '',
          };
          // Persist the exact retry payload alongside the applicant record —
          // AWAITED before the sync below fires. The old floating promise let
          // the ack-scrub win the race and strand a synced:true record with no
          // payload (mount retries dead on both paths).
          try {
            const raw = await AsyncStorage.getItem(APPLICANTS_KEY);
            const list = raw ? JSON.parse(raw) : [];
            if (Array.isArray(list)) {
              const next = list.map((a: { username?: string }) =>
                a.username === u ? { ...a, syncInput: syncPayload } : a
              );
              await AsyncStorage.setItem(APPLICANTS_KEY, JSON.stringify(next)).catch(() => {});
            }
          } catch {}
          let syncOk = false;
          try {
            const m = await import('../utils/adminSync');
            syncOk = await m.syncSellerApplicant(syncPayload).catch(() => false);
          } catch {
            syncOk = false;
          }
          if (!syncOk) {
            setFilingPending(true);
          } else {
            try {
              const raw = await AsyncStorage.getItem(APPLICANTS_KEY);
              const list = raw ? JSON.parse(raw) : [];
              if (Array.isArray(list)) {
                const next = list.map((a: { username?: string }) =>
                  a.username === u ? scrubIdentityOnAck(a as Record<string, unknown>) : a
                );
                await AsyncStorage.setItem(APPLICANTS_KEY, JSON.stringify(next)).catch(() => {});
              }
            } catch {}
          }
          setSubmitting(false);
          setStep(5);
          // Seed the tracker so a reopen right after submit already shows it.
          void refreshServerApp();
        } catch {
          Alert.alert('Submission failed', 'Something went wrong while submitting. Please try again.');
          setSubmitting(false);
        }
      })();
    }
  };

  // Read a picked local image and encode it as a base64 data URL for upload.
  // (shared media pipeline: utils/mediaUpload.ts — one encoder for every screen)

  const StepDots = ({ current }: { current: number }) => (
    <View className="flex-row items-center mb-8" style={{ gap: 6 }}>
      {[1, 2, 3, 4].map((s) => (
        <View key={s} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: s <= current ? colors.primaryContainer : colors.surfaceContainer }} />
      ))}
    </View>
  );

  // Inline field error — the fault is named where it lives, never in a
  // detached banner the seller cannot map to a field.
  const FieldErr = ({ msg }: { msg?: string }) =>
    msg ? (
      <Text className="font-inter-500 text-error mt-1.5 mb-3" style={{ fontSize: 12, lineHeight: 16 }}>
        {msg}
      </Text>
    ) : null;

  const showErr = (key: string) => (showFieldErrors ? fieldErrors[key] : undefined);

  const SectionHead = ({ index, title, sub }: { index: string; title: string; sub: string }) => (
    <View className="flex-row items-start mt-6 mb-4">
      <View className="w-7 h-7 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.primaryContainer }}>
        <Text className="font-inter-700 text-white" style={{ fontSize: 13, lineHeight: 18 }}>
          {index}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
          {title}
        </Text>
        <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 12, lineHeight: 16 }}>
          {sub}
        </Text>
      </View>
    </View>
  );

  // One upload box for every KYC file slot (front / back / address / GST).
  // Same frame, same copy pattern, own inline error slot.
  const DocBox = ({
    title,
    hint,
    uri,
    uploaded,
    onPick,
    err,
  }: {
    title: string;
    hint: string;
    uri: string | null;
    uploaded: boolean;
    onPick: () => void;
    err?: string;
  }) => (
    <View className="mb-2">
      <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
        {title}
      </Text>
      <TouchableOpacity
        className="rounded-figma-16 p-5 items-center justify-center"
        style={{ borderWidth: 1, borderStyle: uri ? 'solid' : 'dashed', borderColor: err ? colors.error : colors.outlineVariant, backgroundColor: colors.surfaceContainerLow }}
        onPress={onPick}
      >
        {uri ? (
          <View className="items-center w-full">
            <Image source={{ uri }} className="w-full h-40 rounded-figma-12 mb-3" style={{ resizeMode: 'cover' }} />
            <View className="flex-row items-center">
              <CheckIcon size={15} color={colors.primaryContainer} />
              <Text className="font-inter-600 text-primaryContainer ml-1.5" style={{ fontSize: 13, lineHeight: 18 }}>
                Document uploaded
              </Text>
            </View>
            <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 12, lineHeight: 16 }}>
              Tap to replace
            </Text>
          </View>
        ) : (
          <View className="items-center">
            <CameraIcon size={26} color={colors.primaryContainer} />
            <Text className="font-inter-600 text-textPrimary mt-2" style={{ fontSize: 14, lineHeight: 18 }}>
              Upload document
            </Text>
            <Text className="font-inter-400 text-textSecondary mt-1 text-center" style={{ fontSize: 12, lineHeight: 16 }}>
              {hint} · JPEG or PNG (Max 5MB)
            </Text>
          </View>
        )}
      </TouchableOpacity>
      <FieldErr msg={err} />
    </View>
  );

  // Application tracker (reopen-safe): when the SERVER holds a verdict for
  // this account, it renders instead of a fresh wizard — pending progress is
  // traceable across reopen/relogin/reinstall, exactly the reported bug.
  const trackedStatus = serverApp?.status ?? (user?.isSeller && user?.verification === 'pending' ? 'pending' : null);
  const showTracker = serverAppLoaded && step !== 5 && !!trackedStatus && trackedStatus !== 'approved' && !reapplying;
  if (showTracker) {
    const rejected = trackedStatus === 'rejected';
    const submittedLabel = serverApp ? new Date(serverApp.submittedAt).toLocaleDateString() : 'Just now';
    return (
      <View className="flex-1 bg-surface">
        <View className="flex-row items-center justify-between px-5" style={{ height: 54 + insets.top, paddingTop: insets.top }}>
          <TouchableOpacity onPress={() => router.back()}>
            <BackIcon size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text className="font-inter-600 text-primary" style={{ fontSize: 18, lineHeight: 24 }}>
            Seller Application
          </Text>
          <View style={{ width: 20 }} />
        </View>
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
          <View className="rounded-figma-16 p-5 mt-4" style={{ backgroundColor: rejected ? '#fef2f2' : colors.surfaceContainerLow }}>
            <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 18, lineHeight: 24 }}>
              {rejected ? 'Application needs attention' : 'Application under review'}
            </Text>
            <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 13, lineHeight: 18 }}>
              {serverApp ? `${serverApp.businessName}${serverApp.category ? ` · ${serverApp.category}` : ''}` : 'Your application'} · Submitted {submittedLabel}
            </Text>
            {serverApp && (
              <Text className="font-inter-500 text-textSecondary mt-2" style={{ fontSize: 12, lineHeight: 16 }}>
                {serverApp.verifiedDocs}/{serverApp.docCount} documents verified
              </Text>
            )}
            {!serverApp && (
              <Text className="font-inter-500 text-textSecondary mt-2" style={{ fontSize: 12, lineHeight: 16 }}>
                Sending your application to the review queue…
              </Text>
            )}
          </View>
          {rejected && serverApp?.lastDecision?.note && (
            <View className="rounded-figma-16 p-5 mt-4" style={{ backgroundColor: colors.surfaceContainerLow }}>
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }}>Reviewer note</Text>
              <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 13, lineHeight: 18 }}>{serverApp.lastDecision.note}</Text>
            </View>
          )}
          <View className="rounded-figma-16 p-5 mt-4" style={{ backgroundColor: colors.surfaceContainerLow }}>
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }}>What happens next</Text>
            {['Our team reviews your documents (usually within 2 days).', 'You keep full buyer access while you wait.', 'Approval unlocks listings, orders and payouts.'].map((t) => (
              <View key={t} className="flex-row items-start mt-2">
                <CheckIcon size={15} color={colors.primaryContainer} />
                <Text className="font-inter-400 text-textSecondary ml-2 flex-1" style={{ fontSize: 13, lineHeight: 18 }}>{t}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            className="rounded-figma-16 p-4 items-center mt-6"
            style={{ backgroundColor: colors.primaryContainer }}
            onPress={() => { setServerAppLoaded(false); void refreshServerApp(); }}
          >
            <Text className="font-inter-600 text-white" style={{ fontSize: 15, lineHeight: 20 }}>Refresh status</Text>
          </TouchableOpacity>
          {rejected ? (
            <TouchableOpacity
              className="rounded-figma-16 p-4 items-center mt-3"
              style={{ borderWidth: 1, borderColor: colors.primaryContainer }}
              onPress={() => { setReapplying(true); setStep(1); }}
            >
              <Text className="font-inter-600 text-primaryContainer" style={{ fontSize: 15, lineHeight: 20 }}>Submit a new application</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className="rounded-figma-16 p-4 items-center mt-3"
              disabled={withdrawing}
              onPress={withdrawApplication}
            >
              <Text className="font-inter-600 text-error" style={{ fontSize: 15, lineHeight: 20 }}>
                {withdrawing ? 'Withdrawing…' : 'Withdraw application'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5" style={{ height: 54 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => (step > 1 ? setStep((step - 1) as Step) : router.back())}>
          <BackIcon size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text className="font-inter-600 text-primary" style={{ fontSize: 18, lineHeight: 24 }}>
          Become a Seller
        </Text>
        <View className="w-5" />
      </View>

      <ScrollView ref={scrollRef} className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}>
        {step === 1 && (
          <>
            {/* Hero illustration */}
            <View
              className="items-center justify-center"
              style={{ height: 190, borderRadius: 24, backgroundColor: colors.surfaceContainerLow, marginTop: 22, marginBottom: 20 }}
            >
              <View
                className="items-center justify-center"
                style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 }}
              >
                <ShopIcon size={40} color={colors.primaryContainer} />
              </View>
              <View
                className="items-center justify-center"
                style={{ position: 'absolute', top: 26, right: 44, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 }}
              >
                <TagIcon size={24} color={colors.primaryContainer} />
              </View>
              <View
                className="items-center justify-center"
                style={{ position: 'absolute', bottom: 28, left: 44, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 }}
              >
                <StarIcon size={24} color={colors.primaryContainer} />
              </View>
            </View>

            {/* Heading */}
            <Text className="font-inter-700 text-textPrimary text-center" style={{ fontSize: 26, lineHeight: 34 }}>
              Turn your passion into income
            </Text>
            <Text className="font-inter-400 text-textSecondary text-center mt-2 mb-6" style={{ fontSize: 14, lineHeight: 24 }}>
              Sell on susej, the marketplace built into a social network. Post products, follow trends, and grow your audience.
            </Text>

            {/* Benefits */}
            <View style={{ gap: 12 }}>
              {BENEFITS.map((b) => (
                <View
                  key={b.title}
                  className="flex-row items-center p-4"
                  style={{ borderRadius: 20, backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}
                >
                  <View className="items-center justify-center mr-3.5" style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainerLow }}>
                    {b.icon === 'post' ? (
                      <ImageIcon size={24} color={colors.primaryContainer} />
                    ) : b.icon === 'store' ? (
                      <ShopIcon size={24} color={colors.primaryContainer} />
                    ) : (
                      <ShieldIcon size={24} color={colors.primaryContainer} />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 16, lineHeight: 21 }}>
                      {b.title}
                    </Text>
                    <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 13, lineHeight: 18 }}>
                      {b.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Seller type */}
            <Text className="font-inter-600 text-textPrimary text-center mt-7 mb-3" style={{ fontSize: 15, lineHeight: 20 }}>
              Select your seller type
            </Text>
            <View style={{ gap: 12 }}>
              {([
                { id: 'individual', label: 'Individual Seller', desc: 'For solo sellers — Aadhaar + selfie verification', icon: 'user' },
                { id: 'business', label: 'Business', desc: 'For brands & companies — GST, PAN, bank details', icon: 'storefront' },
              ] as const).map((t) => {
                const on = sellerType === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    className="items-center justify-center"
                    style={{ minHeight: 128, borderRadius: 20, borderWidth: 2, borderColor: on ? colors.primary : colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, paddingVertical: 18, paddingHorizontal: 16 }}
                    onPress={() => {
                      setSellerType(t.id);
                      setError('');
                    }}
                  >
                    <View
                      className="items-center justify-center"
                      style={{ position: 'absolute', top: 14, right: 14, width: 24, height: 24, borderRadius: 12, backgroundColor: on ? colors.primaryContainer : colors.surfaceContainer }}
                    >
                      {on && <CheckIcon size={14} color={colors.onPrimary} />}
                    </View>
                    <View className="items-center justify-center" style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.surfaceContainerLow }}>
                      {t.icon === 'user' ? (
                        <UserIcon size={36} color={colors.primaryContainer} />
                      ) : (
                        <ShopIcon size={34} color={colors.primaryContainer} />
                      )}
                    </View>
                    <Text className="font-inter-600 text-textPrimary text-center mt-3" style={{ fontSize: 16, lineHeight: 22 }}>
                      {t.label}
                    </Text>
                    <Text className="font-inter-400 text-textSecondary text-center mt-1" style={{ fontSize: 12, lineHeight: 16 }}>
                      {t.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text className="font-inter-400 text-textSecondary text-center mt-5" style={{ fontSize: 12, lineHeight: 16 }}>
              By continuing you agree to our Seller Terms
            </Text>
          </>
        )}

        {step === 2 && (
          <>
            <Text className="font-inter-500 text-tertiary mt-2" style={{ fontSize: 12, lineHeight: 16 }}>
              Step 2 of 4
            </Text>
            <StepDots current={2} />
            <Text className="font-inter-700 text-textPrimary mb-1" style={{ fontSize: 22, lineHeight: 30 }}>
              Tell us about your shop
            </Text>
            <Text className="font-inter-400 text-textSecondary mb-6" style={{ fontSize: 14, lineHeight: 20 }}>
              This becomes your public storefront
            </Text>

            <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
              Official Store Name
            </Text>
            <View className="flex-row items-center px-4 mb-5" style={{ height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
              <TextInput
                className="flex-1 font-inter-400 text-textPrimary"
                style={{ fontSize: 14 }}
                placeholder="Elara Finds"
                placeholderTextColor={colors.secondary}
                value={businessName}
                onChangeText={setBusinessName}
              />
            </View>

            <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
              Shop Category (one category per shop){isCategoryLocked ? ' · Locked' : ''}
            </Text>
            {isCategoryLocked ? (
              <Text className="font-inter-400 mb-5" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
                Approved as {lockedCategory} — one category per shop. Contact support to change.
              </Text>
            ) : null}
            <View className="flex-row flex-wrap mb-5" style={{ gap: 8 }}>
              {shopCategories.map((c) => {
                const on = category === c;
                const disabled = isCategoryLocked && c !== lockedCategory;
                return (
                  <TouchableOpacity key={c} onPress={() => { if (!disabled) setCategory(c); }} disabled={disabled} className="px-4 py-2.5 rounded-full" style={{ backgroundColor: on ? colors.primaryContainer : colors.surfaceContainer, opacity: disabled ? 0.45 : 1 }}>
                    <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 18, color: on ? colors.onPrimary : colors.textPrimary }}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
              What do you sell?
            </Text>
            <View className="px-4 py-3 mb-5" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
              <TextInput
                className="font-inter-400 text-textPrimary"
                style={{ fontSize: 14, minHeight: 70, textAlignVertical: 'top' }}
                placeholder="Sustainable fashion and handcrafted accessories"
                placeholderTextColor={colors.secondary}
                value={about}
                onChangeText={setAbout}
                multiline
              />
            </View>

            <View className="flex-row mb-5" style={{ gap: 12 }}>
              <View className="flex-1">
                <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
                  City
                </Text>
                <View className="flex-row items-center px-4" style={{ height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
                  <TextInput className="flex-1 font-inter-400 text-textPrimary" style={{ fontSize: 14 }} placeholder="Mumbai" placeholderTextColor={colors.secondary} value={city} onChangeText={setCity} />
                </View>
              </View>
              <View className="flex-1">
                <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
                  Pincode
                </Text>
                <View className="flex-row items-center px-4" style={{ height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
                  <TextInput className="flex-1 font-inter-400 text-textPrimary" style={{ fontSize: 14 }} placeholder="400001" placeholderTextColor={colors.secondary} value={pincode} onChangeText={(t) => setPincode(t.replace(/[^0-9]/g, '').slice(0, 6))} keyboardType="number-pad" />
                </View>
              </View>
            </View>

            <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
              Store logo (optional)
            </Text>
            <TouchableOpacity className="flex-row items-center p-4 rounded-figma-16 mb-5" style={{ backgroundColor: colors.surfaceContainerLow }} onPress={pickLogo}>
              <View className="w-12 h-12 rounded-full mr-3 overflow-hidden items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
                {logoUri ? (
                  <Image source={{ uri: logoUri }} className="w-12 h-12 rounded-full" style={{ resizeMode: 'cover' }} />
                ) : (
                  <Text className="font-inter-700 text-primaryContainer" style={{ fontSize: 18 }}>
                    {(businessName.trim()[0] || 'S').toUpperCase()}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 18 }}>
                  {logoUri ? 'Logo picked' : 'Pick a logo for your shop'}
                </Text>
                <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 11, lineHeight: 15 }}>
                  Shown on your storefront and in admin review
                </Text>
              </View>
              <View className="px-3 py-2 rounded-figma-10" style={{ backgroundColor: colors.surfaceContainer }}>
                <Text className="font-inter-600 text-primaryContainer" style={{ fontSize: 11, lineHeight: 14 }}>
                  {logoUri ? 'Change' : 'Pick'}
                </Text>
              </View>
            </TouchableOpacity>

            {sellerType === 'business' && (
              <>
                <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
                  GSTIN
                </Text>
                <View className="flex-row items-center px-4 mb-5" style={{ height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
                  <TextInput className="flex-1 font-inter-400 text-textPrimary" style={{ fontSize: 14 }} placeholder="27ABCDE1234F1Z5" placeholderTextColor={colors.secondary} value={gstin} onChangeText={(t) => setGstin(t.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15))} autoCapitalize="characters" />
                </View>

                <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
                  PAN
                </Text>
                <View className="flex-row items-center px-4 mb-5" style={{ height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
                  <TextInput className="flex-1 font-inter-400 text-textPrimary" style={{ fontSize: 14 }} placeholder="ABCDE1234F" placeholderTextColor={colors.secondary} value={pan} onChangeText={(t) => setPan(t.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 10))} autoCapitalize="characters" />
                </View>

                <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
                  Bank account (for payouts, optional)
                </Text>
                <View className="flex-row items-center px-4" style={{ height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
                  <TextInput className="flex-1 font-inter-400 text-textPrimary" style={{ fontSize: 14 }} placeholder="Account number" placeholderTextColor={colors.secondary} value={bankAccount} onChangeText={(t) => setBankAccount(t.replace(/[^0-9]/g, '').slice(0, 18))} keyboardType="number-pad" />
                </View>
                <Text className="font-inter-400 text-textSecondary mt-1 mb-5" style={{ fontSize: 11, lineHeight: 15 }}>
                  9–18 digits. Payouts verify this account before the first transfer — a wrong number fails honestly there, not silently.
                </Text>
              </>
            )}

            <Text className="font-inter-600 text-textPrimary mb-1" style={{ fontSize: 15, lineHeight: 20 }}>
              Sell for less
            </Text>
            <Text className="font-inter-400 text-textSecondary mb-4" style={{ fontSize: 12, lineHeight: 16 }}>
              Flat 8% commission per sale. Promotions and ad boosts are pay-per-use from the wallet — no subscriptions, ever.
            </Text>

            <TouchableOpacity className="flex-row items-start mb-2" onPress={() => setAgreeTerms(!agreeTerms)}>
              <View className="w-5 h-5 rounded-md items-center justify-center mt-0.5" style={{ backgroundColor: agreeTerms ? colors.primaryContainer : colors.surfaceContainer }}>
                {agreeTerms && <CheckIcon size={13} color={colors.onPrimary} />}
              </View>
              <Text className="font-inter-400 text-textSecondary flex-1 ml-2.5" style={{ fontSize: 12, lineHeight: 17 }}>
                I agree to the Seller Terms — 8% commission per sale, pay-per-use promotions
              </Text>
            </TouchableOpacity>

            <TouchableOpacity className="mt-4 self-start" onPress={() => setStep(1)}>
              <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 18, color: colors.primaryContainer }}>
                ← Back
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <Text className="font-inter-500 text-tertiary mt-2" style={{ fontSize: 12, lineHeight: 16 }}>
              STEP 3 OF 4
            </Text>
            <StepDots current={3} />
            <Text className="font-inter-700 text-textPrimary mb-1" style={{ fontSize: 22, lineHeight: 30 }}>
              Verify your identity
            </Text>
            <Text className="font-inter-400 text-textSecondary mb-4" style={{ fontSize: 14, lineHeight: 20 }}>
              Government ID keeps the marketplace safe for everyone.
            </Text>
            <View className="flex-row items-center p-3 rounded-figma-12 mb-2" style={{ backgroundColor: colors.surfaceContainerLow }}>
              <LockArrowIcon size={15} color={colors.primaryContainer} />
              <Text className="font-inter-400 text-textSecondary ml-2 flex-1" style={{ fontSize: 12, lineHeight: 16 }}>
                Your data is encrypted and securely stored. We never share it publicly.
              </Text>
            </View>

            {/* Section 1 — who you are (CKYC personal details) */}
            <View onLayout={(e) => { sectionY.current.sec_who = e.nativeEvent.layout.y; }}>
              <SectionHead index="1" title="Your details" sub="Name exactly as printed on the ID" />
            </View>
            <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
              Full name (as on ID)
            </Text>
            <View className="flex-row items-center px-4" style={{ height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainer, borderWidth: showErr('nameOnId') ? 1 : 0, borderColor: colors.error }}>
              <TextInput
                className="flex-1 font-inter-400 text-textPrimary"
                style={{ fontSize: 14 }}
                placeholder="Aarav Sharma"
                placeholderTextColor={colors.secondary}
                value={nameOnId}
                onChangeText={(t) => { setNameOnId(t); clearFieldError('nameOnId'); }}
              />
            </View>
            <FieldErr msg={showErr('nameOnId')} />

            <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
              Date of birth
            </Text>
            <View className="flex-row items-center px-4 mb-2" style={{ height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainer, borderWidth: showErr('dob') ? 1 : 0, borderColor: colors.error }}>
              <TextInput
                className="flex-1 font-inter-400 text-textPrimary"
                style={{ fontSize: 14, letterSpacing: 2 }}
                placeholder="DD-MM-YYYY"
                placeholderTextColor={colors.secondary}
                value={dob}
                onChangeText={(t) => { setDob(formatDobInput(t)); clearFieldError('dob'); }}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
            <FieldErr msg={showErr('dob')} />

            {/* Section 2 — ID proof */}
            <View onLayout={(e) => { sectionY.current.sec_iddoc = e.nativeEvent.layout.y; }}>
              <SectionHead index="2" title="ID proof" sub="Choose a document and enter its number" />
            </View>
            {/* Segmented control */}
            <View className="flex-row p-1 mb-5" style={{ borderRadius: 14, backgroundColor: colors.surfaceContainer }}>
              {(['aadhaar', 'pan', 'passport'] as const).map((t) => {
                const on = idType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    className="flex-1 py-2.5 items-center"
                    style={{ borderRadius: 10, backgroundColor: on ? colors.surfaceContainerLowest : 'transparent' }}
                    onPress={() => {
                      if (t === idType) return;
                      // A new document means new number + new photos: never mix
                      // an Aadhaar front with a PAN number.
                      setIdType(t);
                      setAadhaar('');
                      setIdUri(null);
                      setIdUploaded(false);
                      setIdBackUri(null);
                      setIdBackUploaded(false);
                      setFieldErrors({});
                    }}
                  >
                    <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 18, color: on ? colors.primaryContainer : colors.textSecondary }}>
                      {t === 'aadhaar' ? 'Aadhaar' : t === 'pan' ? 'PAN' : 'Passport'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
              {idType === 'aadhaar' ? 'Aadhaar Number' : idType === 'pan' ? 'PAN Number' : 'Passport Number'}
            </Text>
            <View className="flex-row items-center px-4" style={{ height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainer, borderWidth: showErr('idNumber') ? 1 : 0, borderColor: colors.error }}>
              <TextInput
                className="flex-1 font-inter-400 text-textPrimary tracking-widest"
                style={{ fontSize: 14, letterSpacing: 2 }}
                placeholder={idType === 'aadhaar' ? '0000 0000 0000' : idType === 'pan' ? 'ABCDE1234F' : 'M0000000'}
                placeholderTextColor={colors.secondary}
                value={aadhaar}
                onChangeText={(t) => {
                  setAadhaar(t.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, idType === 'pan' ? 10 : idType === 'passport' ? 8 : 12));
                  clearFieldError('idNumber');
                }}
                autoCapitalize="characters"
                maxLength={idType === 'aadhaar' ? 12 : idType === 'pan' ? 10 : 8}
              />
            </View>
            <FieldErr msg={showErr('idNumber')} />

            {/* Section 3 — document photos: front + back, both required */}
            <SectionHead index="3" title="Document photos" sub="Front and back, clearly readable" />
            <DocBox
              title={`Front of ${idType === 'aadhaar' ? 'Aadhaar' : 'ID'}`}
              hint={`Front photo of your ${idType === 'aadhaar' ? 'Aadhaar' : idType === 'pan' ? 'PAN card' : 'passport'}`}
              uri={idUri}
              uploaded={idUploaded}
              onPick={pickIdDocument}
              err={showErr('idFront')}
            />
            <DocBox
              title={`Back of ${idType === 'aadhaar' ? 'Aadhaar' : 'ID'}`}
              hint={`Back photo showing the ${idType === 'aadhaar' ? 'address side' : 'signature side'}`}
              uri={idBackUri}
              uploaded={idBackUploaded}
              onPick={pickIdBack}
              err={showErr('idBack')}
            />

            {/* Section 4 — address proof (CKYC PoA) */}
            <View onLayout={(e) => { sectionY.current.sec_address = e.nativeEvent.layout.y; }}>
              <SectionHead index="4" title="Address proof" sub={idType === 'aadhaar' ? 'Your Aadhaar back already covers this' : 'PAN and passport carry no address — upload a proof'} />
            </View>
            {idType === 'aadhaar' ? (
              <TouchableOpacity className="flex-row items-start mb-2" onPress={() => setUseAadhaarAsAddress(!useAadhaarAsAddress)}>
                <View className="w-5 h-5 rounded-md items-center justify-center mt-0.5" style={{ backgroundColor: useAadhaarAsAddress ? colors.primaryContainer : colors.surfaceContainer }}>
                  {useAadhaarAsAddress && <CheckIcon size={13} color={colors.onPrimary} />}
                </View>
                <Text className="font-inter-400 text-textSecondary flex-1 ml-2.5" style={{ fontSize: 12, lineHeight: 17 }}>
                  Use my Aadhaar back side as address proof
                </Text>
              </TouchableOpacity>
            ) : null}
            {needsAddrUpload ? (
              <DocBox
                title="Address proof document"
                hint="Utility bill, rent agreement or bank statement (recent)"
                uri={addrProofUri}
                uploaded={addrProofUploaded}
                onPick={pickAddrProof}
                err={showErr('addrProof')}
              />
            ) : null}

            {sellerType === 'business' ? (
              <View onLayout={(e) => { sectionY.current.sec_business = e.nativeEvent.layout.y; }}>
                <SectionHead index="5" title="Business documents" sub="Required for brand & company sellers" />
                <DocBox
                  title="GST certificate"
                  hint="Photo or scan of your GST registration certificate"
                  uri={gstCertUri}
                  uploaded={gstCertUploaded}
                  onPick={pickGstCert}
                  err={showErr('gstCert')}
                />
              </View>
            ) : null}

            {/* Section — selfie + consent */}
            <View onLayout={(e) => { sectionY.current.sec_selfie = e.nativeEvent.layout.y; }}>
              <SectionHead index={sellerType === 'business' ? '6' : '5'} title="Selfie check" sub="Hold your ID next to your face" />
            </View>
            <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
              Selfie with ID
            </Text>
            <TouchableOpacity className="flex-row items-center p-4 rounded-figma-16 mb-5" style={{ backgroundColor: colors.surfaceContainerLow }} onPress={takeSelfie}>
              <View className="w-12 h-12 rounded-full mr-3 overflow-hidden items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
                {selfieUri ? (
                  <Image source={{ uri: selfieUri }} className="w-12 h-12 rounded-full" style={{ resizeMode: 'cover' }} />
                ) : (
                  <CameraIcon size={20} color={colors.primaryContainer} />
                )}
              </View>
              <View className="flex-1">
                <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 18 }}>
                  Take a selfie holding your ID next to your face
                </Text>
              </View>
              <View className="px-3 py-2 rounded-figma-10" style={{ backgroundColor: selfieAdded ? colors.primaryContainer : colors.surfaceContainer }}>
                {selfieAdded ? (
                  <CheckIcon size={15} color={colors.onPrimary} />
                ) : (
                  <Text className="font-inter-600 text-primaryContainer" style={{ fontSize: 11, lineHeight: 14 }}>
                    Take selfie
                  </Text>
                )}
              </View>
            </TouchableOpacity>
            <FieldErr msg={showErr('selfie')} />

            <TouchableOpacity className="flex-row items-start mb-2" onPress={() => { setAgreeVerify(!agreeVerify); clearFieldError('consent'); }}>
              <View className="w-5 h-5 rounded-md items-center justify-center mt-0.5" style={{ backgroundColor: agreeVerify ? colors.primaryContainer : colors.surfaceContainer }}>
                {agreeVerify && <CheckIcon size={13} color={colors.onPrimary} />}
              </View>
              <Text className="font-inter-400 text-textSecondary flex-1 ml-2.5" style={{ fontSize: 12, lineHeight: 17 }}>
                I consent to the verification of my {idType === 'aadhaar' ? 'Aadhaar details with UIDAI' : 'document details'} for identity establishment purposes.
              </Text>
            </TouchableOpacity>
            <FieldErr msg={showErr('consent')} />

            <Text className="font-inter-400 text-textSecondary mb-4" style={{ fontSize: 11, lineHeight: 15 }}>
              Documents are reviewed by our team before your store goes live
            </Text>

            <TouchableOpacity className="self-start" onPress={() => setStep(2)}>
              <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 18, color: colors.primaryContainer }}>
                ← Back
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 4 && (
          <>
            <Text className="font-inter-500 text-tertiary mt-2" style={{ fontSize: 12, lineHeight: 16 }}>
              STEP 4 OF 4
            </Text>
            <StepDots current={4} />
            <Text className="font-inter-700 text-textPrimary mb-1" style={{ fontSize: 22, lineHeight: 30 }}>
              Where is your store?
            </Text>
            <Text className="font-inter-400 text-textSecondary mb-4" style={{ fontSize: 14, lineHeight: 20 }}>
              Pin your physical shop location on the live map. Nearby buyers discover you faster and deliveries get matched to the right area.
            </Text>

            <MapLocationPicker value={storeLoc} onChange={setStoreLoc} />

            <TouchableOpacity className="mt-5 self-start" onPress={() => setStep(2)}>
              <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 18, color: colors.primaryContainer }}>
                ← Back
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 5 && (
          <>
            {/* Success — 245:2627 */}
            <View className="items-center mt-10 mb-6">
              <Image source={sellerImages.avatar} className="w-28 h-28 rounded-full mb-3" />
              <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: colors.primaryContainer, marginTop: -18, borderWidth: 3, borderColor: colors.surface }}>
                <CheckIcon size={18} color={colors.onPrimary} />
              </View>
              <Text className="font-inter-700 text-textPrimary mt-3" style={{ fontSize: 24, lineHeight: 32 }}>
                Application received!
              </Text>
              <Text className="font-inter-400 text-textSecondary text-center mt-1" style={{ fontSize: 14, lineHeight: 21 }}>
                {filingPending
                  ? 'Saved on this device — filing with our review team…'
                  : 'Your store is under review — selling unlocks once verified'}
              </Text>
            </View>

            {/* Getting started checklist */}
            <View className="p-5 rounded-figma-24" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
              <Text className="font-inter-700 text-textPrimary mb-4" style={{ fontSize: 15, lineHeight: 20 }}>
                Getting Started
              </Text>
              {[
                { label: 'Set up your storefront', sub: 'Unlocks after verification', done: false, locked: true },
                { label: 'Verify your identity', sub: 'Under review', done: false },
                { label: 'Publish your first product post', sub: 'Unlocks after verification', done: false, locked: true },
                { label: 'Earn your first follower', sub: null, done: false },
              ].map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  className="flex-row items-center py-3"
                  style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.surfaceContainer, opacity: (item as { locked?: boolean }).locked ? 0.6 : 1 }}
                  disabled={!(item as { route?: string }).route || (item as { locked?: boolean }).locked}
                  onPress={() => {
                    const r = (item as { route?: string }).route;
                    if (r && !(item as { locked?: boolean }).locked) router.push(r as any);
                  }}
                >
                  <View className="w-7 h-7 rounded-full items-center justify-center" style={{ backgroundColor: item.done ? colors.primaryContainer : colors.surfaceContainer }}>
                    {item.done ? <CheckIcon size={14} color={colors.onPrimary} /> : <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>{i + 1}</Text>}
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 18 }}>
                      {item.label}
                    </Text>
                    {item.sub && (
                      <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 11, lineHeight: 15 }}>
                        {item.sub}
                      </Text>
                    )}
                  </View>
                  {(item as { route?: string }).route && !(item as { locked?: boolean }).locked && <ArrowRightIcon size={16} color={colors.secondary} />}
                </TouchableOpacity>
              ))}
            </View>

            <View className="mt-6" style={{ gap: 10 }}>
              <TouchableOpacity className="h-14 rounded-figma-16 items-center justify-center" style={{ backgroundColor: colors.primaryContainer }} onPress={() => router.replace('/seller-dashboard-hub')}>
                <Text className="font-inter-600 text-white" style={{ fontSize: 15, lineHeight: 20 }}>
                  Go to My Store
                </Text>
              </TouchableOpacity>
              <TouchableOpacity className="h-14 rounded-figma-16 items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }} onPress={() => router.replace('/(tabs)/create')}>
                <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
                  Create first post
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {!!error && (
          <Text className="font-inter-500 text-error mt-4" style={{ fontSize: 13, lineHeight: 18 }}>
            {error}
          </Text>
        )}
      </ScrollView>

      {/* Fixed CTA */}
      {step < 5 && (
        <View className="px-5 pt-3 pb-2" style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceContainer }}>
          <TouchableOpacity
            className="h-14 rounded-figma-16 items-center justify-center"
            style={{ backgroundColor: canContinue() && !submitting ? colors.primaryContainer : colors.surfaceContainer }}
            disabled={(!canContinue() && step === 4) || submitting}
            onPress={handleNext}
          >
            <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: canContinue() ? colors.onPrimary : colors.textSecondary }}>
              {step === 4 ? (submitting ? 'Submitting…' : 'Submit for Review') : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}