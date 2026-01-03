import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  userInfo: (() => {
    try {
      const userInfo = localStorage.getItem('userInfo');
      return userInfo && userInfo !== 'undefined' ? JSON.parse(userInfo) : null;
    } catch (error) {
      return null;
    }
  })(),
  accessToken: (() => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken || accessToken === 'undefined' || accessToken === 'null') {
        return null;
      }
      // FIXED: Handle both JSON stringified and plain string tokens
      // Try to parse, but if it fails, use the raw value
      try {
        const parsed = JSON.parse(accessToken);
        // If parsed value is still a string (was double-stringified), use it
        return typeof parsed === 'string' ? parsed : accessToken;
      } catch {
        // If parsing fails, token is already a plain string - use it directly
        return accessToken;
      }
    } catch (error) {
      console.error('Error loading accessToken from localStorage:', error);
      return null;
    }
  })(),
  users: [],
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    updateAccessToken: (state, action) => {
      state.accessToken = action.payload;
      // FIXED: Store token as plain string, not JSON (tokens are already strings)
      if (action.payload) {
        localStorage.setItem('accessToken', typeof action.payload === 'string' ? action.payload : JSON.stringify(action.payload));
      } else {
        localStorage.removeItem('accessToken');
      }
    },
    setUserInfo: (state, action) => {
      state.userInfo = action.payload;
      localStorage.setItem('userInfo', JSON.stringify(action.payload));
    },
    setUsers: (state, action) => {
      state.users = action.payload;
    },
    logoutUser: (state) => {
      state.userInfo = null;
      state.accessToken = null;
      state.users = [];
      localStorage.removeItem('userInfo');
      localStorage.removeItem('accessToken');
    },
  },
});

export const { updateAccessToken, setUserInfo, logoutUser } = authSlice.actions;

export default authSlice.reducer;
