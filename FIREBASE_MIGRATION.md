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

## 📋 TODO (Next Steps)

### Phase 1: Environment & Deployment
- [ ] **Set Firebase environment variables** in `.env`:
  ```
  FIREBASE_PROJECT_ID=your-firebase-project-id
  BOOTSTRAP_SECRET=your-secure-random-secret
  ```
- [ ] **Download Firebase service account key** from Firebase Console
- [ ] **Set up ADC** (Application Default Credentials):
  ```bash
  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
  ```
- [ ] **Test Firebase Admin SDK initialization** (run the app, check logs)

### Phase 2: Route Migration (Optional - Gradual)
Routes currently use the old `X-User-Id` header. You can:
- **Option A (Quick)**: Keep using `X-User-Id` header via the RBAC fallback
- **Option B (Recommended)**: Gradually migrate routes to use Firebase auth middleware

Example migration for a route:
```typescript
import { firebaseAuth } from "../middleware/firebase-auth";

router.get("/me", firebaseAuth, async (c) => {
  const authUser = c.get("authUser");
  const userId = authUser.userId; // Now from Firebase
  // ...
});
```

### Phase 3: Database Migration
- [ ] **Decide**: Keep SQLite or migrate to Firestore?
  - **SQLite**: Keep local, backup to S3
  - **Firestore**: Full Firebase integration, better for distributed systems
- [ ] If **SQLite**: Update backup strategy to use S3 instead of local filesystem
- [ ] If **Firestore**: Replace Prisma models with Firebase SDK

### Phase 4: Testing
- [ ] **Test Firebase Auth middleware** in dev mode with test tokens
- [ ] **Test BOOTSTRAP_SECRET** from env var
- [ ] **Test RBAC** with new Firebase auth
- [ ] **Run full integration tests** before production

### Phase 5: Production Deployment
- [ ] **Remove `X-User-Id` fallback** from RBAC once all routes migrated
- [ ] **Lock down CORS** to production domain only
- [ ] **Enable Firebase security rules** (if using Firestore)
- [ ] **Monitor logs** for any auth failures

## 🔒 Security Summary

| Risk | Status | Fix |
|------|--------|-----|
| Fake auth (X-User-Id header) | ⚠️ Mitigated | Firebase middleware available; routes still support header fallback |
| Hardcoded secret in git | ✅ Fixed | Now env var only |
| Debug endpoint leak | ✅ Fixed | Endpoint deleted |
| VibeCode lock-in | ✅ Fixed | Dependencies removed, standalone backend |
| No real auth | ⏳ Partial | Firebase auth ready, but routes not yet using it |

## 📚 Quick Reference

**Firebase Middleware Usage:**
```typescript
import { firebaseAuth } from "../middleware/firebase-auth";

router.get("/protected", firebaseAuth, (c) => {
  const authUser = c.get("authUser");
  console.log(authUser.firebaseUid); // ← Firebase UID
});
```

**Test Token (Dev Mode):**
```bash
# Create a base64-encoded test token
echo '{"uid":"test-user-123","email":"test@example.com"}' | base64

# Use it in requests:
curl -H "Authorization: Bearer eyJ1aWQiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0=" \
  http://localhost:3000/api/protected
```

**Environment Variables:**
```bash
# .env
FIREBASE_PROJECT_ID=luz-diaria-prod
BOOTSTRAP_SECRET=super-secret-bootstrap-key-change-me
APP_ENV=prod
DATABASE_URL="file:./prod.db"
```
