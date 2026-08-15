/**
 * COMPREHENSIVE SCREEN METADATA REFERENCE
 * Extracted via Figma Console MCP plugin (figma_execute)
 * 
 * This is the authoritative reference for rebuild:
 * - VECTOR node IDs → icon SVG files
 * - IMAGE fill node IDs → image PNG files
 * - TEXT content, font sizes, colors
 * - GRADIENT stops and transforms
 * - Individual corner radii
 */
import { ICON_MAP } from './ICON-MAPPING';
import { IMAGE_MAP, BROKEN_IMAGES } from './IMAGE-MAPPING';

// ─── HELPER FUNCTIONS ──────────────────────────────────────

/** Get icon filename for a Figma VECTOR node */
export function getIconForNode(nodeId: string): string | undefined {
  return ICON_MAP[nodeId];
}

/** Get image filename for a Figma IMAGE fill node */
export function getImageForNode(nodeId: string): string | undefined {
  return IMAGE_MAP[nodeId] || BROKEN_IMAGES[nodeId];
}

/** Check if an image is a broken stub (needs placeholder) */
export function isImageBroken(nodeId: string): boolean {
  return nodeId in BROKEN_IMAGES;
}

/**
 * Extract metadata from figma_execute log output
 * Run: console.log("PREFIX:" + JSON.stringify(data));
 * Read with: figma-console_figma_get_console_logs
 */

// ─── BATCH 2: TEXT CONTENT ──────────────────────────────────
// Extracted from figma_execute plugin

