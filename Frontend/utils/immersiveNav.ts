/**
 * Immersive-nav bridge.
 *
 * Conversation surfaces (personal DM thread view, community room) hide the
 * bottom tab bar for focus - the Instagram DM pattern. The tab bar lives in
 * the (tabs) layout while those views render INSIDE a tab route, and
 * per-screen tabBarStyle/setOptions are silently ignored by this
 * expo-router/react-navigation combination (proven Aug 25 on /creator).
 * The ONLY working mechanism is screenOptions-as-function reading reactive
 * state owned by the layout - this module is that reactive state.
 *
 * Any screen can opt into immersion for as long as it is mounted.
 */
type Listener = () => void;

let immersive = false;
const listeners = new Set<Listener>();

export function setImmersiveNav(value: boolean): void {
  if (immersive === value) return;
  immersive = value;
  listeners.forEach((l) => l());
}

export function subscribeImmersiveNav(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getImmersiveNav(): boolean {
  return immersive;
}
