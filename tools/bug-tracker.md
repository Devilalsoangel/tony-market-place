# susej UI/UX Bug Tracker
# Last updated: 2026-09-06

## FIXED ✅
| # | Screen | Bug | Fix | Status |
|---|--------|-----|-----|--------|
| 1 | Notifications | Settings gear button in header (not industry standard) | Removed GearIcon + GearPathIcon from notifications.tsx | ✅ FIXED |

## OPEN BUGS 🐛
| # | Screen | Bug | Severity | Status |
|---|--------|-----|----------|--------|
| 1 | Auth (login.tsx) | OTP input box 5 won't accept input via touch | HIGH | Open |
| 2 | Auth (login.tsx) | App resets to welcome screen on OTP send (navigation bug) | HIGH | Open |
| 3 | Auth (auth.tsx) | Dev bypass modal leaves error on parent after close | MEDIUM | Open |
| 4 | Auth (auth.tsx) | Settings gear opens RN dev menu instead of user settings | MEDIUM | Open |
| 5 | All | No sellers/admins in system (all users are buyers) | HIGH | Open |

## UI/UX INDUSTRY STANDARD CHECKS
| Check | Status | Notes |
|-------|--------|-------|
| Notifications has back button | ✅ | Works |
| Notifications has filter tabs | ✅ | All/Orders/Social |
| Notifications has mark all read | ✅ | Works |
| Settings accessible from feed | ✅ | Via notification gear (now removed - need alternative?) |
| OTP input works | ❌ | Box 5 broken |
| Login flow works | ❌ | Multiple bugs |

## SCREENS TESTED
- [x] Welcome/Get Started screen (3 buttons)
- [x] Auth screen (5 buttons)
- [x] Sign In screen (6 buttons)
- [x] Notifications screen (5 buttons - FIXED)
- [x] Settings screen (many buttons)
- [x] Edit Profile screen (8 buttons)
- [ ] Feed screen (home)
- [ ] Explore screen
- [ ] Orders screen
- [ ] Chat screen
- [ ] Profile screen
- [ ] Saved screen
