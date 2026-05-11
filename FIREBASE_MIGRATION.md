# Firebase Migration Checklist

## ✅ Completed (Critical Security Fixes)

### 1. ✅ Removed Hardcoded Secret
- **File**: `src/index.ts`
- **Change**: Moved `BOOTSTRAP_SECRET` from hardcoded string to environment variable
- **Location**: Now read from `env.BOOTSTRAP_SECRET`
- **Action**: Set `BOOTSTRAP_SECRET` in your `.env` file before running

### 2. ✅ Deleted Unauthenticated Debug Endpoint
- **File**: `src/index.ts`
- **Removed**: `GET /api/debug/env` (was leaking all users + DB URL)
- **Impact**: No public endpoint exposes sensitive data anymore

### 3. ✅ Removed VibeCode Dependencies
- **Removed packages**:
  - `@vibecodeapp/proxy`
  - `@vibecodeapp/backend-sdk`
  - `@vibecodeapp/cloud-studio`
- **Deleted files**: `src/lib/vibecode.ts`
- **Impact**: Standalone backend, no VibeCode platform lock-in

### 4. ✅ Updated CORS
- **File**: `src/index.ts`
- **Removed**: VibeCode domain allowlist (`*.vibecode.run`)
- **Current**: Only `localhost` and `127.0.0.1`
- **Action**: Add your production domain to the allowlist

### 5. ✅ Created Firebase Auth Middleware
- **File**: `src/middleware/firebase-auth.ts`
- **Features**:
  - Verifies Firebase ID tokens from `Authorization: Bearer <token>` header
  - Production: uses Firebase Admin SDK to verify tokens
  - Dev: accepts JWT-like or base64 tokens for easy testing
  - Auto-creates users on first login
- **Usage**: Add to protected routes

### 6. ✅ Installed Firebase Admin SDK
- **Package**: `firebase-admin` (installed & committed)

### 7. ✅ Updated RBAC Middleware
- **File**: `src/middleware/rbac.ts`
- **Change**: Now supports both Firebase auth context + fallback to `X-User-Id` header
- **Backward Compatible**: Still works with old header-based auth during transition

### 8. ✅ Created Firebase Initialization Module
- **File**: `src/firebase.ts`
- **Handles**: Firebase Admin SDK setup, token verification

### 9. ✅ Secured All 27 Gamification Write Endpoints
- **File**: `src/routes/gamification.ts`
- **What**: Added `firebaseAuth` middleware + ownership validation to every write endpoint
- **Endpoints**: POST/PATCH for points, store, challenges, collections, trades, promo codes, device, country, etc.
- **Pattern**: All user data modifications now require Firebase ID token + ownership check
- **Admin routes**: `challenges/next-round`, `challenges/admin/*` locked behind `requireRole("OWNER")`

## 📋 TODO (Next Steps) — Concise Priority Guide

### IMMEDIATE (Before Production)
1. **Firebase Credentials Setup**
   - [ ] Create Firebase project: https://console.firebase.google.com
   - [ ] Enable Authentication (Google, Email, or custom)
   - [ ] Download service account key → save as `firebase-key.json`
   - [ ] Add to `.env`: `GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-key.json`
   - [ ] Verify with: `npm run dev` — check logs for Firebase init success

2. **Production CORS**
   - [ ] Edit `src/index.ts` line ~30
   - [ ] Replace `localhost` with your production domain
   - [ ] Example: `allowedOrigins: ["https://luz-diaria.com", "https://www.luz-diaria.com"]`
   - [ ] Commit: `git commit -m "chore: configure production CORS"`

3. **Test All Endpoints Locally**
   - [ ] Start dev server: `npm run dev`
   - [ ] Test a protected endpoint with test token (see Quick Reference below)
   - [ ] Verify 403 Forbidden when attempting cross-user access
   - [ ] Verify admin endpoints reject non-OWNER users

### SHORT TERM (First Week)
4. **Remove X-User-Id Fallback (Gradual)**
   - [ ] All gamification routes now use `firebaseAuth` — no need for fallback
   - [ ] Check `src/middleware/rbac.ts` — can simplify `requireRole()` to only use Firebase auth
   - [ ] Other route files: audit for remaining `X-User-Id` usage, migrate to Firebase auth
   - [ ] Only `/api/bootstrap/*` endpoints should bypass user auth (use `BOOTSTRAP_SECRET` instead)

5. **Document for Team**
   - [ ] Create `DEPLOYMENT.md` with:
     - Firebase project setup steps
     - How to generate Firebase ID tokens (for testing)
     - Environment variables checklist
     - Verification checklist before deploy

