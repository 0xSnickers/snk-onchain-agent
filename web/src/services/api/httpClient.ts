import axios, { type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import type { ApiResponse } from '@/types/api';
import { getCurrentLocale } from '@/i18n/config';
import { AppApiError, normalizeApiError } from './apiError';
import { getAuthToken } from './authToken';

export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 35000,
});

type UnauthorizedHandler = (error: AppApiError) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

function setHeader(config: InternalAxiosRequestConfig, key: string, value: string) {
  if ('set' in config.headers && typeof config.headers.set === 'function') {
    config.headers.set(key, value);
    return;
  }

  (config.headers as Record<string, string>)[key] = value;
}

function createRequestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isBusinessError(data: unknown): data is ApiResponse<unknown> {
  if (!data || typeof data !== 'object' || !('code' in data)) {
    return false;
  }

  const code = (data as { code?: number | string }).code;
  return code !== 0 && code !== 200 && code !== '0' && code !== '200';
}

httpClient.interceptors.request.use((config) => {
  const token = getAuthToken();

  setHeader(config, 'Accept-Language', getCurrentLocale());
  setHeader(config, 'X-Request-ID', createRequestId());

  if (token) {
    setHeader(config, 'Authorization', `Bearer ${token}`);
  }

  return config;
});

httpClient.interceptors.response.use(
  (response) => {
    if (isBusinessError(response.data)) {
      throw new AppApiError(response.data.message, {
        code: response.data.code,
        status: response.status,
        details: response.data,
      });
    }

    return response;
  },
  (error) => {
    const normalizedError = normalizeApiError(error);

    if (normalizedError.status === 401) {
      unauthorizedHandler?.(normalizedError);
    }

    return Promise.reject(normalizedError);
  },
);