export const SCREEN_TEXTS: Record<string, Array<{id: string; text: string; fontSize?: number; fontFamily?: string; fontStyle?: string; color?: string}>> = {
  'Community Chat': [
    {id: '1:129', text: 'Feed', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:134', text: 'Explore', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:139', text: 'Create', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:144', text: 'Chat', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#4343d5'},
    {id: '1:150', text: 'Profile', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:158', text: 'Type a message...', fontSize: 16, fontFamily: 'Inter', fontStyle: 'Regular', color: '#6b7280'},
    {id: '1:176', text: 'Bangalore Electronics', fontSize: 20, fontFamily: 'Geist', fontStyle: 'Regular', color: '#4343d5'},
    {id: '1:178', text: '1,248 members • 42 online', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#dedfe5'},
    {id: '1:191', text: 'Weekly Trade Meetup: Cubbon Park,\nSat 4PM', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#faf7ff'},
    {id: '1:197', text: 'Today', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
  ],
  'Notifications': [
    {id: '1:999', text: 'Feed', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1004', text: 'Explore', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1009', text: 'Create', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1014', text: 'Alerts', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#4343d5'},
    {id: '1:1019', text: 'Profile', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1025', text: 'Notifications', fontSize: 20, fontFamily: 'Geist', fontStyle: 'Regular', color: '#4343d5'},
    {id: '1:1031', text: 'All', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#4343d5'},
    {id: '1:1034', text: 'Orders', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1036', text: 'Social', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1044', text: 'Order Delivered', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#1a1a2e'},
    {id: '1:1045', text: '2m ago', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1047', text: 'Your order #SJ-99201 has been\ndelivered. We hope you love your\nnew finds!', fontSize: 14, fontFamily: 'Inter', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1059', text: 'Julian Rossi', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#1a1a2e'},
    {id: '1:1060', text: '15m ago', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1062', text: 'Julian Rossi sent you a message:\n"Hey! Is that vintage camera still\navailable for trade?"', fontSize: 14, fontFamily: 'Inter', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1076', text: 'Price Drop Alert', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#1a1a2e'},
    {id: '1:1077', text: '1h ago', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1079', text: 'Price drop on your saved item! The\nMidnight Tech Jacket is now 20% off.', fontSize: 14, fontFamily: 'Inter', fontStyle: 'Regular'},
    {id: '1:1088', text: 'New Follower', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#1a1a2e'},
    {id: '1:1089', text: '4h ago', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1091', text: 'Sarah Qureshi followed you. You both\nshare an interest in "Minimalist\nArchitecture".', fontSize: 14, fontFamily: 'Inter', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1098', text: 'Payment Received', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#1a1a2e'},
    {id: '1:1099', text: 'Yesterday', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1101', text: 'Payment for your sold item "Ceramic\nVase Set" has been processed and\nadded to your wallet.', fontSize: 14, fontFamily: 'Inter', fontStyle: 'Regular', color: '#464555'},
  ],
  'Saved Collections': [
    {id: '1:1108', text: 'Feed', fontSize: 12, color: '#464555'},
    {id: '1:1113', text: 'Explore', fontSize: 12, color: '#464555'},
    {id: '1:1118', text: 'Create', fontSize: 12, color: '#464555'},
    {id: '1:1123', text: 'Chat', fontSize: 12, color: '#464555'},
    {id: '1:1128', text: 'Profile', fontSize: 12, color: '#4343d5'},
    {id: '1:1135', text: 'susej', fontSize: 20, color: '#4343d5'},
    {id: '1:1149', text: 'Saved Items', fontSize: 32, color: '#1a1a2e'},
    {id: '1:1151', text: 'Organize your inspirations and\nwishlist', fontSize: 16, color: '#464555'},
    {id: '1:1156', text: 'New', fontSize: 16, color: '#ffffff'},
    {id: '1:1160', text: 'Collections', fontSize: 14, color: '#4343d5'},
    {id: '1:1162', text: '4', fontSize: 10, color: '#4343d5'},
    {id: '1:1166', text: 'All Items', fontSize: 14, color: '#464555'},
    {id: '1:1168', text: '128', fontSize: 10, color: '#464555'},
    {id: '1:1178', text: 'Summer Outfits', fontSize: 14, color: '#1a1a2e'},
    {id: '1:1186', text: 'Dream Home', fontSize: 14, color: '#1a1a2e'},
    {id: '1:1194', text: 'Tech Gadgets', fontSize: 14, color: '#1a1a2e'},
    {id: '1:1202', text: 'Skincare Routine', fontSize: 14, color: '#1a1a2e'},
  ],
  'Settings': [
    {id: '1:278', text: 'Settings', fontSize: 20, color: '#4343d5'},
    {id: '1:286', text: 'Search settings', fontSize: 16, color: '#6b7280'},
    {id: '1:291', text: 'ACCOUNT', fontSize: 12, color: '#464555'},
    {id: '1:314', text: 'PRIVACY', fontSize: 12, color: '#464555'},
    {id: '1:339', text: 'NOTIFICATIONS', fontSize: 12, color: '#464555'},
    {id: '1:362', text: 'MARKETPLACE', fontSize: 12, color: '#464555'},
    {id: '1:394', text: 'Log Out', fontSize: 16, color: '#ba1a1a'},
    {id: '1:400', text: 'Feed', fontSize: 12, color: '#464555'},
    {id: '1:405', text: 'Explore', fontSize: 12, color: '#464555'},
    {id: '1:410', text: 'Create', fontSize: 12, color: '#464555'},
    {id: '1:415', text: 'Chat', fontSize: 12, color: '#464555'},
    {id: '1:420', text: 'Profile', fontSize: 12, color: '#4343d5'},
  ],
  'Order History': [
    {id: '1:1211', text: 'Feed', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1217', text: 'Explore', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1223', text: 'Create', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1229', text: 'Chat', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1235', text: 'Profile', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#4343d5'},
    {id: '1:1242', text: 'Order History', fontSize: 20, fontFamily: 'Geist', fontStyle: 'Regular', color: '#4343d5'},
    {id: '1:1249', text: 'Buying', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#4343d5'},
    {id: '1:1251', text: 'Selling', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:1273', text: 'View Details', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#faf7ff'},
    {id: '1:1293', text: 'View Details', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#faf7ff'},
    {id: '1:1313', text: 'View Details', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#faf7ff'},
    {id: '1:1333', text: 'View Details', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#faf7ff'},
  ],
  'Edit Profile': [
    {id: '1:629', text: 'Edit Profile', fontSize: 20, fontFamily: 'Geist', fontStyle: 'Regular', color: '#4343d5'},
    {id: '1:631', text: 'Save', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#4343d5'},
    {id: '1:642', text: 'Change profile photo', fontSize: 16, fontFamily: 'Geist', fontStyle: 'Regular', color: '#4343d5'},
    {id: '1:647', text: 'Name', fontSize: 16, fontFamily: 'Geist', fontStyle: 'Regular', color: '#5c5e63'},
    {id: '1:650', text: 'Julian Susej', fontSize: 16, fontFamily: 'Inter', fontStyle: 'Regular', color: '#1a1a2e'},
    {id: '1:654', text: 'Username', fontSize: 16, fontFamily: 'Geist', fontStyle: 'Regular', color: '#5c5e63'},
    {id: '1:660', text: '@', fontSize: 16, fontFamily: 'Inter', fontStyle: 'Regular', color: '#5c5e63'},
    {id: '1:664', text: 'Bio', fontSize: 16, fontFamily: 'Geist', fontStyle: 'Regular', color: '#5c5e63'},
    {id: '1:667', text: 'Curating the finest minimalist aesthetics.\nSelling rare digital assets and luxury...', fontSize: 16, fontFamily: 'Inter', fontStyle: 'Regular', color: '#1a1a2e'},
    {id: '1:673', text: 'Business Info', fontSize: 20, fontFamily: 'Geist', fontStyle: 'Regular', color: '#1a1a2e'},
    {id: '1:715', text: 'Privacy', fontSize: 20, fontFamily: 'Geist', fontStyle: 'Regular', color: '#1a1a2e'},
    {id: '1:736', text: 'Deactivate Shop Account', fontSize: 16, fontFamily: 'Geist', fontStyle: 'Regular', color: '#ba1a1a'},
    {id: '1:742', text: 'Feed', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:747', text: 'Explore', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:752', text: 'Create', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:757', text: 'Chat', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#464555'},
    {id: '1:762', text: 'Profile', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Regular', color: '#4343d5'},
  ],
  'Category Discovery': [
    {id: '1:2204', text: 'Feed', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#464555'},
    {id: '1:2209', text: 'Explore', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#4343d5'},
    {id: '1:2214', text: 'Create', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#464555'},
    {id: '1:2219', text: 'Chat', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#464555'},
    {id: '1:2224', text: 'Profile', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#464555'},
    {id: '1:2230', text: 'susej', fontSize: 20, fontFamily: 'Geist', fontStyle: 'Bold', color: '#4343d5'},
    {id: '1:2236', text: 'Explore Industries', fontSize: 24, fontFamily: 'Geist', fontStyle: 'SemiBold', color: '#1a1a2e'},
    {id: '1:2240', text: 'Search fashion, tech, real estate...', fontSize: 16, fontFamily: 'Liberation Serif', fontStyle: 'Regular', color: '#464555'},
    {id: '1:2249', text: 'Fashion', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2255', text: 'Electronics', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2261', text: 'Real Estate', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2267', text: 'Automotive', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2273', text: 'Luxury', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2279', text: 'Collectibles', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2285', text: 'Services', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2291', text: 'Beauty', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2297', text: 'Health', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2303', text: 'Art', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2309', text: 'Home', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2315', text: 'Travel', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2321', text: 'Education', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2327', text: 'Finance', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2333', text: 'Food', fontSize: 12, fontFamily: 'Geist', fontStyle: 'Medium', color: '#1a1a2e'},
    {id: '1:2337', text: 'Trending Now', fontSize: 20, fontFamily: 'Geist', fontStyle: 'SemiBold', color: '#1a1a2e'},
    {id: '1:2339', text: 'See All', fontSize: 14, fontFamily: 'Geist', fontStyle: 'SemiBold', color: '#4343d5'},
    {id: '1:2343', text: 'Titanium Chronograph', fontSize: 14, fontFamily: 'Geist', fontStyle: 'SemiBold', color: '#1a1a2e'},
    {id: '1:2345', text: 'Electronics & Luxury', fontSize: 14, fontFamily: 'Liberation Serif', fontStyle: 'Regular', color: '#464555'},
    {id: '1:2352', text: 'Modernist Loft Decor', fontSize: 14, fontFamily: 'Geist', fontStyle: 'SemiBold', color: '#1a1a2e'},
    {id: '1:2354', text: 'Home & Real Estate', fontSize: 14, fontFamily: 'Liberation Serif', fontStyle: 'Regular', color: '#464555'},
    {id: '1:2361', text: 'Cloud-Step Velocity', fontSize: 14, fontFamily: 'Geist', fontStyle: 'SemiBold', color: '#1a1a2e'},
    {id: '1:2363', text: 'Fashion', fontSize: 14, fontFamily: 'Liberation Serif', fontStyle: 'Regular', color: '#464555'},
  ],
  'Splash': [
    {id: '1:1874', text: 'susej', fontSize: 32, fontFamily: 'Geist', fontStyle: 'Regular', color: '#faf7ff'},
    {id: '1:1878', text: 'BUY. SELL. CONNECT.', fontSize: 14, fontFamily: 'Geist', fontStyle: 'Regular', color: '#faf7ff'},
  ],
};

// ─── TYPOGRAPHY OBSERVATIONS ────────────────────────────────
// Figma uses "Geist" for labels/headings and "Inter" for body text.
// React Native doesn't have Geist by default — use Inter for ALL text.
// Font style mapping:
//   "Regular"  → fontWeight: '400'
//   "Medium"   → fontWeight: '500'
//   "SemiBold" → fontWeight: '600'
//   "Bold"     → fontWeight: '700'
//   "ExtraBold" → fontWeight: '800'
// Stitch note: headlines=Geist Bold/Extrabold, body=Inter Regular/Medium

// ─── GRADIENT NODES (from batch 1 extraction) ──────────────
// Located in Home Feed story rings + Profile avatar border
export const GRADIENT_NODES = [
  {
    id: '1:3660',
    screen: 'Home Feed',
    name: 'Story ring bg (Your Story)',
    type: 'GRADIENT_LINEAR',
    stops: '5 gradient stops, purple→blue→pink spectrum'
  },
  {
    id: '1:3666',
    screen: 'Home Feed',
    name: 'Story ring bg (Seller 1)',
    type: 'GRADIENT_LINEAR',
  },
  {
    id: '1:3672',
    screen: 'Home Feed',
    name: 'Story ring bg (Seller 2)',
    type: 'GRADIENT_LINEAR',
  },
  {
    id: '1:3678',
    screen: 'Home Feed',
    name: 'Story ring bg (Seller 3)',
    type: 'GRADIENT_LINEAR',
  },
  {
    id: '1:3684',
    screen: 'Home Feed',
    name: 'Story ring bg (Seller 4)',
    type: 'GRADIENT_LINEAR',
  },
  {
    id: '1:1868',
    screen: 'Splash background',
    name: 'Splash bg gradient',
    type: 'GRADIENT_LINEAR',
    stops: 'multiple stops, dark purple/blue gradient → #010101 base'
  },
  {
    id: '1:1862',
    screen: 'Splash',
    name: 'Splash container bg',
    type: 'GRADIENT_LINEAR',
  },
];

// --- BATCH 3: REMAINING 16 SCREENS TEXT ---------------------
// Extracted via figma_execute plugin (deep walk, depth 8)
export const SCREEN_TEXTS_BATCH3: Record<string, Array<{id: string; text: string; fontSize?: number; fontFamily?: string; fontStyle?: string; color?: string}>> = {
  'VintageFashion Results': [
    {id: '1:2059', text: 'susej', fontSize: 20, color: '#4343d5'},
    {id: '1:2066', text: '#vintagefashion', fontSize: 24, color: '#1a1a2e'},
    {id: '1:2067', text: '24.5k Posts � 12k Following', fontSize: 14, color: '#464555'},
    {id: '1:2076', text: 'Follow', fontSize: 14, color: '#faf7ff'},
    {id: '1:2079', text: 'Distance: 5km', fontSize: 12, color: '#464555'},
    {id: '1:2086', text: 'Price', fontSize: 14, color: '#1a1a2e'},
    {id: '1:2087', text: 'Condition: Like New', fontSize: 14, color: '#464555'},
    {id: '1:2093', text: '$120.00', fontSize: 16, color: '#1a1a2e'},
    {id: '1:2097', text: '90s Burberry Trench', fontSize: 14, color: '#1a1a2e'},
    {id: '1:2099', text: 'Studio_Vault', fontSize: 12, color: '#464555'},
    {id: '1:2105', text: 'NEW DROP', fontSize: 10, color: '#ffffff'},
    {id: '1:2108', text: '$245.00', fontSize: 16, color: '#1a1a2e'},
    {id: '1:2112', text: 'Retro Court 88s', fontSize: 14, color: '#1a1a2e'},
    {id: '1:2114', text: 'KicksCulture', fontSize: 12, color: '#464555'},
    {id: '1:2120', text: '$85.00', fontSize: 16, color: '#1a1a2e'},
    {id: '1:2124', text: 'Artisan Leather Bag', fontSize: 14, color: '#1a1a2e'},
    {id: '1:2126', text: 'RareFinds', fontSize: 12, color: '#464555'},
    {id: '1:2132', text: '$45.00', fontSize: 16, color: '#1a1a2e'},
    {id: '1:2136', text: 'Silk Pattern Scarf', fontSize: 14, color: '#1a1a2e'},
    {id: '1:2138', text: 'Silk_Road', fontSize: 12, color: '#464555'},
    {id: '1:2144', text: '$68.00', fontSize: 16, color: '#1a1a2e'},
    {id: '1:2148', text: 'Classic 501 Indigo', fontSize: 14, color: '#1a1a2e'},
    {id: '1:2150', text: 'DenimDen', fontSize: 12, color: '#464555'},
    {id: '1:2156', text: '$320.00', fontSize: 16, color: '#1a1a2e'},
    {id: '1:2160', text: 'Omega Constellation', fontSize: 14, color: '#1a1a2e'},
  ],
  'Food & Groceries Hub': [
    {id: '1:428', text: 'susej', fontSize: 20, color: '#4343d5'},
    {id: '1:478', text: 'Central Park, NY', fontSize: 14, color: '#464555'},
    {id: '1:482', text: 'Search for food, groceries, or meals...', fontSize: 16, color: '#767586'},
    {id: '1:501', text: 'Fresh Produce', fontSize: 12, color: '#1a1a2e'},
    {id: '1:507', text: 'Restaurants', fontSize: 12, color: '#1a1a2e'},
    {id: '1:513', text: 'Vegan', fontSize: 12, color: '#1a1a2e'},
    {id: '1:517', text: 'FREE DELIVERY', fontSize: 10, color: '#ffffff'},
    {id: '1:520', text: 'Weekly Organic Picks', fontSize: 20, color: '#1a1a2e'},
    {id: '1:522', text: 'Explore Now', fontSize: 14, color: '#4343d5'},
    {id: '1:527', text: 'Nearby Favourites', fontSize: 20, color: '#1a1a2e'},
    {id: '1:529', text: 'Quick bites from your local neighborhood', fontSize: 14, color: '#464555'},
    {id: '1:536', text: '4.8', fontSize: 14, color: '#4343d5'},
    {id: '1:538', text: 'Artisan Burger Loft', fontSize: 16, color: '#1a1a2e'},
    {id: '1:541', text: 'Gourmet � Burgers � $$$', fontSize: 14, color: '#5c5e63'},
    {id: '1:546', text: '25 min', fontSize: 12, color: '#22c55e'},
    {id: '1:549', text: '1.2 miles', fontSize: 12, color: '#5c5e63'},
    {id: '1:555', text: '4.9', fontSize: 14, color: '#4343d5'},
    {id: '1:557', text: 'Sakura Sushi Bar', fontSize: 16, color: '#1a1a2e'},
    {id: '1:560', text: 'Japanese � Fresh � $$$$', fontSize: 14, color: '#5c5e63'},
    {id: '1:565', text: '32 min', fontSize: 12, color: '#22c55e'},
    {id: '1:568', text: '0.8 miles', fontSize: 12, color: '#5c5e63'},
    {id: '1:575', text: 'Popular Vendors', fontSize: 20, color: '#1a1a2e'},
    {id: '1:577', text: 'Most ordered from your city today', fontSize: 14, color: '#464555'},
    {id: '1:584', text: 'Green Bowl Kitchen', fontSize: 14, color: '#1a1a2e'},
    {id: '1:586', text: '4.7', fontSize: 12, color: '#4343d5'},
    {id: '1:588', text: '15-20 min', fontSize: 12, color: '#22c55e'},
    {id: '1:590', text: 'Fire & Dough', fontSize: 14, color: '#1a1a2e'},
  ],
  'Seller Dashboard': [
    {id: '1:770', text: 'susej', fontSize: 20, color: '#4343d5'},
    {id: '1:777', text: 'Seller Dashboard', fontSize: 20, color: '#4343d5'},
    {id: '1:779', text: 'Manage your high-end listings and metrics', fontSize: 14, color: '#464555'},
    {id: '1:787', text: 'Total Sales', fontSize: 12, color: '#464555'},
    {id: '1:789', text: '$12,480', fontSize: 24, color: '#1a1a2e'},
    {id: '1:791', text: '+14.2%', fontSize: 12, color: '#22c55e'},
    {id: '1:795', text: 'Profile Views', fontSize: 12, color: '#464555'},
    {id: '1:797', text: '2.4k', fontSize: 24, color: '#1a1a2e'},
    {id: '1:801', text: 'Active Listings', fontSize: 12, color: '#464555'},
    {id: '1:806', text: 'Verified Seller', fontSize: 14, color: '#1a1a2e'},
    {id: '1:808', text: 'Account fully authenticated', fontSize: 14, color: '#464555'},
    {id: '1:811', text: 'Manage', fontSize: 14, color: '#4343d5'},
    {id: '1:815', text: 'MY LISTINGS', fontSize: 12, color: '#464555'},
    {id: '1:826', text: 'Amethyst Leather Tote', fontSize: 14, color: '#1a1a2e'},
    {id: '1:830', text: '$2,400', fontSize: 14, color: '#4343d5'},
    {id: '1:840', text: 'EDIT', fontSize: 12, color: '#4343d5'},
    {id: '1:842', text: 'PROMOTE', fontSize: 12, color: '#faf7ff'},
    {id: '1:852', text: 'Sonic-X Silver Edition', fontSize: 14, color: '#1a1a2e'},
    {id: '1:856', text: '$350', fontSize: 14, color: '#4343d5'},
    {id: '1:866', text: 'EDIT', fontSize: 12, color: '#4343d5'},
    {id: '1:868', text: 'PROMOTE', fontSize: 12, color: '#faf7ff'},
    {id: '1:872', text: 'RECENT INQUIRIES', fontSize: 12, color: '#464555'},
    {id: '1:878', text: 'Jane Doe', fontSize: 14, color: '#1a1a2e'},
    {id: '1:880', text: '2m ago', fontSize: 12, color: '#464555'},
    {id: '1:886', text: 'Marcus Kane', fontSize: 14, color: '#1a1a2e'},
    {id: '1:888', text: '1h ago', fontSize: 12, color: '#464555'},
  ],
  'Rate & Review': [
    {id: '1:912', text: 'Write Review', fontSize: 20, color: '#4343d5'},
    {id: '1:914', text: 'Submit Review', fontSize: 16, color: '#faf7ff'},
    {id: '1:920', text: 'Signature Leather Tote', fontSize: 16, color: '#1a1a2e'},
    {id: '1:924', text: 'Seller:', fontSize: 14, color: '#5c5e63'},
    {id: '1:926', text: 'Susej Boutique', fontSize: 14, color: '#4343d5'},
    {id: '1:929', text: 'How was your experience?', fontSize: 16, color: '#1a1a2e'},
    {id: '1:931', text: 'Tap a star to rate', fontSize: 14, color: '#5c5e63'},
    {id: '1:935', text: 'Product Photos', fontSize: 16, color: '#464555'},
    {id: '1:939', text: 'Add', fontSize: 14, color: '#4343d5'},
    {id: '1:943', text: 'Share your thoughts', fontSize: 16, color: '#1a1a2e'},
    {id: '1:947', text: 'Tell us what you liked or disliked...', fontSize: 16, color: '#767586'},
    {id: '1:951', text: 'Post Anonymously', fontSize: 16, color: '#464555'},
  ],
  'Signup / Login': [
    {id: '1:1901', text: 'susej', fontSize: 40, color: '#4343d5'},
    {id: '1:1907', text: 'Welcome to susej', fontSize: 24, color: '#faf7ff'},
    {id: '1:1909', text: 'Discover and shop the most exclusive...', fontSize: 16, color: '#faf7ff'},
    {id: '1:1915', text: 'Continue with Phone', fontSize: 16, color: '#faf7ff'},
    {id: '1:1921', text: 'Continue with Google', fontSize: 16, color: '#faf7ff'},
    {id: '1:1925', text: 'By continuing, you agree...', fontSize: 12, color: '#faf7ff'},
    {id: '1:1931', text: 'Already have an account?', fontSize: 14, color: '#faf7ff'},
    {id: '1:1933', text: 'Login', fontSize: 14, color: '#faf7ff'},
  ],
  'Welcome Carousel': [
    {id: '1:1941', text: 'susej', fontSize: 32, color: '#faf7ff'},
    {id: '1:1945', text: 'Post Products like Instagram', fontSize: 24, color: '#faf7ff'},
    {id: '1:1955', text: 'Turn your beautiful belongings into...', fontSize: 14, color: '#faf7ff'},
    {id: '1:1961', text: 'Buy & Sell near you', fontSize: 24, color: '#faf7ff'},
    {id: '1:1973', text: 'Discover hidden treasures...', fontSize: 14, color: '#faf7ff'},
    {id: '1:1979', text: 'Join Communities', fontSize: 24, color: '#faf7ff'},
    {id: '1:1995', text: 'Get Started', fontSize: 16, color: '#faf7ff'},
    {id: '1:2002', text: 'Already have an account? Sign In', fontSize: 14, color: '#faf7ff'},
  ],
  'Profile Setup': [
    {id: '1:1686', text: 'susej', fontSize: 24, color: '#4343d5'},
    {id: '1:1690', text: 'Set up your profile', fontSize: 24, color: '#1a1a2e'},
    {id: '1:1697', text: 'Add Photo', fontSize: 14, color: '#4343d5'},
    {id: '1:1702', text: 'Full Name', fontSize: 16, color: '#5c5e63'},
    {id: '1:1705', text: 'Enter your name', fontSize: 16, color: '#767586'},
    {id: '1:1709', text: 'Username', fontSize: 16, color: '#5c5e63'},
    {id: '1:1712', text: 'username', fontSize: 16, color: '#767586'},
    {id: '1:1716', text: 'I am a:', fontSize: 16, color: '#1a1a2e'},
    {id: '1:1721', text: 'Buyer', fontSize: 14, color: '#4343d5'},
    {id: '1:1724', text: 'Seller', fontSize: 14, color: '#464555'},
    {id: '1:1729', text: 'Continue', fontSize: 16, color: '#faf7ff'},
  ],
  'Become a Seller': [
    {id: '1:2521', text: 'susej', fontSize: 20, color: '#4343d5'},
    {id: '1:2527', text: 'Become a Seller', fontSize: 20, color: '#4343d5'},
    {id: '1:2539', text: 'Identity', fontSize: 14, color: '#4343d5'},
    {id: '1:2542', text: 'Documents', fontSize: 14, color: '#464555'},
    {id: '1:2549', text: 'Business Name', fontSize: 14, color: '#464555'},
    {id: '1:2552', text: 'e.g. Luxe Thread Studio', fontSize: 16, color: '#767586'},
    {id: '1:2558', text: 'Business Category', fontSize: 14, color: '#464555'},
    {id: '1:2570', text: 'Continue', fontSize: 16, color: '#faf7ff'},
    {id: '1:2576', text: 'Application Sent!', fontSize: 20, color: '#22c55e'},
    {id: '1:2581', text: 'Go to Dashboard', fontSize: 16, color: '#faf7ff'},
  ],
  'Communities Hub': [
    {id: '1:2596', text: 'susej', fontSize: 20, color: '#4343d5'},
    {id: '1:2606', text: 'Your Communities', fontSize: 20, color: '#1a1a2e'},
    {id: '1:2619', text: 'Bangalore Electronics', fontSize: 14, color: '#4343d5'},
    {id: '1:2622', text: 'Mumbai Fashion', fontSize: 14, color: '#4343d5'},
    {id: '1:2625', text: 'Urban Jungle', fontSize: 14, color: '#4343d5'},
    {id: '1:2632', text: 'Discover Communities', fontSize: 20, color: '#1a1a2e'},
    {id: '1:2642', text: 'Technology', fontSize: 12, color: '#1a1a2e'},
    {id: '1:2657', text: 'ACTIVE', fontSize: 10, color: '#22c55e'},
    {id: '1:2660', text: 'Design Mavericks', fontSize: 14, color: '#1a1a2e'},
    {id: '1:2662', text: '24.5k members � 32 online', fontSize: 12, color: '#464555'},
    {id: '1:2680', text: 'Community Feed', fontSize: 20, color: '#1a1a2e'},
  ],
  'OTP Verification': [
    {id: '1:1554', text: 'susej', fontSize: 24, color: '#4343d5'},
    {id: '1:1558', text: 'Enter your phone number', fontSize: 24, color: '#1a1a2e'},
    {id: '1:1567', text: '+91', fontSize: 16, color: '#1a1a2e'},
    {id: '1:1569', text: '98765 43210', fontSize: 16, color: '#1a1a2e'},
    {id: '1:1573', text: 'Send OTP', fontSize: 16, color: '#faf7ff'},
  ],
  'Location Selection': [
    {id: '1:1598', text: 'Where are you?', fontSize: 24, color: '#1a1a2e'},
    {id: '1:1614', text: 'Allow Location Access', fontSize: 16, color: '#faf7ff'},
    {id: '1:1619', text: 'Select City Manually', fontSize: 16, color: '#5c5e63'},
    {id: '1:1660', text: 'Continue', fontSize: 16, color: '#4343d5'},
    {id: '1:1667', text: 'Skip for now', fontSize: 14, color: '#5c5e63'},
  ],
  'Track Order': [
    {id: '1:2926', text: 'susej', fontSize: 20, color: '#4343d5'},
    {id: '1:2932', text: 'Order #SJ-99201', fontSize: 20, color: '#1a1a2e'},
    {id: '1:2934', text: 'Arriving Today by 6:00 PM', fontSize: 16, color: '#22c55e'},
    {id: '1:2945', text: 'In Transit', fontSize: 14, color: '#4343d5'},
    {id: '1:2952', text: 'Order Placed', fontSize: 14, color: '#1a1a2e'},
    {id: '1:2960', text: 'Payment Confirmed', fontSize: 14, color: '#1a1a2e'},
    {id: '1:2968', text: 'Shipped', fontSize: 14, color: '#1a1a2e'},
    {id: '1:2976', text: 'Out for Delivery', fontSize: 14, color: '#1a1a2e'},
    {id: '1:2996', text: 'HOME', fontSize: 10, color: '#4343d5'},
    {id: '1:3000', text: 'Live Tracking Active', fontSize: 16, color: '#22c55e'},
    {id: '1:3013', text: 'Vanguard Elite Sneakers', fontSize: 16, color: '#1a1a2e'},
    {id: '1:3023', text: '$249.00', fontSize: 20, color: '#4343d5'},
  ],
  'Create New Post': [
    {id: '1:3353', text: 'susej', fontSize: 20, color: '#4343d5'},
    {id: '1:3361', text: 'New Post', fontSize: 20, color: '#1a1a2e'},
    {id: '1:3367', text: 'Next', fontSize: 16, color: '#4343d5'},
    {id: '1:3370', text: 'Recent', fontSize: 16, color: '#1a1a2e'},
  ],
};

// --- FONT WEIGHT MAPPING ------------------------------------
export const FONT_WEIGHT_MAP: Record<string, number> = {
  'Thin': 100, 'Extra Light': 200, 'Light': 300,
  'Regular': 400, 'Medium': 500, 'Semi Bold': 600,
  'Bold': 700, 'Extra Bold': 800, 'Black': 900,
};

// --- LETTER SPACING OBSERVATIONS ----------------------------
// Bottom nav labels: 0.24px letter spacing, 12px font
// "susej" brand text: -0.5px letter spacing
// Body text: generally null (no letter spacing)

// --- GRADIENT NODES (from figma_execute deep extraction) ---
export const GRADIENT_NODES_BATCH3 = [
  { id: '1:458', screen: 'Food & Groceries Hub', name: 'Background', type: 'GRADIENT_LINEAR',
    transform: 'identity (1,0,0,1,0,0)', stops: '#1a1a2e ? #1a1a2e' },
  { id: '1:1595', screen: 'Location Selection', name: 'Gradient overlay', type: 'GRADIENT_LINEAR',
    transform: 'matrix(0,-1,1.625,0,1,-0.313)', stops: '#fcf8ff ? #fcf8ff' },
  { id: '1:1964', screen: 'Welcome Carousel', name: 'Gradient overlay', type: 'GRADIENT_LINEAR',
    transform: 'matrix(0,-1,0.787,0,1,0.107)', stops: '#4343d5 ? #4343d5' },
];
