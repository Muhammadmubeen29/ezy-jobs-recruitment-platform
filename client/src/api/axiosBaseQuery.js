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
      
      // Handle token that might be stored as JSON string
      let tokenValue = accessToken;
      if (tokenValue && typeof tokenValue !== 'string') {
        // If token is an object or other type, try to stringify it
        tokenValue = String(tokenValue);
      }
      
      // Remove quotes if token was double-stringified (stored as JSON string)
      if (tokenValue && tokenValue.startsWith('"') && tokenValue.endsWith('"')) {
        try {
          tokenValue = JSON.parse(tokenValue);
        } catch {
          // If parsing fails, use the value as-is after removing quotes manually
          tokenValue = tokenValue.slice(1, -1);
        }
      }
      
      if (tokenValue && typeof tokenValue === 'string' && tokenValue.trim() !== '') {
        requestHeaders.Authorization = `Bearer ${tokenValue.trim()}`;
      } else {
        // Debug: Log when token is missing (only in development)
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ No access token found for request:', url);
        }
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
