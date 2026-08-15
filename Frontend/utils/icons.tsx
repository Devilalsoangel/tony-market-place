import React from 'react';
import Svg, { Path, SvgProps, Circle, Rect, G } from 'react-native-svg';

type IconProps = Omit<SvgProps, 'width' | 'height'> & {
  size?: number;
};

function createIcon(path: string, viewBox = '0 0 24 24') {
  return ({ size = 24, color = '#464555', ...props }: IconProps) => (
    <Svg width={size} height={size} viewBox={viewBox} fill="none" {...props}>
      <Path d={path} fill={color} />
    </Svg>
  );
}

export const HeartIcon = createIcon('M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z', '0 0 24 24');
export const BackIcon = createIcon('M3.825 9L9.425 14.6L8 16L0 8L8 0L9.425 1.4L3.825 7H16V9H3.825Z', '0 0 16 16');
export const PlusIcon = createIcon('M4.71429 6.28571H0V4.71429H4.71429V0H6.28571V4.71429H11V6.28571H6.28571V11H4.71429V6.28571Z', '0 0 11 11');
export const MinusIcon = createIcon('M0 4.71429H11V6.28571H0V4.71429Z', '0 0 11 11');
export const ArrowRightIcon = createIcon('M8 0L16 8L8 16L6.6 14.6L12.2 9H0V7H12.2L6.6 1.4L8 0Z', '0 0 16 16');
export const ChevronRightIcon = createIcon('M4 0L8 4L4 8L3.2 7.2L6.4 4L3.2 0.8L4 0Z', '0 0 8 8');
export const ChevronLeftIcon = createIcon('M4 0L0 4L4 8L4.8 7.2L1.6 4L4.8 0.8L4 0Z', '0 0 8 8');
export const PersonIcon = createIcon('M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z');
export const CarIcon = createIcon('M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z');
export const BikeIcon = createIcon('M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z');
export const OfficeIcon = createIcon('M3 21h18v-2H3v2zM5 19h4v-4h6v4h4V9l-7-6-7 6v10zm5-8h4v2h-4v-2z');
export const GarageIcon = createIcon('M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z');

