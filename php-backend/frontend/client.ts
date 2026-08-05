/**
 * Drop-in replacement for `src/integrations/supabase/client.ts` when the app is
 * switched from the cloud backend to the PHP/MariaDB backend deployed in the
 * SAME folder as the frontend (public_html + public_html/api).
 *
 * DO NOT copy this over the live client until the data has been migrated.
 * To switch: copy this file to `src/integrations/supabase/client.ts`
 * (it exports the same `supabase` symbol and the same call shapes the app uses).
 *
 * Base URL is same-origin `/api`, so there is no CORS and no api. subdomain.
 */

const API_BASE = (import.meta as any).env?.VITE_WMS_API_BASE || "/api";
const STORE_KEY = "khcww.session";

type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string; phone?: string; [k: string]: any };
};

let session: Session | null = null;
try {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) session = JSON.parse(raw);
} catch {
  session = null;
}

const listeners = new Set<(event: string, session: Session | null) => void>();

function setSession(next: Session | null) {
  session = next;
  if (next) localStorage.setItem(STORE_KEY, JSON.stringify(next));
  else localStorage.removeItem(STORE_KEY);
  listeners.forEach((cb) => cb(next ? "SIGNED_IN" : "SIGNED_OUT", next));
}

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...((init.headers as Record<string, string>) || {}),
  };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  let res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  // one silent refresh attempt on expiry
  if (res.status === 401 && session?.refresh_token) {
    const refreshed = await fetch(`${API_BASE}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (refreshed.ok) {
      setSession(await refreshed.json());
      headers.Authorization = `Bearer ${session!.access_token}`;
      res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    } else {
      setSession(null);
    }
  }

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = json?.error || { message: res.statusText, code: String(res.status) };
    throw Object.assign(new Error(err.message), { code: err.code, status: res.status });
  }
  return json;
}

/* ------------------------------------------------------------------ */
/* PostgREST-style query builder                                       */
/* ------------------------------------------------------------------ */

class QueryBuilder implements PromiseLike<{ data: any; error: any; count?: number }> {
  private params: string[] = [];
  private method: "GET" | "POST" | "PATCH" | "DELETE" = "GET";
  private payload: any = undefined;
  private singleRow: false | "one" | "maybe" = false;
  private wantCount = false;

  constructor(private table: string) {}

  private add(column: string, op: string, value: any) {
    const v = Array.isArray(value) ? `(${value.join(",")})` : value === null ? "null" : value;
    this.params.push(`${encodeURIComponent(column)}=${op}.${encodeURIComponent(String(v))}`);
    return this;
  }

  select(columns = "*", opts?: { count?: "exact"; head?: boolean }) {
    this.params.push(`select=${encodeURIComponent(columns)}`);
    if (opts?.count === "exact") {
      this.wantCount = true;
      this.params.push("count=exact");
    }
    if (this.method === "GET") this.method = "GET";
    return this;
  }
  insert(values: any) {
    this.method = "POST";
    this.payload = values;
    return this;
  }
  upsert(values: any) {
    this.method = "POST";
    this.payload = values;
    this.params.push("upsert=true");
    return this;
  }
  update(values: any) {
    this.method = "PATCH";
    this.payload = values;
    return this;
  }
  delete() {
    this.method = "DELETE";
    return this;
  }

  eq(c: string, v: any) { return this.add(c, "eq", v); }
  neq(c: string, v: any) { return this.add(c, "neq", v); }
  gt(c: string, v: any) { return this.add(c, "gt", v); }
  gte(c: string, v: any) { return this.add(c, "gte", v); }
  lt(c: string, v: any) { return this.add(c, "lt", v); }
  lte(c: string, v: any) { return this.add(c, "lte", v); }
  like(c: string, v: any) { return this.add(c, "like", v); }
  ilike(c: string, v: any) { return this.add(c, "ilike", v); }
  in(c: string, v: any[]) { return this.add(c, "in", v); }
  is(c: string, v: any) { return this.add(c, "is", v); }
  contains(c: string, v: any) { return this.add(c, "like", `%${v}%`); }
  or(filter: string) {
    this.params.push(`or=${encodeURIComponent(`(${filter})`)}`);
    return this;
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.params.push(`order=${encodeURIComponent(column)}.${opts?.ascending === false ? "desc" : "asc"}`);
    return this;
  }
  limit(n: number) {
    this.params.push(`limit=${n}`);
    return this;
  }
  range(from: number, to: number) {
    this.params.push(`offset=${from}`, `limit=${to - from + 1}`);
    return this;
  }
  single() { this.singleRow = "one"; return this; }
  maybeSingle() { this.singleRow = "maybe"; return this; }

  private async run() {
    const qs = this.params.length ? `?${this.params.join("&")}` : "";
    const body = this.payload !== undefined ? JSON.stringify(this.payload) : undefined;
    const result = await request(`/rest/v1/${this.table}${qs}`, { method: this.method, body });

    if (this.wantCount && result && !Array.isArray(result) && typeof result.count === "number") {
      return { data: [], count: result.count };
    }
    const rows = Array.isArray(result) ? result : result === null ? [] : [result];
    if (this.singleRow) {
      if (rows.length === 0) {
        if (this.singleRow === "maybe") return { data: null };
        throw Object.assign(new Error("No rows found"), { code: "PGRST116" });
      }
      return { data: rows[0] };
    }
    return { data: rows, count: rows.length };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.run()
      .then((r: any) => ({ ...r, error: null }))
      .catch((error) => ({ data: null, error, count: 0 }))
      .then(onfulfilled as any, onrejected as any);
  }
}

/* ------------------------------------------------------------------ */
/* Client                                                             */
/* ------------------------------------------------------------------ */

async function wrap<T>(fn: () => Promise<T>) {
  try {
    return { data: (await fn()) as any, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export const supabase = {
  from: (table: string) => new QueryBuilder(table),

  rpc: (fn: string, args: Record<string, any> = {}) =>
    wrap(() => request(`/rest/v1/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) })),

  auth: {
    async signInWithPassword(credentials: { email?: string; phone?: string; password: string }) {
      return wrap(async () => {
        const data = await request(`/auth/v1/token?grant_type=password`, {
          method: "POST",
          body: JSON.stringify(credentials),
        });
        setSession(data);
        return { user: data.user, session: data };
      });
    },
    async signUp(payload: any) {
      return wrap(async () => {
        const data = await request(`/auth/v1/signup`, { method: "POST", body: JSON.stringify(payload) });
        if (data?.access_token) setSession(data);
        return { user: data.user ?? null, session: data?.access_token ? data : null };
      });
    },
    async signOut() {
      try {
        await request(`/auth/v1/logout`, { method: "POST" });
      } catch {
        /* ignore */
      }
      setSession(null);
      return { error: null };
    },
    async getSession() {
      return { data: { session }, error: null };
    },
    async getUser() {
      if (!session) return { data: { user: null }, error: null };
      const res = await wrap(() => request(`/auth/v1/user`));
      return { data: { user: res.data?.user ?? null }, error: res.error };
    },
    async updateUser(attrs: { password?: string }) {
      return wrap(() => request(`/auth/v1/password`, { method: "POST", body: JSON.stringify(attrs) }));
    },
    onAuthStateChange(cb: (event: string, session: Session | null) => void) {
      listeners.add(cb);
      setTimeout(() => cb(session ? "SIGNED_IN" : "SIGNED_OUT", session), 0);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    },
  },

  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: File | Blob) {
          const form = new FormData();
          form.append("file", file);
          return wrap(() =>
            request(`/storage/v1/object/${bucket}/${path}`, { method: "POST", body: form })
          );
        },
        async remove(paths: string[]) {
          return wrap(async () => {
            for (const p of paths) await request(`/storage/v1/object/${bucket}/${p}`, { method: "DELETE" });
            return paths;
          });
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `${API_BASE}/storage/v1/object/${bucket}/${path}` } };
        },
        async createSignedUrl(path: string) {
          return {
            data: { signedUrl: `${API_BASE}/storage/v1/object/${bucket}/${path}` },
            error: null,
          };
        },
      };
    },
  },

  functions: {
    invoke: (name: string, opts?: { body?: any }) =>
      wrap(() =>
        request(`/functions/v1/${name}`, {
          method: "POST",
          body: JSON.stringify(opts?.body ?? {}),
        })
      ),
  },

  /**
   * Realtime is polling-based on shared hosting: `channel().on().subscribe()`
   * keeps the same call shape, and re-fires the callback on an interval so the
   * existing chat/presence code keeps working without websockets.
   */
  channel(_name: string) {
    const timers: number[] = [];
    const api = {
      on(_type: string, _filter: any, cb: (payload: any) => void) {
        timers.push(window.setInterval(() => cb({ eventType: "POLL", new: null, old: null }), 8000));
        return api;
      },
      subscribe(cb?: (status: string) => void) {
        cb?.("SUBSCRIBED");
        return api;
      },
      unsubscribe() {
        timers.forEach(clearInterval);
        return Promise.resolve("ok");
      },
      send: async () => "ok",
      track: async () => "ok",
    };
    return api;
  },
  removeChannel(channel: any) {
    channel?.unsubscribe?.();
  },
};

export default supabase;
