import { InventoryItem, InventoryTransaction, Category, StorageLocation, ActionType, TransactionReason } from '@/types/inventory';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
  || (import.meta.env.DEV ? 'http://localhost:8000' : '');

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
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(formatApiErrorDetail(err.detail));
  }

  return res.json() as Promise<T>;
}

// ── Response shapes from backend (snake_case) ─────────────────────────────────

interface ApiItem {
  id: string;
  name: string;
  category: string;
  sub_category: string | null;
  unit: string;
  current_quantity: number;
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
    reason: r.reason as TransactionReason,
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