export function SearchIcon({ size = 24, color = '#464555' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="10.5" cy="10.5" r="7.5" stroke={color} strokeWidth="2" />
      <Path d="M16 16L22 22" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function MapPinIcon({ size = 24, color = '#4343d5' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={color} />
      <Circle cx="12" cy="9" r="3" fill="white" />
    </Svg>
  );
}

export function CameraIcon({ size = 24, color = '#4343d5' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke={color} strokeWidth="2" fill="none" />
      <Circle cx="12" cy="13" r="4" stroke={color} strokeWidth="2" fill="none" />
    </Svg>
  );
}

export function SendIcon({ size = 24, color = '#4343d5' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M22 2L11 13" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </Svg>
  );
}

export function MoreIcon({ size = 24, color = '#464555' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="5" r="2" fill={color} />
      <Circle cx="12" cy="12" r="2" fill={color} />
      <Circle cx="12" cy="19" r="2" fill={color} />
    </Svg>
  );
}

export function BookmarkIcon({ size = 24, color = '#464555' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CommentIcon({ size = 24, color = '#464555' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ShareIcon({ size = 24, color = '#464555' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="18" cy="5" r="3" stroke={color} strokeWidth="2" fill="none" />
      <Circle cx="6" cy="12" r="3" stroke={color} strokeWidth="2" fill="none" />
      <Circle cx="18" cy="19" r="3" stroke={color} strokeWidth="2" fill="none" />
      <Path d="M8.59 13.51l6.83 3.98" stroke={color} strokeWidth="2" />
      <Path d="M15.41 6.51l-6.82 3.98" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export function CheckIcon({ size = 24, color = '#4343d5' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17L4 12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 24, color = '#464555' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M6 6L18 18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function StarIcon({ size = 24, color = '#f59e0b' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={color} />
    </Svg>
  );
}

export function GoogleIcon({ size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

export function ShopIcon({ size = 24, color = '#464555' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke={color} strokeWidth="2" fill="none" />
      <Path d="M3 6h18" stroke={color} strokeWidth="2" />
      <Path d="M16 10a4 4 0 01-8 0" stroke={color} strokeWidth="2" fill="none" />
    </Svg>
  );
}

export function VerifiedIcon({ size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="12" fill="#5d5fef" />
      <Path d="M7 12l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function HomeIcon({ size = 24, color = '#464555' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function HamburgerIcon({ size = 18, color = '#464555' }: IconProps) {
  return (
    <Svg width={size} height={size * 12/18} viewBox="0 0 18 12" fill="none">
      <Path d="M0 1h18v2H0zM0 5h18v2H0zM0 9h18v2H0z" fill={color} />
    </Svg>
  );
}

export function BellIcon({ size = 20, color = '#464555' }: IconProps) {
  return (
    <Svg width={size} height={size * 18/20} viewBox="0 0 20 20" fill="none">
      <Path d="M10 1a7 7 0 00-7 7v3l-2 3h18l-2-3V8a7 7 0 00-7-7z" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 17a2 2 0 004 0" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function BagIcon({ size = 18, color = '#464555' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path d="M4 2L2 6v10a2 2 0 002 2h10a2 2 0 002-2V6l-2-4H4z" stroke={color} strokeWidth="1.5" fill="none" />
      <Path d="M2 6h14" stroke={color} strokeWidth="1.5" />
      <Path d="M12 10a3 3 0 01-6 0" stroke={color} strokeWidth="1.5" fill="none" />
    </Svg>
  );
}

// ─── OTP SCREEN ICONS ───────────────────────────
export function PhoneIcon({ size = 24, color = '#4343d5' }: IconProps) {
  return (
    <Svg width={size} height={size * 19/13} viewBox="0 0 13 19" fill="none">
      <Path d="M1.72727 19C1.25227 19 0.845645 18.8309 0.507387 18.4926C0.169129 18.1544 0 17.7477 0 17.2727V1.72727C0 1.25227 0.169129 0.845645 0.507387 0.507387C0.845645 0.169129 1.25227 0 1.72727 0H10.3636C10.8386 0 11.2453 0.169129 11.5835 0.507387C11.9218 0.845645 12.0909 1.25227 12.0909 1.72727V4.40455C12.35 4.50531 12.5587 4.66364 12.7171 4.87955C12.8754 5.09546 12.9546 5.34016 12.9546 5.61364V7.34092C12.9546 7.6144 12.8754 7.8591 12.7171 8.07501C12.5587 8.29092 12.35 8.44925 12.0909 8.55001V17.2727C12.0909 17.7477 11.9218 18.1544 11.5835 18.4926C11.2453 18.8309 10.8386 19 10.3636 19H1.72727Z" fill={color} />
    </Svg>
  );
}

export function LockArrowIcon({ size = 14, color = '#FAF7FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M10.653 7.8749H0V6.12493H10.653L5.75305 1.22499L6.99991 0L13.9998 6.99991L6.99991 13.9998L5.75305 12.7748L10.653 7.8749Z" fill={color} />
    </Svg>
  );
}

export function GpsTargetIcon({ size = 22, color = '#FAF7FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path d="M9.99544 22V19.9909C7.90259 19.7565 6.10693 18.89 4.60845 17.3916C3.10997 15.8931 2.24353 14.0974 2.00913 12.0046H0V9.99544H2.00913C2.24353 7.90259 3.10997 6.10693 4.60845 4.60845C6.10693 3.10997 7.90259 2.24353 9.99544 2.00913V0H12.0046V2.00913C14.0974 2.24353 15.8931 3.10997 17.3916 4.60845C18.89 6.10693 19.7565 7.90259 19.9909 9.99544H22V12.0046H19.9909C19.7565 14.0974 18.89 15.8931 17.3916 17.3916C15.8931 18.89 14.0974 19.7565 12.0046 19.9909V22H9.99544ZM11 18.032C12.9422 18.032 14.5997 17.3455 15.9726 15.9726C17.3455 14.5997 18.032 12.9422 18.032 11C18.032 9.05784 17.3455 7.40031 15.9726 6.0274C14.5997 4.65449 12.9422 3.96804 11 3.96804C9.05784 3.96804 7.40031 4.65449 6.0274 6.0274C4.65449 7.40031 3.96804 9.05784 3.96804 11C3.96804 12.9422 4.65449 14.5997 6.0274 15.9726C7.40031 17.3455 9.05784 18.032 11 18.032ZM11 15.0183C9.89498 15.0183 8.94901 14.6248 8.1621 13.8379C7.37519 13.051 6.98174 12.105 6.98174 11C6.98174 9.89498 7.37519 8.94901 8.1621 8.1621C8.94901 7.37519 9.89498 6.98174 11 6.98174C12.105 6.98174 13.051 7.37519 13.8379 8.1621C14.6248 8.94901 15.0183 9.89498 15.0183 11C15.0183 12.105 14.6248 13.051 13.8379 13.8379C13.051 14.6248 12.105 15.0183 11 15.0183Z" fill={color} />
    </Svg>
  );
}

export function CameraPlusIcon({ size = 44, color = '#4343d5' }: IconProps) {
  return (
    <Svg width={size} height={size * 40/44} viewBox="0 0 44 40" fill="none">
      <Path d="M4 40C2.9 40 1.95833 39.6083 1.175 38.825C0.391667 38.0417 0 37.1 0 36V12C0 10.9 0.391667 9.95833 1.175 9.175C1.95833 8.39167 2.9 8 4 8H10.3L14 4H26V8H15.75L12.1 12H4V36H36V18H40V36C40 37.1 39.6083 38.0417 38.825 38.825C38.0417 39.6083 37.1 40 36 40H4ZM36 12V8H32V4H36V0H40V4H44V8H40V12H36ZM20 33C22.5 33 24.625 32.125 26.375 30.375C28.125 28.625 29 26.5 29 24C29 21.5 28.125 19.375 26.375 17.625C24.625 15.875 22.5 15 20 15C17.5 15 15.375 15.875 13.625 17.625C11.875 19.375 11 21.5 11 24C11 26.5 11.875 28.625 13.625 30.375C15.375 32.125 17.5 33 20 33ZM20 29C18.6 29 17.4167 28.5167 16.45 27.55C15.4833 26.5833 15 25.4 15 24C15 22.6 15.4833 21.4167 16.45 20.45C17.4167 19.4833 18.6 19 20 19C21.4 19 22.5833 19.4833 23.55 20.45C24.5167 21.4167 25 22.6 25 24C25 25.4 24.5167 26.5833 23.55 27.55C22.5833 28.5167 21.4 29 20 29Z" fill={color} />
    </Svg>
  );
}

export function PencilIcon({ size = 15, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 15 15" fill="none">
      <Path d="M1.66667 13.3333H2.85417L11 5.1875L9.8125 4L1.66667 12.1458V13.3333ZM0 15V11.4583L11 0.479167C11.1667 0.326389 11.3507 0.208333 11.5521 0.125C11.7535 0.0416667 11.9653 0 12.1875 0C12.4097 0 12.625 0.0416667 12.8333 0.125C13.0417 0.208333 13.2222 0.333333 13.375 0.5L14.5208 1.66667C14.6875 1.81944 14.809 2 14.8854 2.20833C14.9618 2.41667 15 2.625 15 2.83333C15 3.05556 14.9618 3.26736 14.8854 3.46875C14.809 3.67014 14.6875 3.85417 14.5208 4.02083L3.54167 15H0ZM13.3333 2.83333L12.1667 1.66667L13.3333 2.83333ZM10.3958 4.60417L9.8125 4L11 5.1875L10.3958 4.60417Z" fill={color} />
    </Svg>
  );
}
