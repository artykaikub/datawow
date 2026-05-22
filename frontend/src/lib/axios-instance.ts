import Axios, { type AxiosRequestConfig, type AxiosInstance } from 'axios';

// ─── Shared interceptor setup ───

function attachJwtInterceptor(instance: AxiosInstance): void {
  instance.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  });
}

/** Prevents duplicate redirect loops */
let isRedirecting = false;

export function forceLogout() {
  if (isRedirecting) return;
  isRedirecting = true;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
  document.cookie = 'auth_role=; path=/; max-age=0';
  window.location.href = '/login';
}

function attachAutoLogoutInterceptor(instance: AxiosInstance): void {
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response?.status;
      const url = error.config?.url || '';
      const isAuthEndpoint =
        url.includes('/auth/login') || url.includes('/auth/register');

      if (status === 401 && !isAuthEndpoint) {
        forceLogout();
      }
      return Promise.reject(error);
    },
  );
}

function setupInstance(baseURL: string): AxiosInstance {
  const instance = Axios.create({ baseURL });
  attachJwtInterceptor(instance);
  attachAutoLogoutInterceptor(instance);
  return instance;
}

// ─── Core Service (port 4000) ───

const AXIOS_INSTANCE = setupInstance(
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
);

/**
 * Orval mutator for core-service API calls.
 */
export const axiosInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  const controller = new AbortController();
  const promise = AXIOS_INSTANCE({
    ...config,
    signal: controller.signal,
  }).then(({ data }) => data);

  // @ts-expect-error — attach cancel method for React Query compatibility
  promise.cancel = () => {
    controller.abort('Query was cancelled');
  };

  return promise;
};

export default AXIOS_INSTANCE;

// ─── Audit Service (port 4001) ───

const AUDIT_AXIOS_INSTANCE = setupInstance(
  process.env.NEXT_PUBLIC_AUDIT_API_URL || 'http://localhost:4001',
);

/**
 * Orval mutator for audit-service API calls.
 */
export const auditAxiosInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  const controller = new AbortController();
  const promise = AUDIT_AXIOS_INSTANCE({
    ...config,
    signal: controller.signal,
  }).then(({ data }) => data);

  // @ts-expect-error — attach cancel method for React Query compatibility
  promise.cancel = () => {
    controller.abort('Query was cancelled');
  };

  return promise;
};
