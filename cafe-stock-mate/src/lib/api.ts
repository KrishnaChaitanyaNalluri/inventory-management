import {
  InventoryItem,
  InventoryTransaction,
  Category,
  StorageLocation,
  ActionType,
  TransactionReason,
  REASON_LABELS,
} from '@/types/inventory';

const envApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '') ?? '';
/** In dev, omit VITE_API_URL to use Vite proxy `/api` → backend (same origin as the UI). */
const BASE_URL = envApiUrl || (import.meta.env.DEV ? '/api' : '');

function assertApiUrl(): string {
  if (!BASE_URL) {
    throw new Error('VITE_API_URL is not set. Configure it for production builds.');
  }
  return BASE_URL;
}
const TOKEN_KEY = 'dumont_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function formatApiErrorDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e: { msg?: string; loc?: unknown }) => e?.msg ?? JSON.stringify(e))
      .join('; ');
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    return String((detail as { message: string }).message);
  }
  return 'Request failed';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = assertApiUrl();
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(
        'Cannot reach the API. Start the backend on port 8000. In local dev, remove VITE_API_URL from .env so requests use the Vite proxy (/api).',
      );
    }
    throw e;
  }

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(formatApiErrorDetail(err.detail));
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ── Response shapes from backend (snake_case) ─────────────────────────────────

interface ApiItem {
  id: string;
  name: string;
  category: string;
  sub_category: string | null;
  unit: string;
  current_quantity: number;
  offsite_quantity: number;
  low_stock_threshold: number;
  storage_location: string | null;
  note: string | null;
  updated_at: string;
}

interface ApiTransaction {
  id: string;
  item_id: string;
  item_name: string;
  unit: string;
  action: string;
  quantity: number;
  reason: string;
  note: string | null;
  employee_id: string;
  employee_name: string;
  timestamp: string;
}

interface ApiLoginResponse {
  token: string;
  user_id: string;
  name: string;
  role: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

export function mapItem(r: ApiItem): InventoryItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category as Category,
    subCategory: r.sub_category ?? undefined,
    unit: r.unit,
    currentQuantity: r.current_quantity,
    offsiteQuantity: r.offsite_quantity ?? 0,
    lowStockThreshold: r.low_stock_threshold,
    storageLocation: (r.storage_location ?? undefined) as StorageLocation | undefined,
    note: r.note ?? undefined,
    updatedAt: r.updated_at,
  };
}

export function mapTransaction(r: ApiTransaction): InventoryTransaction {
  return {
    id: r.id,
    itemId: r.item_id,
    itemName: r.item_name,
    unit: r.unit,
    action: r.action as ActionType,
    quantity: r.quantity,
    reason: (r.reason in REASON_LABELS ? r.reason : 'manual_correction') as TransactionReason,
    note: r.note ?? undefined,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    timestamp: r.timestamp,
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function apiLogin(identifier: string, pin: string): Promise<ApiLoginResponse> {
  return request<ApiLoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, pin }),
  });
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function apiGetItems(params?: {
  category?: string;
  sub_category?: string;
  search?: string;
  low_stock?: boolean;
}): Promise<InventoryItem[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.sub_category) qs.set('sub_category', params.sub_category);
  if (params?.search) qs.set('search', params.search);
  if (params?.low_stock) qs.set('low_stock', 'true');
  const query = qs.toString();
  const rows = await request<ApiItem[]>(`/items${query ? `?${query}` : ''}`);
  return rows.map(mapItem);
}

export async function apiAdjustItem(
  itemId: string,
  body: { action: string; quantity: number; reason: string; note?: string },
): Promise<InventoryTransaction> {
  const row = await request<ApiTransaction>(`/items/${itemId}/adjust`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return mapTransaction(row);
}

export async function apiUpdateThreshold(itemId: string, threshold: number): Promise<void> {
  await request(`/items/${itemId}/threshold`, {
    method: 'PATCH',
    body: JSON.stringify({ threshold }),
  });
}

export interface UpdateItemMetadataBody {
  name: string;
  unit: string;
  category: string;
  sub_category?: string | null;
  storage_location?: string | null;
  note?: string | null;
}

export async function apiUpdateItemMetadata(itemId: string, body: UpdateItemMetadataBody): Promise<InventoryItem> {
  const row = await request<ApiItem>(`/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return mapItem(row);
}

export async function apiDeleteItem(itemId: string): Promise<void> {
  await request<void>(`/items/${itemId}`, { method: 'DELETE' });
}

export async function apiAdjustOffsite(
  itemId: string,
  body: { action: 'add' | 'subtract'; quantity: number; reason: string; note?: string },
): Promise<InventoryTransaction> {
  const row = await request<ApiTransaction>(`/items/${itemId}/adjust-offsite`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return mapTransaction(row);
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function apiGetTransactions(params?: {
  action?: string;
  limit?: number;
}): Promise<InventoryTransaction[]> {
  const qs = new URLSearchParams();
  if (params?.action) qs.set('action', params.action);
  if (params?.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  const rows = await request<ApiTransaction[]>(`/transactions${query ? `?${query}` : ''}`);
  return rows.map(mapTransaction);
}

// ── Users (admin) ───────────────────────────────────────────────────────────────

export interface ApiUserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

export async function apiListUsers(): Promise<ApiUserRow[]> {
  return request<ApiUserRow[]>('/users');
}

export async function apiCreateUser(body: {
  name: string;
  identifier: string;
  pin: string;
  role: string;
}): Promise<ApiUserRow> {
  return request<ApiUserRow>('/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function apiUpdateUser(
  userId: string,
  body: { name?: string; role?: string; pin?: string },
): Promise<ApiUserRow> {
  return request<ApiUserRow>(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function apiDeleteUser(userId: string): Promise<void> {
  await request<void>(`/users/${userId}`, { method: 'DELETE' });
}

export async function apiCreateItem(body: {
  name: string;
  category: string;
  sub_category?: string;
  unit: string;
  current_quantity?: number;
  low_stock_threshold?: number;
  storage_location?: string;
  note?: string;
}): Promise<InventoryItem> {
  const row = await request<ApiItem>('/items', {
    method: 'POST',
    body: JSON.stringify({
      name: body.name,
      category: body.category,
      sub_category: body.sub_category ?? null,
      unit: body.unit,
      current_quantity: body.current_quantity ?? 0,
      low_stock_threshold: body.low_stock_threshold ?? 1,
      storage_location: body.storage_location ?? null,
      note: body.note ?? null,
    }),
  });
  return mapItem(row);
}

// ── Feedback (bugs / enhancements) ────────────────────────────────────────────

export type FeedbackCategory = 'bug' | 'enhancement';

export interface ApiFeedbackRow {
  id: string;
  user_id: string;
  user_name: string;
  category: string;
  message: string;
  created_at: string;
}

export async function apiSubmitFeedback(body: {
  category: FeedbackCategory;
  message: string;
}): Promise<ApiFeedbackRow> {
  // Use /employee-notes (not /feedback) — some browsers/extensions block URLs containing "feedback".
  return request<ApiFeedbackRow>('/employee-notes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function apiListFeedback(limit = 80): Promise<ApiFeedbackRow[]> {
  return request<ApiFeedbackRow[]>(`/employee-notes?limit=${limit}`);
}
