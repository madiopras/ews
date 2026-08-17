# Auth Testing Playbook (Emergent Google Auth + existing JWT auth)

This app supports TWO login methods side by side:

1. **Email + password** (existing): `POST /api/auth/register`, `POST /api/auth/login`
   → sets httponly `access_token` JWT cookie (7 days).
2. **Google (Emergent-managed OAuth)**:
   - Frontend redirects to `https://auth.emergentagent.com/?redirect={window.location.origin}/profile`
     (see `/app/frontend/src/components/GoogleButton.jsx`).
     REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
   - Google returns to `{origin}/profile#session_id=...`.
   - `AppShell` (in `/app/frontend/src/App.js`) detects `location.hash` containing `session_id=`
     during render and shows `AuthCallback` (`/app/frontend/src/components/AuthCallback.jsx`).
   - `AuthCallback` calls `POST /api/auth/google/session {session_id}`.
   - Backend calls `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data`
     with header `X-Session-ID`, then upserts the user by email (merging with an existing
     email/password account, keeping its `role`), stores the emergent `session_token` in
     `user_sessions`, and finally sets our own `access_token` JWT cookie.
   - `AuthContext` skips `/auth/me` when the URL hash contains `session_id=`.

## Users collection
`users`: `{_id (ObjectId), email, name, role, password_hash?, google_id?, picture?, auth_provider?, wishlist}`
`user_sessions`: `{user_id, session_token, expires_at, created_at}`

Auth for every protected endpoint = `access_token` cookie (or `Authorization: Bearer <jwt>`).

## Backend testing
```bash
API=https://wisata-sumut-guide.preview.emergentagent.com

# password login (admin)
curl -s -c /tmp/c -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@wisatasumut.id","password":"admin123"}'
curl -s -b /tmp/c $API/api/auth/me

# google session exchange with an invalid session id must be 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/auth/google/session \
  -H 'Content-Type: application/json' -d '{"session_id":"invalid-session-id-123"}'
```

## Simulating a logged-in Google user (browser tests)
The Emergent OAuth handshake cannot be faked, so create the user + a JWT cookie directly:

```bash
# create a google-style user, then mint a JWT with the app secret
python3 - <<'EOF'
import os, jwt, pymongo
from datetime import datetime, timezone, timedelta
from dotenv import dotenv_values
env = dotenv_values('/app/backend/.env')
cli = pymongo.MongoClient(env['MONGO_URL'])
db = cli[env['DB_NAME']]
email = 'googletest@example.com'
u = db.users.find_one({'email': email}) or {'_id': db.users.insert_one({
    'email': email, 'name': 'Google Test', 'role': 'user', 'wishlist': [],
    'google_id': 'g-test-1', 'auth_provider': 'google',
    'created_at': datetime.now(timezone.utc).isoformat()}).inserted_id}
token = jwt.encode({'sub': str(u['_id']), 'email': email, 'type': 'access',
                    'exp': datetime.now(timezone.utc) + timedelta(days=7)},
                   env['JWT_SECRET'], algorithm='HS256')
print(token)
EOF
```

Then in Playwright:
```python
await page.context.add_cookies([{ "name": "access_token", "value": TOKEN,
  "domain": "wisata-sumut-guide.preview.emergentagent.com", "path": "/",
  "httpOnly": True, "secure": True, "sameSite": "None" }])
```

## Frontend checks
- `/login` shows `google-login-btn`, `/register` shows `google-register-btn`,
  `/profile` (guest) shows `google-profile-btn`.
- Clicking the button navigates to `auth.emergentagent.com` with
  `redirect={origin}/profile` (URL-encoded).
- Visiting `/profile#session_id=fake` renders `auth-callback`, then falls back to `/login`
  with an error toast (invalid session).
- Email/password login must keep working unchanged (no regression).

## Test identities
- Password admin: `admin@wisatasumut.id` / `admin123`
- Google test identity: any real Google account works; app role defaults to `user`.
  No app-managed password exists for Google accounts.
