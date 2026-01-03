# 401 Unauthorized Error Fix

## Issue
Getting 401 errors when trying to access:
- `/api/v1/applications?role=recruiter`
- `/api/v1/users/interviewers`

## Root Cause
Authentication token is either:
1. Missing from localStorage
2. Expired
3. Stored incorrectly (double-stringified)
4. Not being sent in request headers

## Fixes Applied

### 1. ✅ Improved Token Storage
**File**: `client/src/features/auth/authSlice.js`
- Fixed token storage to handle both JSON and plain string formats
- Improved token retrieval with better error handling
- Prevents double-stringification issues

### 2. ✅ Enhanced Token Extraction
**File**: `client/src/api/axiosBaseQuery.js`
- Better handling of tokens stored as JSON strings
- Automatically unwraps double-stringified tokens
- Added debug logging (development only)

## Solution

### Option 1: Logout and Login Again (Recommended)
1. Logout from the application
2. Login again to get a fresh token
3. The token will be stored correctly

### Option 2: Clear Browser Storage
1. Open DevTools (F12)
2. Go to Application/Storage tab
3. Clear localStorage
4. Refresh the page and login again

### Option 3: Check Token in Console
```javascript
// In browser console, check:
localStorage.getItem('accessToken')
localStorage.getItem('userInfo')
```

## Verification

After logging in again, check:
1. Browser console should show no 401 errors
2. Applications page should load
3. Interviewer dropdown should populate

## If Still Getting 401

1. **Check if you're logged in**: Look at the Redux state or localStorage
2. **Check token format**: Should be a plain string, not wrapped in quotes
3. **Check backend logs**: Look for JWT verification errors
4. **Try logout/login**: This will refresh the token

The code fixes are in place - you just need to login again to get a properly stored token!





