import axios from "axios";

export type ApiErrorPayload = {
  detail?: string;
  [key: string]: unknown;
};

export const getErrorStatus = (error: unknown): number | undefined => {
  if (!axios.isAxiosError(error)) {
    return undefined;
  }
  return error.response?.status;
};

export const getErrorData = (error: unknown): ApiErrorPayload | undefined => {
  if (!axios.isAxiosError(error)) {
    return undefined;
  }

  const data = error.response?.data;
  if (!data || typeof data !== "object") {
    return undefined;
  }

  return data as ApiErrorPayload;
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  const data = getErrorData(error);
  const detail = data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  return fallback;
};

export const getErrorFieldMessages = (
  error: unknown,
  field: string,
): string[] => {
  const data = getErrorData(error);
  const value = data?.[field];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
};
