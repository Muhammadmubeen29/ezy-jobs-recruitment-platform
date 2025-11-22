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
      return accessToken && accessToken !== 'undefined' ? JSON.parse(accessToken) : null;
    } catch (error) {
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
      localStorage.setItem('accessToken', JSON.stringify(action.payload));
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
