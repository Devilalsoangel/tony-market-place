// CROSS-USER SYNC TEST — all users in one flow, every step checked from BOTH sides.
// Buyer: aaravkumar (9840000002) | Seller: riyasharma (9830000002)
const BASE = 'http://localhost:3000/api/app';
const KEY = { 'Content-Type': 'application/json', 'x-app-key': 'dev-key' };
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  -> ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  -> ' + detail : ''}`); }
};
async function api(token, path, method = 'GET', body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
async function otpLogin(phone) {
  const send = await api(null, '/auth', 'POST', { phone });
  const code = send.data?.devCode;
  if (!code) throw new Error(`no devCode for ${phone}: ${JSON.stringify(send.data)}`);
  const v = await api(null, '/auth/verify', 'POST', { phone, code });
  return { token: v.data.token, user: v.data.user };
}
(async () => {
  // ── 1. IDENTITY ──
  const buyer = await otpLogin('9840000002');
  const seller = await otpLogin('9830000002');
  ok('login buyer', buyer.user?.username === 'aaravkumar', `username=${buyer.user?.username} isSeller=${buyer.user?.isSeller}`);
  ok('login seller', seller.user?.username === 'riyasharma', `username=${seller.user?.username} isSeller=${seller.user?.isSeller}`);
  const meB = await api(buyer.token, '/users/me');
  const meS = await api(seller.token, '/users/me');
  ok('/users/me buyer matches login', meB.data?.user?.username === 'aaravkumar', JSON.stringify(meB.data?.user?.username));
  ok('/users/me seller matches login', meS.data?.user?.username === 'riyasharma', JSON.stringify(meS.data?.user?.username));

  // ── 2. FOLLOW SYNC (buyer POV vs seller POV) ──
  const f1 = await api(buyer.token, '/follows', 'POST', { followed: 'riyasharma' });
  ok('buyer follows seller', f1.data?.following === true, JSON.stringify(f1.data));
  const fl = await api(buyer.token, '/follows');
  ok('buyer follow list contains seller', Array.isArray(fl.data?.followed) && fl.data.followed.includes('riyasharma'), JSON.stringify(fl.data?.followed));
  const profAfterB = await api(buyer.token, `/users/${encodeURIComponent('riyasharma')}`);
  const profAfterS = await api(seller.token, `/users/${encodeURIComponent('riyasharma')}`);
  const cB = profAfterB.data?.user?.followerCount ?? profAfterB.data?.user?.followers;
  const cS = profAfterS.data?.user?.followerCount ?? profAfterS.data?.user?.followers;
  ok('followerCount buyer POV == seller POV', cB === cS, `buyerPOV=${JSON.stringify(cB)} sellerPOV=${JSON.stringify(cS)}`);
  const notif = await api(seller.token, '/notifications');
  ok('seller got follow notification', JSON.stringify(notif.data ?? '').includes('aarav'), JSON.stringify(notif.data).slice(0, 200));
  // â”€â”€ 3. ORDER SYNC (buyer buys â†’ seller pipeline + wallet math) â”€â”€
  const posts = await api(buyer.token, '/posts?seller=riyasharma');
  const post = posts.data?.posts?.[0];
  ok('seller has posts', !!post, post ? `id=${post.id} title=${post.title} price=${post.price}` : JSON.stringify(posts.data).slice(0, 120));
  if (post) {
    const w0 = await api(buyer.token, '/wallet');
    const bal0 = w0.data?.balance;
    const price = Number(post.price) || 0;
    const title = post.title || post.caption || post.name || 'Item';
    // Buyer tops up the wallet through the GATED endpoint (type: 'topup') —
    // the only way positive amounts are accepted.
    const top = await api(buyer.token, '/wallet', 'POST', { amount: 5000, title: 'Wallet top up', detail: 'cross-sync test topup', type: 'topup' });
    ok('buyer wallet topup accepted', top.status === 200 || top.status === 201, `status=${top.status} balance=${JSON.stringify(top.data)}`);
    const order = {
      id: `order_xsync_${Date.now()}`,
      orderNumber: `SB-XSYNC-${Date.now()}`,
      sellerUsername: 'riyasharma',
      sellerName: 'Riya Threadz',
      items: [{ postId: post.id, title, price, qty: 1, image: post.image }],
      total: price,
      chargedTotal: price,
      kind: 'product',
      status: 'placed',
      placedAt: new Date().toISOString(),
      address: 'Test cross-sync address',
      paymentMethod: 'wallet',
      deliveryFee: 0,
    };
    const placed = await api(buyer.token, '/orders', 'POST', order);
    ok('buyer places wallet order', placed.status === 200 || placed.status === 201, `status=${placed.status} ${JSON.stringify(placed.data).slice(0, 200)}`);
    const w1 = await api(buyer.token, '/wallet');
    const bal1 = w1.data?.balance;
    const bal0AfterTopup = Number(bal0) + 5000;
    ok('wallet debited exactly chargedTotal', bal1 != null && bal0AfterTopup - Number(bal1) === price, `topup-adjusted before=${bal0AfterTopup} after=${bal1} price=${price}`);
    const ob = await api(buyer.token, '/orders?mine=buyer');
    const oSeller = await api(seller.token, '/orders?mine=seller');
    // Server issues its own cuid — match by the unique orderNumber.
    const inBuyer = JSON.stringify(ob.data ?? '').includes(order.orderNumber);
    const inSeller = JSON.stringify(oSeller.data ?? '').includes(order.orderNumber);
    ok('order visible in buyer list', inBuyer, JSON.stringify(ob.data).slice(0, 120));
    ok('SAME order visible in seller list', inSeller, JSON.stringify(oSeller.data).slice(0, 200));
    const found = (oSeller.data?.orders ?? []).find((o) => o.orderNumber === order.orderNumber);
    ok('seller sees identical order content', !!found && String(found.total) === String(price), found ? `total=${found.total} status=${found.status}` : 'not found');
  }

  // â”€â”€ 4. CHAT SYNC (buyer â†” seller) â”€â”€
  const th = await api(buyer.token, '/chat/threads', 'POST', { participant: 'riyasharma' });
  const threadId = th.data?.thread?.id;
  ok('buyer creates thread with seller', !!threadId, `threadId=${threadId} status=${th.status}`);
  if (threadId) {
    const msg = await api(buyer.token, `/chat/threads/${encodeURIComponent(threadId)}/messages`, 'POST', { body: 'Cross-sync test message' });
    ok('buyer sends message', msg.status === 200 || msg.status === 201, `status=${msg.status}`);
    const threadsS = await api(seller.token, '/chat/threads');
    const match = (threadsS.data?.threads ?? []).find((t) => t.id === threadId);
    ok('seller sees the SAME thread', !!match, match ? `last=${JSON.stringify(match.lastMessage ?? match.lastMessageText ?? '').slice(0, 120)}` : JSON.stringify(threadsS.data).slice(0, 200));
    const msgsS = await api(seller.token, `/chat/threads/${encodeURIComponent(threadId)}/messages`);
    ok('seller reads buyer message text', JSON.stringify(msgsS.data ?? '').includes('Cross-sync test message'), `count=${msgsS.data?.messages?.length ?? 'n/a'}`);
  }

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('SUITE ERROR:', e.message); process.exit(1); });

