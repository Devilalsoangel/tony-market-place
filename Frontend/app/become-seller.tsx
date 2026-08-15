import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../utils/theme';
import { BackIcon, CheckIcon, CameraIcon, ShopIcon, StarIcon, LockArrowIcon, ArrowRightIcon } from '../utils/icons';
import { useAuth } from '../contexts/AuthContext';
import { sellerImages } from '../utils/screenImages';
import { CATEGORY_TREE } from '../utils/categories';
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

// Become a Seller — 3-step wizard matching Stitch refs:
//   245:2151 Step 1 (hero + seller type) · 245:2718 Business Details ·
//   245:2540 Identity Verification · 245:2627 Verification Success.
type Step = 1 | 2 | 3 | 4; // 4 = success view
type SellerType = 'individual' | 'business';
type IdType = 'aadhaar' | 'pan' | 'passport';

const SHOP_CATEGORIES = CATEGORY_TREE.map((c) => c.label);

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

export default function BecomeSellerScreen() {
  const insets = useSafeAreaInsets();
  const { updateUser, user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [sellerType, setSellerType] = useState<SellerType | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [about, setAbout] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [idType, setIdType] = useState<IdType>('aadhaar');
  const [aadhaar, setAadhaar] = useState('');
  const [idUploaded, setIdUploaded] = useState(false);
  const [idUri, setIdUri] = useState<string | null>(null);
  const [selfieAdded, setSelfieAdded] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [agreeVerify, setAgreeVerify] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pickIdDocument = async () => {
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
        setIdUri(result.assets[0].uri);
        setIdUploaded(true);
      }
    } catch {
      Alert.alert('Upload failed', "We couldn't open your photo library. Please try again.");
    }
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

  const canContinue = () => {
    if (step === 1) return !!sellerType;
    if (step === 2) {
      return !!businessName.trim() && !!category && !!city.trim() && !!pincode.trim() && agreeTerms;
    }
    if (step === 3) {
      return aadhaar.trim().length === 12 && idUploaded && selfieAdded && agreeVerify;
    }
    return false;
  };

  const handleNext = () => {
    if (!canContinue()) {
      setError('Please complete this step before continuing');
      return;
    }
    setError('');
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else if (step === 3) {
      setSubmitting(true);
      setTimeout(() => {
        updateUser({
          isSeller: true,
          verification: 'pending',
          businessName: businessName.trim(),
          category: category.trim(),
          role: 'both',
        });
        // Register as a known seller so /seller/<username> routes to the
        // storefront even before the first post exists.
        (async () => {
          try {
            const raw = await AsyncStorage.getItem(SELLERS_KEY);
            const list: string[] = raw ? JSON.parse(raw) : [];
            const u = user?.username;
            if (u && !list.includes(u)) {
              list.push(u);
              await AsyncStorage.setItem(SELLERS_KEY, JSON.stringify(list));
            }
            // File the application for the in-app admin verification queue.
            const APPLICANTS_KEY = '@susej_seller_applicants';
            const docs = idType === 'aadhaar' ? ['Aadhaar', 'PAN'] : [idType === 'pan' ? 'PAN' : 'Passport', 'Address proof'];
            const aRaw = await AsyncStorage.getItem(APPLICANTS_KEY);
            let applicants: any[] = aRaw ? JSON.parse(aRaw) : [];
            if (!Array.isArray(applicants)) applicants = [];
            if (!applicants.some((a) => a.username === u)) {
              applicants.push({
                username: u,
                name: user?.name || businessName.trim(),
                businessName: businessName.trim(),
                category: category.trim(),
                submitted: 'Just now',
                docs,
              });
              await AsyncStorage.setItem(APPLICANTS_KEY, JSON.stringify(applicants));
              // Mirror to the admin panel verification queue (fire-and-forget).
              void import('../utils/adminSync').then((m) =>
                m.syncSellerApplicant({
                  username: u,
                  name: user?.name || businessName.trim(),
                  businessName: businessName.trim(),
                  docs,
                })
              );
            }
          } catch {}
        })();
        setSubmitting(false);
        setStep(4);
      }, 700);
    }
  };

  const StepDots = ({ current }: { current: number }) => (
    <View className="flex-row items-center mb-8" style={{ gap: 6 }}>
      {[1, 2, 3].map((s) => (
        <View key={s} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: s <= current ? colors.primaryContainer : colors.surfaceContainer }} />
      ))}
    </View>
  );

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

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}>
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
              Step 2 of 3
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
              Shop Category
            </Text>
            <View className="flex-row flex-wrap mb-5" style={{ gap: 8 }}>
              {SHOP_CATEGORIES.map((c) => {
                const on = category === c;
                return (
                  <TouchableOpacity key={c} onPress={() => setCategory(c)} className="px-4 py-2.5 rounded-full" style={{ backgroundColor: on ? colors.primaryContainer : colors.surfaceContainer }}>
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

            <Text className="font-inter-600 text-textPrimary mb-1" style={{ fontSize: 15, lineHeight: 20 }}>
              Sell for less
            </Text>
            <Text className="font-inter-400 text-textSecondary mb-4" style={{ fontSize: 12, lineHeight: 16 }}>
              Flat 8% commission per sale, waived for your first 10 orders. Promotions and ad boosts are pay-per-use from the wallet — no subscriptions, ever.
            </Text>

            <TouchableOpacity className="flex-row items-start mb-2" onPress={() => setAgreeTerms(!agreeTerms)}>
              <View className="w-5 h-5 rounded-md items-center justify-center mt-0.5" style={{ backgroundColor: agreeTerms ? colors.primaryContainer : colors.surfaceContainer }}>
                {agreeTerms && <CheckIcon size={13} color={colors.onPrimary} />}
              </View>
              <Text className="font-inter-400 text-textSecondary flex-1 ml-2.5" style={{ fontSize: 12, lineHeight: 17 }}>
                I agree to the Seller Terms — 8% commission per sale, 0% on first 10 orders, pay-per-use promotions
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
              STEP 3 OF 3
            </Text>
            <StepDots current={3} />
            <Text className="font-inter-700 text-textPrimary mb-1" style={{ fontSize: 22, lineHeight: 30 }}>
              Verify your identity
            </Text>
            <Text className="font-inter-400 text-textSecondary mb-4" style={{ fontSize: 14, lineHeight: 20 }}>
              Government ID keeps the marketplace safe for everyone.
            </Text>
            <View className="flex-row items-center p-3 rounded-figma-12 mb-4" style={{ backgroundColor: colors.surfaceContainerLow }}>
              <LockArrowIcon size={15} color={colors.primaryContainer} />
              <Text className="font-inter-400 text-textSecondary ml-2 flex-1" style={{ fontSize: 12, lineHeight: 16 }}>
                Your data is encrypted and securely stored. We never share it publicly.
              </Text>
            </View>

            {/* Segmented control */}
            <View className="flex-row p-1 mb-5" style={{ borderRadius: 14, backgroundColor: colors.surfaceContainer }}>
              {(['aadhaar', 'pan', 'passport'] as const).map((t) => {
                const on = idType === t;
                return (
                  <TouchableOpacity key={t} className="flex-1 py-2.5 items-center" style={{ borderRadius: 10, backgroundColor: on ? colors.surfaceContainerLowest : 'transparent' }} onPress={() => setIdType(t)}>
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
            <View className="flex-row items-center px-4 mb-5" style={{ height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
              <TextInput
                className="flex-1 font-inter-400 text-textPrimary tracking-widest"
                style={{ fontSize: 14, letterSpacing: 2 }}
                placeholder={idType === 'aadhaar' ? '0000 0000 0000' : idType === 'pan' ? 'ABCDE1234F' : 'M0000000'}
                placeholderTextColor={colors.secondary}
                value={aadhaar}
                onChangeText={(t) => setAadhaar(t.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, idType === 'pan' ? 10 : 12))}
              />
            </View>

            {/* ID upload */}
            <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
              Front of {idType === 'aadhaar' ? 'Aadhaar' : 'ID'}
            </Text>
            <TouchableOpacity
              className="rounded-figma-16 p-5 mb-5 items-center justify-center"
              style={{ borderWidth: 1, borderStyle: idUri ? 'solid' : 'dashed', borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow }}
              onPress={pickIdDocument}
            >
              {idUri ? (
                <View className="items-center w-full">
                  <Image source={{ uri: idUri }} className="w-full h-40 rounded-figma-12 mb-3" style={{ resizeMode: 'cover' }} />
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
                  <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 12, lineHeight: 16 }}>
                    Front photo of your {idType === 'aadhaar' ? 'Aadhaar' : idType === 'pan' ? 'PAN card' : 'passport'} · JPEG or PNG (Max 5MB)
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Selfie */}
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

            <TouchableOpacity className="flex-row items-start mb-4" onPress={() => setAgreeVerify(!agreeVerify)}>
              <View className="w-5 h-5 rounded-md items-center justify-center mt-0.5" style={{ backgroundColor: agreeVerify ? colors.primaryContainer : colors.surfaceContainer }}>
                {agreeVerify && <CheckIcon size={13} color={colors.onPrimary} />}
              </View>
              <Text className="font-inter-400 text-textSecondary flex-1 ml-2.5" style={{ fontSize: 12, lineHeight: 17 }}>
                I consent to the verification of my {idType === 'aadhaar' ? 'Aadhaar details with UIDAI' : 'document details'} for identity establishment purposes.
              </Text>
            </TouchableOpacity>

            <Text className="font-inter-400 text-textSecondary mb-4" style={{ fontSize: 11, lineHeight: 15 }}>
              Verification usually takes 2-4 hours
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
            {/* Success — 245:2627 */}
            <View className="items-center mt-10 mb-6">
              <Image source={sellerImages.avatar} className="w-28 h-28 rounded-full mb-3" />
              <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: colors.primaryContainer, marginTop: -18, borderWidth: 3, borderColor: colors.surface }}>
                <CheckIcon size={18} color={colors.onPrimary} />
              </View>
              <Text className="font-inter-700 text-textPrimary mt-3" style={{ fontSize: 24, lineHeight: 32 }}>
                You're a seller now!
              </Text>
              <Text className="font-inter-400 text-textSecondary text-center mt-1" style={{ fontSize: 14, lineHeight: 21 }}>
                Your storefront is live. Verification is under review — typically approved within 24–48 hours.
              </Text>
            </View>

            {/* Getting started checklist */}
            <View className="p-5 rounded-figma-24" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
              <Text className="font-inter-700 text-textPrimary mb-4" style={{ fontSize: 15, lineHeight: 20 }}>
                Getting Started
              </Text>
              {[
                { label: 'Set up your storefront', sub: 'Banner, categories and deals', done: false, route: '/storefront-editor' },
                { label: 'Verify your identity', sub: 'Completed', done: true },
                { label: 'Publish your first product post', sub: null, done: false, route: '/(tabs)/create' },
                { label: 'Earn your first follower', sub: null, done: false },
              ].map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  className="flex-row items-center py-3"
                  style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.surfaceContainer }}
                  onPress={() => item.route && router.push(item.route as any)}
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
                  {item.route && <ArrowRightIcon size={16} color={colors.secondary} />}
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
      {step < 4 && (
        <View className="px-5 pt-3 pb-2" style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceContainer }}>
          <TouchableOpacity
            className="h-14 rounded-figma-16 items-center justify-center"
            style={{ backgroundColor: canContinue() ? colors.primaryContainer : colors.surfaceContainer }}
            disabled={!canContinue() && step === 3}
            onPress={handleNext}
          >
            <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: canContinue() ? colors.onPrimary : colors.textSecondary }}>
              {step === 3 ? (submitting ? 'Submitting…' : 'Submit for Review') : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}