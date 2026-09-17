// Payout sub-route — the app PUTs here (see serverApi.requestPayout). The
// transactional implementation lives in the parent wallet route; this file
// exists so the documented contract resolves instead of 404ing (a missing
// sub-route silently broke every seller withdrawal).
export { PUT } from "../route";
