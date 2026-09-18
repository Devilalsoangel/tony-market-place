import { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, MapPinIcon, ChevronRightIcon, ShopIcon, BagIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useCart, DELIVERY_FEES, cartLineKey, type CartItem } from '../contexts/CartContext';
import { useOrders } from '../contexts/OrderContext';
import { resolveListingImage } from '../utils/productImages';
import { getAppliedPromo, setAppliedPromo, clearAppliedPromo, previewDiscount, type AppliedPromo } from '../utils/redeemedCoupons';
import { getSelectedAddress, SavedAddress } from './address-book';
import { getSelectedPayment, PaymentMethod } from './payment-methods';
import { getWallet, syncWalletFromServer } from '../utils/walletStore';
import { serverApi } from '../utils/serverApi';
import { useAuth } from '../contexts/AuthContext';


export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { cart: storeCart, subtotal: storeSubtotal, clearCart, updatePrices } = useCart();
  // Accepted-offer mode (chat deal → checkout): route params carry the struck
  // deal. The synthetic single-item cart ISOLATES the deal — the stored cart
  // is never touched, mixed, or cleared by an offer purchase (BUYER-C1).
  const offerParams = useLocalSearchParams<{
    offerListing?: string; offerPrice?: string; offerName?: string;
    offerThread?: string; offerMsg?: string; offerSeller?: string; offerSellerName?: string;
    offerType?: string;
  }>();
  const strParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const offerPrice = Math.round(Number(strParam(offerParams.offerPrice)));
  const offerMode =
    !!strParam(offerParams.offerListing) &&
    Number.isFinite(offerPrice) && offerPrice > 0 && offerPrice <= 10000000 &&
    !!strParam(offerParams.offerThread) && !!strParam(offerParams.offerMsg) &&
    !!strParam(offerParams.offerSeller);
  const offerItem: CartItem | null = offerMode
    ? {
        listingId: strParam(offerParams.offerListing),
        // Server resolves the fee from the listing type; the param carries it
        // so service offers preview 0 delivery like the server charges.
        type: (['product', 'service', 'food_item'] as const).includes(strParam(offerParams.offerType) as 'product') ? (strParam(offerParams.offerType) as CartItem['type']) : 'product',
        name: strParam(offerParams.offerName) || 'Accepted offer',
        price: offerPrice,
        quantity: 1,
        seller: strParam(offerParams.offerSellerName) || strParam(offerParams.offerSeller),
        sellerUsername: strParam(offerParams.offerSeller),
      }
    : null;
  // Whether the deal link carried an explicit listing type: when it didn't,
  // the 'product' above is a guess — revalidation adopts the live listing
  // type for the placement fee so a service deal never 400s on fee mismatch.
  const offerTypeGiven = (['product', 'service', 'food_item'] as const).includes(strParam(offerParams.offerType) as 'product');
  // Live listing type for the preview fee: the placement already adopts it,
  // but the preview lines used the guessed type (food deals previewed ₹12,
  // charged ₹30). Resolved once per checkout open.
  const [offerLiveFeeType, setOfferLiveFeeType] = useState<string | null>(null);
  // Typeless deal links must not be placeable while the live type is still
  // resolving: the preview shows the guessed fee meanwhile, and an instant
  // tap would buy against a number the server will not charge.
  const [resolvingFeeType, setResolvingFeeType] = useState(false);
  // Typeless-deal fee reconfirm: the mount fetch can fail while the
  // place-time revalidation succeeds — then the previewed fee (guessed
  // product) disagrees with the charge. First mismatch surfaces for review;
  // the second tap is informed consent.
  // Keyed by deal (listing:thread:msg) + live type: a reused screen instance
  // showing a different deal must re-confirm, never inherit.
  const feeConfirmedRef = useRef<string | null>(null);
  const feeConfirmKey = offerMode ? `${strParam(offerParams.offerListing)}:${strParam(offerParams.offerThread)}:${strParam(offerParams.offerMsg)}` : null;
  const cart = offerItem ? [offerItem] : storeCart;
  const subtotal = offerItem ? offerPrice : storeSubtotal;
  const { placeOrders } = useOrders();
  const { user } = useAuth();
  const username = user?.username ?? null;
  const [loaded, setLoaded] = useState(false);
  const [address, setAddress] = useState<SavedAddress | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);
  const [appliedPromo, setAppliedPromoState] = useState<AppliedPromo | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  // Live wallet figure for the payment row — the saved payment snapshot goes
  // stale the moment money moves anywhere else.
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        void syncWalletFromServer().catch(() => {});
        const [a, p, promo] = await Promise.all([getSelectedAddress(username), getSelectedPayment(), getAppliedPromo()]);
        try {
          const w = await getWallet();
          if (active) setWalletBalance(w.balance);
        } catch {}
        // Live fee type for typeless deal links (single-item offer cart):
        // without this the preview prices the guessed 'product' fee.
        if (active && offerMode && !offerTypeGiven && offerItem) {
          setOfferLiveFeeType(null);
          setResolvingFeeType(true);
          serverApi.getPost(offerItem.listingId).then((res) => {
            if (!active) return;
            const t = (res.data as { post?: { type?: unknown } } | null)?.post?.type;
            if (typeof t === 'string' && (t === 'service' || t === 'food_item' || t === 'product')) {
              setOfferLiveFeeType(t);
            }
          }).catch(() => {}).finally(() => {
            if (active) setResolvingFeeType(false);
          });
        } else if (active) {
          setResolvingFeeType(false);
        }
        if (active) {
          setAddress(a);
          setPayment(p);
          // Gatekeeper: only SERVER-listed coupon codes reach the order —
          // anything else (loyalty-local codes, stale/expired entries) dies
          // at the server with 400 and vaporizes the optimistic order. Clear
          // it here with an honest message instead of ambushing the buyer.
          if (promo) {
            try {
              const res = await serverApi.getCoupons();
              const list: Array<{ code: string; expiresAt?: string }> = (res.data as any)?.coupons ?? [];
              const known = list.some((c) => String(c.code).toUpperCase() === promo.code.toUpperCase());
              if (!known) {
                await clearAppliedPromo().catch(() => {});
                if (active) {
                  setAppliedPromoState(null);
                  setCouponError(
                    promo.code.startsWith('SUSEJ-')
                      ? 'Loyalty coupons are not accepted at checkout yet — they stay in My Coupons.'
                      : `Coupon ${promo.code} is no longer valid — it expired or was removed.`
                  );
                }
              } else if (active) {
                setAppliedPromoState(promo);
              }
            } catch {
              if (active) setAppliedPromoState(promo);
            }
          } else if (active) {
            setAppliedPromoState(promo);
          }
          setLoaded(true);
        }
      })().catch(() => {
        if (active) setLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [username, offerMode, offerTypeGiven, offerItem?.listingId])
  );

  const hasFood = cart.some((item) => item.type === 'food_item');
  const hasOnlyServices = cart.length > 0 && cart.every((item) => item.type === 'service');
  // Bundle carts reject coupons server-side (one price authority per order):
  // the promo is INERT here (preview 0, never forwarded) — same as offerMode.
  const hasBundle = cart.some((item) => !!(item as { bundleId?: string }).bundleId);
  const couponInert = offerMode || hasBundle;
  // Bookings carry no delivery fee (services are fulfilled, not shipped) —
  // same rule as OrderContext so preview, receipt, and server charge agree.
  // The placement leg sends the RAW (pre-coupon) fee: the server exact-matches
  // it against its own fee table (anti-tamper) and applies the coupon itself —
  // sending the post-coupon zeroed fee 400d every free-delivery order.
  // Offer mode without offerType: the guessed 'product' type mis-prices food
  // previews (₹12 shown, ₹30 charged) — the mount-resolved live type wins for
  // the preview exactly as it does for the placement below.
  const previewFeeType = offerMode && !offerTypeGiven && offerLiveFeeType
    ? offerLiveFeeType
    : hasOnlyServices ? 'service' : hasFood ? 'food_item' : 'product';
  // Component-scope (used by the preview lines AND the place-time reconfirm
  // above — a local const there was a TDZ crash).
  const feeForPreview = (t: string | undefined): number => {
    if (offerMode && !offerTypeGiven && offerLiveFeeType) t = offerLiveFeeType;
    return t === 'service' ? 0 : t === 'food_item' ? DELIVERY_FEES.food_item : DELIVERY_FEES.product;
  };
  const rawDelivery = cart.length > 0
    ? previewFeeType === 'service' ? 0 : previewFeeType === 'food_item' ? DELIVERY_FEES.food_item : DELIVERY_FEES.product
    : 0;
  // Free-delivery promos zero the fee line exactly like the cart screen.
  const delivery = appliedPromo?.freeDelivery && !couponInert ? 0 : rawDelivery;
  // Totals preview exactly what the SERVER charges at order time (subtotal +
  // delivery − server-mirror coupon estimate). The server stays truth at
  // placement; this is the buyer's pre-Pay figure, computed by the SAME
  // formula on cart and checkout.
  const promoDiscount = previewDiscount(subtotal, delivery, appliedPromo, couponInert);
  const total = Math.max(0, subtotal + delivery - promoDiscount);


  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    // Bundle carts reject coupons at placement — refuse the tap with the
    // reason instead of previewing a discount that 400s.
    if (hasBundle) {
      setCouponError('Coupons need a non-bundle cart — bundle deals already carry their own price.');
      return;
    }
    setCouponBusy(true);
    setCouponError(null);
    try {
      const res = await serverApi.getCoupons();
      const list: Array<{ code: string; type: string; value: number; expiresAt: string }> = (res.data as any)?.coupons ?? [];
      const found = list.find((c) => c.code.toUpperCase() === code);
      if (!found) {
        setCouponError('Invalid coupon code');
        return;
      }
      if (found.expiresAt && new Date(found.expiresAt).getTime() < Date.now()) {
        setCouponError('Coupon expired');
        return;
      }
      // Preview mirrors the SERVER settlement (orders route): flat/fixed =
      // rupees off, percent/percentage = subtotal %, free_delivery = fee off.
      // Anything else previews 0 (server is truth at placement). Stored face
      // amount never exceeds what the server honors (base−1).
      const previewBase = Math.round(subtotal) + Math.round(delivery);
      const rawAmount =
        found.type === 'flat' || found.type === 'fixed'
          ? found.value
          : found.type === 'percent' || found.type === 'percentage'
            ? Math.max(0, Math.round(((subtotal + delivery) * found.value) / 100))
            : 0;
      const promo: AppliedPromo = {
        code: found.code,
        amount: previewBase > 1 && !(found.type === 'free_delivery') ? Math.max(0, Math.min(rawAmount, previewBase - 1)) : rawAmount,
        freeDelivery: found.type === 'free_delivery',
        kind: found.type,
        value: found.value,
      };
      await setAppliedPromo(promo);
      setAppliedPromoState(promo);
      setCouponInput('');
      setCouponError(null);
    } catch {
      setCouponError('Could not validate coupon');
    } finally {
      setCouponBusy(false);
    }
  };

  const handleRemoveCoupon = async () => {
    await clearAppliedPromo().catch(() => {});
    setAppliedPromoState(null);
    setCouponError(null);
  };

  // Honest ETA: no courier/SLA source exists, so this is a planning estimate
  // only — the seller confirms the delivery date after accepting the order.
  const deliveryEta = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  })();

  const addressText = address
    ? `${address.type} • ${address.name} — ${address.street}, ${address.city} • ${address.phone}`
    : '';

  // NOTE: there is intentionally NO display-string payment variable here.
  // A previous build sent `Wallet · ₹X` as paymentMethod and the server
  // (exact match) skipped the debit while marking paid + crediting the
  // seller. The payment row below renders label+detail directly; the server
  // receives only the canonical payment.id (see handlePlaceOrder).

  const handlePlaceOrder = async () => {
    if (placingRef.current || cart.length === 0) return;
    // Fee-type gate (belt-and-braces behind the disabled button): a typeless
    // deal placed while the live type resolves would charge against a preview
    // the buyer never saw.
    if (offerMode && !offerTypeGiven && resolvingFeeType) return;
    if (!address) {
      router.push('/address-book');
      return;
    }
    if (!payment) {
      router.push('/payment-methods');
      return;
    }
    // Wallet payment: refresh from the server and verify balance ONLY.
    // The server-side order route handles the actual wallet debit atomically
    // inside a transaction — client-side debitWallet must NOT run here or
    // the buyer gets double-charged.
    if (payment.id === 'wallet') {
      await syncWalletFromServer().catch(() => {});
      const wallet = await getWallet();
      if (wallet.balance < total) {
        Alert.alert(
          'Insufficient wallet balance',
          `Your wallet has ${formatPrice(wallet.balance)} but this order costs ${formatPrice(total)}. Add money in the Wallet tab or choose another payment method.`
        );
        return;
      }
    }
    setPlacing(true);
    placingRef.current = true;
    // Industry-standard: revalidate cart prices against server truth BEFORE
    // charging. The cart freezes prices at add-time; a seller edit since then
    // must surface for re-confirmation, never charge silently.
    // Offer mode: the struck deal IS the price authority (server re-verifies
    // acceptance at placement) — only availability is checked, never the
    // live listing price, or every deal would false-positive as "changed".
    // Adopted live listing type for the placement fee (see feeToSend below).
    let offerLiveType = '';
    try {
      const fresh = await Promise.all(
        cart.map((item) =>
          serverApi.getPost(item.listingId).then((res) => {
            const post = (res.data as { post?: { price?: unknown; type?: unknown; isSold?: unknown; status?: unknown; stockLeft?: unknown; variants?: { name: string; priceDelta?: unknown; values: { label: string; stock?: unknown; priceDelta?: unknown }[] }[] } } | null)?.post;
            const gone = !res.ok || !post || post.isSold === true || (typeof post.status === 'string' && post.status !== 'published' && post.status !== 'active');
            const key = cartLineKey(item);
            const vlabel = String((item as { variantLabel?: string }).variantLabel ?? '');
            // Case-insensitive pick resolution (matches the server): seller
            // renames ("Size"→"size") must not false-negative into a scary
            // receipt when the server would accept the pick.
            let variantDelta = 0;
            let numericPick = false;
            let variantShort: string | null = null;
            let variantMissing = false;
            if (Array.isArray(post?.variants)) {
              const tracked = post.variants.some((g) => Array.isArray(g?.values) && g.values.some((x) => typeof x?.stock === 'number'));
              if (!vlabel) {
                // The server rejects unlabeled lines on tracked listings —
                // surface "pick an option" HERE, not as a 409 row.
                if (tracked && !gone) variantMissing = true;
              } else {
                const qty = item.quantity ?? 1;
                for (const part of vlabel.split(',').map((s) => s.trim()).filter(Boolean)) {
                  const ci = part.indexOf(':');
                  const g = (ci >= 0 ? part.slice(0, ci) : '').trim().toLowerCase();
                  const lab = (ci >= 0 ? part.slice(ci + 1) : part).trim().toLowerCase();
                  const grp = (post?.variants ?? []).find((v) => String(v?.name ?? '').trim().toLowerCase() === g);
                  const val = grp?.values.find((x) => String(x?.label ?? '').trim().toLowerCase() === lab);
                  if (val) {
                    const d = Number(val.priceDelta ?? 0);
                    if (Number.isFinite(d)) variantDelta += d;
                    if (typeof val.stock === 'number') {
                      numericPick = true;
                      if (qty > Math.floor(val.stock)) {
                        variantShort = String(val.label);
                        break;
                      }
                    } else if (qty > 1) {
                      // Untracked option = single unique item (server
                      // enforces 1 per value) — warn pre-charge.
                      variantShort = String(val.label);
                      break;
                    }
                  }
                }
              }
            }
            if (offerMode) {
              // Deal price is the authority (never the live listing price);
              // option coverage is still checked so a tracked-variant deal
              // fails HERE with guidance instead of a server 400 row.
              // Availability is NOT skipped: an accepted offer on stock that
              // sold out since must warn pre-charge like normal checkout.
              // liveType lets placement adopt the listing's real fee when the
              // deal link dropped its offerType param (else service deals
              // send the product fee and die on server exact-match).
              const sl = typeof post?.stockLeft === 'number' ? Math.floor(post.stockLeft) : null;
              if (typeof post?.type === 'string' && post.type) offerLiveType = post.type;
              return { id: item.listingId, key, price: item.price, gone, stock: numericPick ? null : sl, variantShort, variantMissing };
            }
            // Bundle lines: Bundle row is the price authority (server
            // re-prices at placement) — availability only, never compare.
            if (item.bundleId) {
              const sl = typeof post?.stockLeft === 'number' ? Math.floor(post.stockLeft) : null;
              return { id: item.listingId, key, price: item.price, gone, stock: sl, bundle: true as const };
            }
            if (vlabel) {
              // Variant lines reprice to variant truth (base + picked deltas):
              // the server charges base+delta now, so a stale cart delta must
              // surface for re-confirmation like any other price change.
              const base = res.ok && post ? Number(post.price) : NaN;
              const truth = Number.isFinite(base) ? base + variantDelta : NaN;
              // Base stockLeft does NOT gate variant lines the server tracks
              // per-value (it ignores base there); unknown/unlimited picks
              // fall back to the base gate exactly like the server.
              return { id: item.listingId, key, price: truth, gone, stock: numericPick ? null : (typeof post?.stockLeft === 'number' ? Math.floor(post.stockLeft) : null), variantShort, variantMissing };
            }
            // Stock truth: the server atomically reserves at placement and
            // 409s over-stock carts — surface "only N left" HERE pre-charge
            // instead of failing into a rejected order row.
            const sl = typeof post?.stockLeft === 'number' ? Math.floor(post.stockLeft) : null;
            return {
              id: item.listingId,
              key,
              price: res.ok && post ? Number(post.price) : NaN,
              gone,
              stock: sl,
              variantMissing,
            };
          })
        )
      );
      const gone = fresh.filter((f) => f.gone);
      if (gone.length > 0) {
        setPlacing(false);
        placingRef.current = false;
        Alert.alert(
          'No longer available',
          'An item in your cart was sold or removed by the seller. Remove it to continue.'
        );
        return;
      }
      const missing = fresh.filter((f) => (f as { variantMissing?: boolean }).variantMissing);
      if (missing.length > 0) {
        const first = missing[0];
        const name = cart.find((c) => cartLineKey(c) === first.key)?.name ?? 'An item';
        setPlacing(false);
        placingRef.current = false;
        Alert.alert(
          'Choose options',
          offerMode
            ? `“${name}” has options (size, color, …) — this deal can't complete without one. Confirm the option with the seller in chat, then order from the product page.`
            : `“${name}” has options (size, color, …) — pick one on the product page before ordering.`
        );
        return;
      }
      const variantGone = fresh.filter((f) => (f as { variantShort?: string | null }).variantShort);
      if (variantGone.length > 0) {
        const first = variantGone[0] as { key: string; variantShort: string };
        const name = cart.find((c) => cartLineKey(c) === first.key)?.name ?? 'An item';
        setPlacing(false);
        placingRef.current = false;
        Alert.alert(
          'Variant out of stock',
          `“${first.variantShort}” in “${name}” just went out of stock. Change the variant or remove it to continue.`
        );
        return;
      }
      const short = fresh.filter((f) => f.stock !== null && (cart.find((c) => cartLineKey(c) === f.key)?.quantity ?? 0) > (f.stock as number));
      if (short.length > 0) {
        const first = short[0];
        const left = first.stock as number;
        const name = cart.find((c) => cartLineKey(c) === first.key)?.name ?? 'An item';
        setPlacing(false);
        placingRef.current = false;
        Alert.alert(
          'Only a few left',
          left <= 0
            ? `“${name}” just went out of stock. Remove it to continue.`
            : `Only ${left} left of “${name}”. Lower the quantity in your cart to continue.`
        );
        return;
      }
      const truth: Record<string, number> = {};
      for (const f of fresh) {
        if ((f as { bundle?: boolean }).bundle) continue;
        if (Number.isFinite(f.price) && f.price >= 0) truth[f.key] = f.price;
      }
      const changed = updatePrices(truth);
      if (changed.length > 0) {
        setPlacing(false);
        placingRef.current = false;
        Alert.alert(
          'Prices updated',
          'The seller changed prices on some items in your cart. Review the new total before placing your order.'
        );
        return;
      }
      // Typeless-deal fee confirm: mount fetch failed but revalidation knows
      // the live type — never charge a fee the preview didn't show without
      // one explicit review tap. The confirm covers THIS deal + live type
      // only: a listing-type edit between taps re-arms the alert.
      if (offerMode && !offerTypeGiven && offerLiveType && feeConfirmedRef.current !== `${feeConfirmKey}:${offerLiveType}`) {
        const liveFee = feeForPreview(offerLiveType);
        if (liveFee !== rawDelivery) {
          setPlacing(false);
          placingRef.current = false;
          setOfferLiveFeeType(offerLiveType);
          Alert.alert(
            'Delivery fee confirmed',
            `This deal's delivery fee is ${formatPrice(liveFee)} (previewed ${formatPrice(rawDelivery)}). Review the updated total, then place again.`
          );
          feeConfirmedRef.current = `${feeConfirmKey}:${offerLiveType}`;
          return;
        }
      }
    } catch {
      // Revalidation is best-effort: offline checkout still places against
      // the cached cart (the server charges ITS price and rejects cheap-buys).
    }
    // Structured address fields let the server serialize a canonical, clean
    // shipping string — the prebuilt display text stays for local display only.
    // Canonical payment id ('wallet' | 'cod') — the server exact-matches it
    // for debit/routing. NEVER send paymentText (display copy with the
    // amount baked in): "Wallet · ₹X" !== "wallet" skipped the debit while
    // the order was still marked paid + seller credited (free-order hole).
    // Offer mode: no coupons ever stack with a struck deal (server 400s it),
    // and the offer lock rides along for server-side acceptance verification.
    // Bundle carts: same ban (one price authority per order).
  // Placement fee truth: the live listing type wins when the deal link
  // dropped its offerType (preview may still show the guessed fee — the
  // placement is what the server exact-matches, so it must be listing-truth).
  let feeToSend = rawDelivery;
  if (offerMode && !offerTypeGiven && offerLiveType) {
    feeToSend = feeForPreview(offerLiveType);
  }
    const created = await placeOrders(cart, addressText, payment.id, {
      deliveryFee: feeToSend,
      promoCode: couponInert ? undefined : appliedPromo?.code,
      discountEstimate: couponInert ? 0 : promoDiscount,
      addressParts: address
        ? { label: address.type, name: address.name, phone: address.phone, street: address.street, city: address.city }
        : undefined,
      ...(offerMode
        ? { offer: { threadId: strParam(offerParams.offerThread), messageId: strParam(offerParams.offerMsg) } }
        : {}),
    });
      if (!created || created.length === 0) {
        // placeOrders always returns the optimistic orders when the cart is
        // non-empty (guarded above), so this is dead in practice — kept as a
        // fail-closed gate. NOTE: server rejects (bad coupon, OOS, funds)
        // arrive ASYNC and FLAG the order row with the reason (syncFailed) —
        // the receipt shows WHY instead of a not-found page; the coupon
        // gatekeeper above keeps that rare.
        // Order failed after wallet check: no debit occurred (server owns debit),
        // so do not synthesize a credit. Re-sync to ensure UI truth.
        void syncWalletFromServer().catch(()=>{});
        Alert.alert('Order failed', 'Could not place order. Please try again.');
        setPlacing(false);
        placingRef.current = false;
        return;
      }
    // The receipt carries the discount estimate (server settles the real
    // figure); a redeemed loyalty coupon stays spendable until the server
    // accepts a loyalty code. The promo marker is deliberately KEPT here:
    // placeOrders returns optimistic rows before the server acks, and a
    // later syncFailed would strand the buyer with neither order nor promo.
    // The mount gatekeeper revalidates (and clears) invalid codes, and the
    // server single-use-enforces spends — a kept promo can never double-spend.
    // Offer mode skips the cart clear — the stored cart belongs to another
    // purchase.
    if (!offerMode) {
      clearCart();
    }
    router.replace(`/order/${created[0].id}`);
  };

  if (!loaded) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color={colors.primaryContainer} />
      </View>
    );
  }

  if (cart.length === 0) {
    return (
      <View className="flex-1 bg-surface">
        <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
          <TouchableOpacity onPress={() => router.back()}>
            <BackIcon size={16} color={colors.primary} />
          </TouchableOpacity>
          <Text className="text-[20px] font-inter-700" style={{ lineHeight: 28, letterSpacing: -0.5, color: colors.primary }}>
            Checkout
          </Text>
          <View style={{ width: 16 }} />
        </View>
        <View className="flex-1 items-center justify-center px-8 pb-16">
          <ShopIcon size={56} color={colors.textSecondary} />
          <Text className="text-[18px] font-inter-600 text-textPrimary mt-5 mb-2" style={{ lineHeight: 28 }}>
            Your cart is empty
          </Text>
          <Text className="text-[14px] font-inter-400 text-textSecondary text-center" style={{ lineHeight: 20 }}>
            Add items to your cart before checking out
          </Text>
          <TouchableOpacity
            className="px-8 py-3 rounded-full mt-6"
            style={{ backgroundColor: colors.primaryContainer }}
            onPress={() => router.replace('/(tabs)/feed')}
          >
            <Text className="text-[15px] font-inter-600 text-white">Browse Feed</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Header — h52 safe area */}
      <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-[20px] font-inter-700" style={{ lineHeight: 28, letterSpacing: -0.5, color: colors.primary }}>
          Checkout
        </Text>
        <View style={{ width: 16 }} />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 190, rowGap: 20 }}>
        {/* Delivery address */}
        <TouchableOpacity
          className="mx-5 rounded-[24px] p-4"
          style={{
            backgroundColor: colors.surfaceContainerLowest,
            borderWidth: 1.5,
            borderColor: address ? colors.surfaceContainer : colors.outlineVariant,
            shadowColor: colors.textPrimary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.04,
            shadowRadius: 20,
            elevation: 2,
          }}
          onPress={() => router.push('/address-book')}
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <MapPinIcon size={18} color={colors.primaryContainer} />
              <Text className="text-[15px] font-inter-700 text-textPrimary ml-2" style={{ lineHeight: 22 }}>
                Delivery Address
              </Text>
            </View>
            <ChevronRightIcon size={14} color={colors.textSecondary} />
          </View>
          {address ? (
            <>
              <Text className="text-[14px] font-inter-600 text-textPrimary" style={{ lineHeight: 20 }}>
                {address.type} • {address.name}
              </Text>
              <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>
                {address.street}
              </Text>
              <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>
                {address.city}
              </Text>
              <Text className="text-[13px] font-inter-500 text-textPrimary mt-1" style={{ lineHeight: 18 }}>
                {address.phone}
              </Text>
            </>
          ) : (
            <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>
              Add a delivery address to continue
            </Text>
          )}
        </TouchableOpacity>

        {/* Payment method */}
        <TouchableOpacity
          className="mx-5 rounded-[24px] p-4"
          style={{
            backgroundColor: colors.surfaceContainerLowest,
            borderWidth: 1.5,
            borderColor: payment ? colors.surfaceContainer : colors.outlineVariant,
            shadowColor: colors.textPrimary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.04,
            shadowRadius: 20,
            elevation: 2,
          }}
          onPress={() => router.push('/payment-methods')}
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <BagIcon size={18} color={colors.primaryContainer} />
              <Text className="text-[15px] font-inter-700 text-textPrimary ml-2" style={{ lineHeight: 22 }}>
                Payment Method
              </Text>
            </View>
            <ChevronRightIcon size={14} color={colors.textSecondary} />
          </View>
          {payment ? (
            <Text className="text-[14px] font-inter-500 text-textPrimary" style={{ lineHeight: 20 }}>
              {payment.label}{' '}
              <Text style={{ color: colors.textSecondary }}>
                {payment.id === 'wallet' && walletBalance !== null
                  ? `Balance ${formatPrice(walletBalance)}`
                  : payment.detail}
              </Text>
            </Text>
          ) : (
            <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>
              Choose how you want to pay
            </Text>
          )}
        </TouchableOpacity>

        {/* Order summary */}
        <View className="mx-5 rounded-[24px] p-4" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
          <Text className="text-[15px] font-inter-700 text-textPrimary mb-3" style={{ lineHeight: 22 }}>
            Order Summary
          </Text>
          <View style={{ rowGap: 14 }}>
            {cart.map((item) => (
              <View key={cartLineKey(item)} className="flex-row items-center">
                <View className="w-12 h-12 rounded-[12px] overflow-hidden mr-3" style={{ backgroundColor: colors.surfaceContainerLow }}>
                  <Image
                    source={resolveListingImage({ image: item.imageUrl }, item.listingId)}
                    className="w-full h-full"
                    style={{ width: 48, height: 48 }}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[14px] font-inter-500 text-textPrimary" style={{ lineHeight: 18 }} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-[12px] font-inter-400 text-textSecondary" style={{ lineHeight: 16 }}>
                    Sold by {item.seller} • Qty {item.quantity}
                  </Text>
                </View>
                <Text className="text-[14px] font-inter-600 text-textPrimary" style={{ lineHeight: 20 }}>
                  {formatPrice(item.price * item.quantity)}
                </Text>
              </View>
            ))}
          </View>

          <View className="h-[1px] my-4" style={{ backgroundColor: colors.surfaceContainerLow }} />

          <View style={{ rowGap: 10 }}>
            <View className="flex-row justify-between">
              <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>Subtotal</Text>
              <Text className="text-[14px] font-inter-500 text-textPrimary" style={{ lineHeight: 20 }}>{formatPrice(subtotal)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>Delivery Fee</Text>
              <Text className="text-[14px] font-inter-500 text-textPrimary" style={{ lineHeight: 20 }}>{formatPrice(delivery)}</Text>
            </View>
            {offerMode ? (
              <View className="px-3 py-2" style={{ borderRadius: 12, backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.success + '30' }}>
                <Text className="text-[13px] font-inter-600" style={{ color: colors.success }}>✓ Accepted offer locked at {formatPrice(offerPrice)}</Text>
                <Text className="font-inter-400 mt-0.5" style={{ fontSize: 11, color: colors.textSecondary }}>Struck deal — coupons can't combine. Verified with the seller at payment.</Text>
              </View>
            ) : appliedPromo ? (
              <View className="flex-row items-center justify-between px-3 py-2" style={{ borderRadius: 12, backgroundColor: hasBundle ? colors.surfaceContainer : colors.successBg, borderWidth: 1, borderColor: hasBundle ? colors.outlineVariant : colors.success + '30' }}>
                <Text className="text-[13px] font-inter-600" style={{ color: hasBundle ? colors.textSecondary : colors.success }}>
                  {hasBundle ? `${appliedPromo.code} saved — doesn't apply to bundle deals` : `✓ ${appliedPromo.code} applied${promoDiscount > 0 ? ` −${formatPrice(promoDiscount)}` : ''}`}
                </Text>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text className="text-[11px] font-inter-400" style={{ color: colors.textSecondary }}>Final bill at payment</Text>
                  <TouchableOpacity onPress={handleRemoveCoupon} className="px-3 py-1" style={{ borderRadius: 8, backgroundColor: colors.surfaceContainerLowest }}>
                    <Text className="text-[11px] font-inter-600" style={{ color: colors.error }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <View className="flex-row" style={{ gap: 8 }}>
                  <View className="flex-1" style={{ borderRadius: 12, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: couponError ? colors.error : colors.outlineVariant }}>
                    <TextInput value={couponInput} onChangeText={(t) => { setCouponInput(t.toUpperCase()); if (couponError) setCouponError(null); }} placeholder="Coupon code" placeholderTextColor={colors.placeholder} autoCapitalize="characters" className="px-4 h-11 font-inter-500" style={{ fontSize: 13, color: colors.textPrimary }} editable={!couponBusy} />
                  </View>
                  <TouchableOpacity onPress={handleApplyCoupon} disabled={!couponInput.trim() || couponBusy} className="px-5 h-11 items-center justify-center" style={{ borderRadius: 12, backgroundColor: !couponInput.trim() || couponBusy ? colors.disabled : colors.primaryContainer, opacity: !couponInput.trim() || couponBusy ? 0.5 : 1 }}>
                    <Text className="font-inter-600" style={{ fontSize: 13, color: colors.onPrimary }}>{couponBusy ? '...' : 'Apply'}</Text>
                  </TouchableOpacity>
                </View>
                {couponError ? <Text className="font-inter-400 mt-1" style={{ fontSize: 11, color: colors.error }}>{couponError}</Text> : <Text className="font-inter-400 mt-1" style={{ fontSize: 11, color: colors.textTertiary }}>Codes validated live from the platform.</Text>}
              </View>
            )}
            <View className="px-3 py-2" style={{ borderRadius: 12, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outlineVariant }}>
              <Text className="font-inter-600" style={{ fontSize: 12, color: colors.textPrimary }}>Typically arrives around {deliveryEta} · COD available</Text>
              <Text className="font-inter-400 mt-0.5" style={{ fontSize: 11, color: colors.textSecondary }}>Planning estimate, not guaranteed — seller confirms date after acceptance · Returns as per seller policy.</Text>
            </View>
            <View className="flex-row items-center px-3 py-2" style={{ borderRadius: 12, backgroundColor: colors.surfaceContainerLow }}>
              <Text className="font-inter-500" style={{ fontSize: 11, color: colors.textSecondary }}>🔒 128-bit SSL · Secure payment · Protected by susej · Wallet / COD</Text>
            </View>
            <View className="h-[1px]" style={{ backgroundColor: colors.surfaceContainerLow }} />
            <View className="flex-row justify-between">
              <Text className="text-[16px] font-inter-700 text-textPrimary" style={{ lineHeight: 24 }}>Total</Text>
              <Text className="text-[16px] font-inter-700" style={{ lineHeight: 24, color: colors.primary }}>{formatPrice(total)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fixed bottom bar — h55 + safe area */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 pt-3"
        style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.08, shadowRadius: 30, elevation: 10, paddingBottom: insets.bottom + 16 }}
      >
        <View className="flex-row items-center">
          <View className="flex-1 mr-4">
            <Text className="text-[12px] font-inter-400 text-textSecondary" style={{ lineHeight: 16 }}>Total</Text>
            <Text className="text-[20px] font-inter-700" style={{ lineHeight: 26, color: colors.primary }}>{formatPrice(total)}</Text>
          </View>
          <TouchableOpacity
            className="flex-row items-center justify-center"
            style={{ height: 55, flex: 1.4, borderRadius: 16, backgroundColor: (placing || resolvingFeeType) ? colors.disabled : colors.primaryContainer, shadowColor: colors.primaryContainer, shadowOffset: { width: 0, height: 4 }, shadowOpacity: (placing || resolvingFeeType) ? 0 : 0.2, shadowRadius: 6, elevation: (placing || resolvingFeeType) ? 0 : 4 }}
            disabled={placing || resolvingFeeType}
            onPress={handlePlaceOrder}
          >
            {placing ? (
              <ActivityIndicator size="small" color={colors.disabledText} />
            ) : resolvingFeeType ? (
              <Text className="text-white text-[16px] font-inter-600" style={{ lineHeight: 24 }} numberOfLines={1}>
                Confirming fee…
              </Text>
            ) : (
              <Text className="text-white text-[16px] font-inter-600" style={{ lineHeight: 24 }} numberOfLines={1}>
                {address && payment ? `Place Order · ${formatPrice(total)}` : 'Continue to Payment'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
