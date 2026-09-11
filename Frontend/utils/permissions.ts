// Permission helpers — single source for media/camera/location permission UX.
// Uses expo-image-picker + expo-location native modules (present in Expo Go) via
// lazy require, same pattern as screens, so importing this util never crashes offline/web.
import { Platform } from 'react-native';

type PickerModule = any;

let cachedPicker: PickerModule | null = null;
const getPicker = (): PickerModule | null => {
  try {
    if (!cachedPicker) cachedPicker = require('expo-image-picker');
    return cachedPicker;
  } catch {
    return null;
  }
};

let cachedLocation: PickerModule | null = null;
const getLocation = (): PickerModule | null => {
  try {
    if (!cachedLocation) cachedLocation = require('expo-location');
    return cachedLocation;
  } catch {
    return null;
  }
};

export type PermState = 'granted' | 'askable' | 'blocked';

export type PermKind = 'media' | 'camera' | 'location';

/** Current permission state without prompting. */
export const getPermStatus = async (kind: PermKind): Promise<PermState> => {
  const Picker = kind === 'location' ? getLocation() : getPicker();
  if (!Picker) return 'blocked';
  try {
    if (kind === 'location') {
      const res = await Picker.getForegroundPermissionsAsync();
      if (res?.granted) return 'granted';
      return res?.canAskAgain === false ? 'blocked' : 'askable';
    }
    const res =
      kind === 'media'
        ? await Picker.getMediaLibraryPermissionsAsync()
        : await Picker.getCameraPermissionsAsync();
    if (res?.granted) return 'granted';
    return res?.canAskAgain === false ? 'blocked' : 'askable';
  } catch {
    // Web or missing native — treat as granted-less but askable so UI stays actionable
    return Platform.OS === 'web' ? 'granted' : 'blocked';
  }
};

/** Fire the OS permission popup. Returns true when granted after the dialog resolves. */
export const requestPerm = async (kind: PermKind): Promise<boolean> => {
  const Picker = kind === 'location' ? getLocation() : getPicker();
  if (!Picker) return false;
  try {
    if (kind === 'location') {
      const res = await Picker.requestForegroundPermissionsAsync();
      return !!res?.granted;
    }
    const res =
      kind === 'media'
        ? await Picker.requestMediaLibraryPermissionsAsync()
        : await Picker.requestCameraPermissionsAsync();
    return !!res?.granted;
  } catch {
    return false;
  }
};

/** True when the OS dialog will actually appear (not permanently denied). */
export const permCanAskAgain = async (kind: PermKind): Promise<boolean> => {
  const Picker = kind === 'location' ? getLocation() : getPicker();
  if (!Picker) return false;
  try {
    const res =
      kind === 'media'
        ? await Picker.getMediaLibraryPermissionsAsync()
        : kind === 'camera'
          ? await Picker.getCameraPermissionsAsync()
          : await Picker.getForegroundPermissionsAsync();
    return res?.canAskAgain !== false && !res?.granted;
  } catch {
    return false;
  }
};
