import axios from 'axios';
import { toast } from 'react-toastify';

// Create axios instance
const api = axios.create({
    baseURL: '/api', // Proxy in vite config handles /api -> http://localhost:5001/api
    withCredentials: true, // Send cookies with every request
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor
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
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

export const setAccessToken = (token) => {
    const cleanToken = (token && token !== 'null' && token !== 'undefined' && String(token).trim()) ? String(token).trim() : null;
    accessToken = cleanToken;
    try {
        if (cleanToken) {
            localStorage.setItem('mano_access_token', cleanToken);
        } else {
            localStorage.removeItem('mano_access_token');
        }
    } catch (e) {
        console.warn('Unable to persist access token to localStorage', e);
    }
};

export const getAccessToken = () => accessToken;

export const refreshAccessToken = async () => {
    if (isRefreshing) {
        return new Promise((resolve) => {
            failedQueue.push({ resolve: (token) => resolve(token), reject: () => resolve(null) });
        });
    }
    isRefreshing = true;
    try {
        const res = await api.post('/auth/refresh');
        if (res.status === 200 && res.data?.accessToken) {
            const newAccessToken = res.data.accessToken;
            setAccessToken(newAccessToken);
            processQueue(null, newAccessToken);
            return newAccessToken;
        }
    } catch (err) {
        processQueue(err, null);
        return null;
    } finally {
        isRefreshing = false;
    }
    return null;
};

api.interceptors.request.use(
    (config) => {
        if (accessToken) {
            config.headers['Authorization'] = `Bearer ${accessToken}`;
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

        if ((error.response?.status === 403 || error.response?.status === 401) && !originalRequest._retry) {

            // Prevent infinite loops if refresh itself fails
            if (originalRequest.url.includes('/auth/refresh')) {
                return Promise.reject(error);
            }

            // Don't try to refresh if the login attempt itself failed
            if (originalRequest.url.includes('/auth/login')) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const res = await api.post('/auth/refresh');
                if (res.status === 200) {
                    const newAccessToken = res.data.accessToken;
                    setAccessToken(newAccessToken);
                    processQueue(null, newAccessToken);

                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                processQueue(refreshError, null);
                setAccessToken(null);
                try {
                    sessionStorage.clear();
                } catch (e) {}
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        if (error.response && error.response.status >= 500) {
            console.error("Server Error:", error.response.data);
        }

        return Promise.reject(error);
    }
);

export default api;