### MEDIUM TERM (Ongoing)
6. **Database & Backups**
   - [ ] Decide: Keep SQLite or migrate to Firestore?
     - **SQLite path**: Better for monolithic, single-region deployment. Keep schema, add S3 backups
     - **Firestore path**: Better for distributed systems, cross-region, scale. Requires major refactor
   - [ ] If SQLite: Set up automated daily backups to S3/Google Cloud Storage
   - [ ] If Firestore: Enable automatic backups in Firebase Console

7. **Monitoring & Logging**
   - [ ] Configure Firebase Cloud Logging (view auth events, errors)
   - [ ] Add application-level logging for security events (already in place: `console.warn` for access violations)
   - [ ] Set up alerts for repeated 403 errors (possible attack)

8. **Finish Removing VibeCode**
   - [ ] Check all route files for remaining VibeCode imports/references
   - [ ] Remove VibeCode-specific logic (already done in gamification.ts)

### FUTURE (Post-Launch)
9. **API Documentation**
   - [ ] Generate OpenAPI/Swagger docs for all endpoints
   - [ ] Document auth header format: `Authorization: Bearer <Firebase_ID_Token>`
   - [ ] Include example requests with test tokens

10. **Testing Infrastructure**
    - [ ] Set up Firebase Emulator Suite for CI/CD
    - [ ] Write integration tests that verify auth on all protected endpoints
    - [ ] Add E2E tests simulating multi-user scenarios (cross-user access attempts)

## 🔒 Security Summary

| Risk | Status | Fix |
|------|--------|-----|
| Fake auth (X-User-Id header) | ⏳ Mitigated | Firebase middleware applied to all endpoints; X-User-Id fallback available for non-gamification routes |
| Hardcoded secret in git | ✅ Fixed | Now env var only |
| Debug endpoint leak | ✅ Fixed | Endpoint deleted |
| VibeCode lock-in | ✅ Fixed | Dependencies removed, standalone backend |
| Unprotected user write endpoints | ✅ Fixed | All 27 gamification endpoints now require Firebase auth + ownership check |
| Cross-user access | ✅ Blocked | Ownership validation prevents users from modifying others' data |

## 📚 Quick Reference

**Firebase Middleware Usage:**
```typescript
import { firebaseAuth } from "../middleware/firebase-auth";

router.post("/protected", firebaseAuth, zValidator("json", schema), async (c) => {
  // @ts-ignore
  const authUser = c.get("authUser") as any;
  const userId = authUser?.userId;
  
  // Ownership check example (user can only modify their own data)
  if (userId !== requestedUserId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  // ... proceed with operation
});
```

**Test Token (Dev Mode):**
```bash
# Create a base64-encoded test token
echo '{"uid":"test-user-123","email":"test@example.com"}' | base64
# Output: eyJ1aWQiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0=

# Use it in requests:
curl -H "Authorization: Bearer eyJ1aWQiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0=" \
  http://localhost:3000/api/protected

# Test cross-user access (should return 403):
curl -X POST http://localhost:3000/api/user/another-user-id/device \
  -H "Authorization: Bearer eyJ1aWQiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0=" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"new-device"}'
```

**Environment Variables Checklist:**
```bash
# .env file (or .env.production for prod)
APP_ENV=dev                                          # 'dev' or 'prod'
FIREBASE_PROJECT_ID=luz-diaria-dev                   # Firebase project ID
GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-key.json  # Service account JSON
BOOTSTRAP_SECRET=your-secure-random-bootstrap-key-here     # For /api/bootstrap/* endpoints
DATABASE_URL="file:./dev.db"                         # Prisma DB URL
OPENAI_API_KEY=sk-xxx...                             # Optional: for devotional generation
```

**Quick Health Check:**
```bash
# Start the app
npm run dev

# In another terminal, test health + Firebase init
curl http://localhost:3000/api/health

# Should return 200 + logs should show "Firebase Admin SDK initialized"

# Test an unprotected endpoint
curl http://localhost:3000/api/seasons

# Test a protected endpoint without auth (should 401)
curl -X POST http://localhost:3000/api/store/purchase-bundle \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","bundleId":"bundle-1","itemIds":[],"bundlePrice":100}'
# Response: {"error":"Unauthorized"} 401

# Test with test token (should work)
TEST_TOKEN=$(echo '{"uid":"test-user","email":"test@example.com"}' | base64)
curl -X POST http://localhost:3000/api/store/purchase-bundle \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","bundleId":"bundle-1","itemIds":[],"bundlePrice":100}'
```
