import axiosInstance from './axiosInstance';

export const axiosBaseQuery =
  () =>
  async ({ url, method, data, params, headers, ...rest }, { getState }) => {
    try {
      const accessToken = getState().auth.accessToken;

      // FIXED: Only add Authorization header if token exists and is valid
      // CRASH CAUSE: Empty Authorization header can cause backend to reject requests
      // SOLUTION: Only include Authorization header when accessToken is truthy and non-empty
      const requestHeaders = { ...headers };
      if (accessToken && typeof accessToken === 'string' && accessToken.trim() !== '') {
        requestHeaders.Authorization = `Bearer ${accessToken.trim()}`;
      }

      const result = await axiosInstance({
        url,
        method,
        data,
        params,
        headers: requestHeaders,
        ...rest,
      });

      return { data: result.data };
    } catch (axiosError) {
      const err = axiosError;
      return {
        error: {
          status: err.response?.status,
          data: err.response?.data || err.message,
        },
      };
    }
  };
