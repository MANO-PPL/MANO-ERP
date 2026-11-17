import axios from 'axios';

// Create axios instance
const api = axios.create({
    baseURL: '/api', // Proxy in vite config handles /api -> http://localhost:5001/api
    withCredentials: true, // Send cookies with every request
    headers: {
        'Content-Type': 'application/json',
    },
});

let accessToken = (() => {
    try {
        const stored = localStorage.getItem('mano_access_token');
        if (stored && stored !== 'null' && stored !== 'undefined' && stored.trim()) {
            return stored.trim();
        }
        return null;
    } catch {
        return null;
    }
})();

let refreshToken = (() => {
    try {
        const stored = localStorage.getItem('mano_refresh_token');
        if (stored && stored !== 'null' && stored !== 'undefined' && stored.trim()) {
            return stored.trim();
        }
        return null;
    } catch {
        return null;
    }
})();

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

export const setTokens = (newAccess, newRefresh) => {
    const cleanAccess =
        newAccess && newAccess !== 'null' && newAccess !== 'undefined' && String(newAccess).trim()
            ? String(newAccess).trim()
            : null;
    const cleanRefresh =
        newRefresh && newRefresh !== 'null' && newRefresh !== 'undefined' && String(newRefresh).trim()
            ? String(newRefresh).trim()
            : null;

    accessToken = cleanAccess;
    if (newRefresh !== undefined) {
        refreshToken = cleanRefresh;
    }

    try {
        if (cleanAccess) {
            localStorage.setItem('mano_access_token', cleanAccess);
        } else {
            localStorage.removeItem('mano_access_token');
        }

        if (cleanRefresh) {
            localStorage.setItem('mano_refresh_token', cleanRefresh);
        } else if (newRefresh === null) {
            localStorage.removeItem('mano_refresh_token');
        }
    } catch (e) {
        console.warn('Unable to persist tokens to localStorage', e);
    }
};

export const setAccessToken = (token) => {
    setTokens(token, undefined);
};

export const setRefreshToken = (token) => {
    setTokens(accessToken, token);
};

export const getAccessToken = () => {
    if (accessToken) return accessToken;
    try {
        const stored = localStorage.getItem('mano_access_token');
        if (stored && stored !== 'null' && stored !== 'undefined' && stored.trim()) {
            accessToken = stored.trim();
            return accessToken;
        }
    } catch {}
    return null;
};

export const getRefreshToken = () => {
    if (refreshToken) return refreshToken;
    try {
        const stored = localStorage.getItem('mano_refresh_token');
        if (stored && stored !== 'null' && stored !== 'undefined' && stored.trim()) {
            refreshToken = stored.trim();
            return refreshToken;
        }
    } catch {}
    return null;
};

export const refreshAccessToken = async () => {
    if (isRefreshing) {
        return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
        });
    }
    isRefreshing = true;
    try {
        const currentRefreshToken = getRefreshToken();
        const body = currentRefreshToken ? { refreshToken: currentRefreshToken } : {};
        const headers = currentRefreshToken ? { 'x-refresh-token': currentRefreshToken } : {};

        // Use direct axios to avoid triggering the interceptor
        const res = await axios.post('/api/auth/refresh', body, {
            withCredentials: true,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
        });

        if (res.status === 200 && res.data?.accessToken) {
            const newAccessToken = res.data.accessToken;
            const newRefreshToken = res.data.refreshToken || currentRefreshToken;
            setTokens(newAccessToken, newRefreshToken);
            processQueue(null, newAccessToken);
            return newAccessToken;
        }
        throw new Error('Refresh response missing access token');
    } catch (err) {
        processQueue(err, null);
        return null;
    } finally {
        isRefreshing = false;
    }
};

// Request Interceptor
api.interceptors.request.use(
    (config) => {
        const token = getAccessToken();
        if (token) {
            if (config.headers?.set) {
                config.headers.set('Authorization', `Bearer ${token}`);
                config.headers.set('x-access-token', token);
            } else {
                config.headers = config.headers || {};
                config.headers['Authorization'] = `Bearer ${token}`;
                config.headers['x-access-token'] = token;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor
api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (!originalRequest) {
            return Promise.reject(error);
        }

        // Only handle 401 Unauthorized for token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            // Prevent loops if refresh itself or login endpoint returned 401
            if (
                originalRequest.url?.includes('/auth/refresh') ||
                originalRequest.url?.includes('/auth/login')
            ) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        if (originalRequest.headers?.set) {
                            originalRequest.headers.set('Authorization', `Bearer ${token}`);
                            originalRequest.headers.set('x-access-token', token);
                        } else {
                            originalRequest.headers = originalRequest.headers || {};
                            originalRequest.headers['Authorization'] = `Bearer ${token}`;
                            originalRequest.headers['x-access-token'] = token;
                        }
                        return api(originalRequest);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;

            try {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    if (originalRequest.headers?.set) {
                        originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
                        originalRequest.headers.set('x-access-token', newToken);
                    } else {
                        originalRequest.headers = originalRequest.headers || {};
                        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                        originalRequest.headers['x-access-token'] = newToken;
                    }
                    return api(originalRequest);
                } else {
                    throw new Error('Session refresh failed');
                }
            } catch (refreshError) {
                setTokens(null, null);
                try {
                    localStorage.removeItem('mano_access_token');
                    localStorage.removeItem('mano_refresh_token');
                    sessionStorage.clear();
                    document.cookie = 'userType=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0';
                } catch (e) {}

                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            }
        }

        if (error.response && error.response.status >= 500) {
            console.error('Server Error:', error.response.data);
        }

        return Promise.reject(error);
    }
);

export default api;
