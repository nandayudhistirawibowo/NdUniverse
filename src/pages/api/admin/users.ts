import type { APIContext, APIRoute } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient, isAdminNim } from '@core/auth/admin';

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

type AdminAccess =
  | { client: SupabaseClient }
  | { response: Response };

function authorize(context: APIContext): AdminAccess {
  const user = context.locals.user;
  if (!user) return { response: jsonError('Login diperlukan.', 401) };

  const nim = context.locals.profile?.nim;
  if (!isAdminNim(nim)) return { response: jsonError('Akses admin ditolak.', 403) };

  const origin = context.request.headers.get('origin');
  if (context.request.method !== 'GET' && origin !== context.url.origin) {
    return { response: jsonError('Origin tidak diizinkan.', 403) };
  }

  try {
    return { client: createServiceRoleClient() };
  } catch {
    return { response: jsonError('Konfigurasi admin belum tersedia.', 500) };
  }
}

function isResponse(value: AdminAccess): value is { response: Response } {
  return 'response' in value;
}

export const GET: APIRoute = async (context) => {
  const access = authorize(context);
  if (isResponse(access)) return access.response;

  const users: Array<{ id: string; email: string; created_at: string; user_metadata: Record<string, unknown> }> = [];
  const perPage = 1000;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await access.client.auth.admin.listUsers({ page, perPage });
    if (error) return jsonError('Daftar user gagal dimuat.', 500);

    users.push(...data.users);
    if (data.users.length < perPage) break;
  }

  const profilesById = new Map<string, {
    nim: string | null;
    nama_lengkap: string | null;
    nomor_wa: string | null;
  }>();

  if (users.length > 0) {
    const { data: profiles, error } = await access.client
      .from('profiles')
      .select('id, nim, nama_lengkap, nomor_wa')
      .in('id', users.map((user) => user.id));

    if (error) return jsonError('Data profil gagal dimuat.', 500);
    for (const profile of profiles ?? []) profilesById.set(profile.id, profile);
  }

  const result = users.map((user) => {
    const profile = profilesById.get(user.id);
    return {
      id: user.id,
      nim: profile?.nim ?? String(user.user_metadata?.nim ?? ''),
      nama_lengkap: profile?.nama_lengkap ?? String(user.user_metadata?.nama_lengkap ?? ''),
      nomor_wa: profile?.nomor_wa ?? '',
      created_at: user.created_at,
    };
  });

  return new Response(JSON.stringify({ users: result }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
};

export const POST: APIRoute = async (context) => {
  const access = authorize(context);
  if (isResponse(access)) return access.response;

  let body: Record<string, unknown>;
  try {
    body = await context.request.json();
  } catch {
    return jsonError('Payload tidak valid.', 400);
  }

  const nim = typeof body.nim === 'string' ? body.nim.trim() : '';
  const namaLengkap = typeof body.nama_lengkap === 'string' ? body.nama_lengkap.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(nim) || !namaLengkap || namaLengkap.length > 160 || password.length < 8) {
    return jsonError('NIM, nama, atau password tidak memenuhi format yang diperlukan.', 400);
  }
  if (isAdminNim(nim)) return jsonError('NIM admin dikelola di luar form tambah user.', 400);

  const { data: existingProfile, error: existingError } = await access.client
    .from('profiles')
    .select('id')
    .eq('nim', nim)
    .maybeSingle();
  if (existingError) return jsonError('Pemeriksaan NIM gagal.', 500);
  if (existingProfile) return jsonError('NIM tersebut sudah terdaftar.', 409);

  const { data: created, error: createError } = await access.client.auth.admin.createUser({
    email: `${nim}@student.sideutsch.com`,
    password,
    email_confirm: true,
    user_metadata: { nim, nama_lengkap: namaLengkap },
  });
  if (createError || !created.user) return jsonError(createError?.message ?? 'User gagal dibuat.', 400);

  const { error: profileError } = await access.client.from('profiles').upsert({
    id: created.user.id,
    nim,
    nama_lengkap: namaLengkap,
    nomor_wa: null,
    avatar_url: null,
  }, { onConflict: 'id' });

  if (profileError) {
    await access.client.auth.admin.deleteUser(created.user.id);
    return jsonError('Profil user gagal dibuat.', 500);
  }

  return new Response(JSON.stringify({ id: created.user.id }), {
    status: 201,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};

export const PATCH: APIRoute = async (context) => {
  const access = authorize(context);
  if (isResponse(access)) return access.response;

  let body: Record<string, unknown>;
  try {
    body = await context.request.json();
  } catch {
    return jsonError('Payload tidak valid.', 400);
  }

  const id = typeof body.id === 'string' ? body.id : '';
  const namaLengkap = typeof body.nama_lengkap === 'string' ? body.nama_lengkap.trim() : '';
  const nomorWa = typeof body.nomor_wa === 'string' ? body.nomor_wa.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || !namaLengkap || namaLengkap.length > 160 || nomorWa.length > 32) {
    return jsonError('Data edit tidak valid.', 400);
  }

  const { error } = await access.client.from('profiles').update({
    nama_lengkap: namaLengkap,
    nomor_wa: nomorWa || null,
  }).eq('id', id);
  if (error) return jsonError('Profil user gagal diperbarui.', 500);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};

export const DELETE: APIRoute = async (context) => {
  const access = authorize(context);
  if (isResponse(access)) return access.response;

  let body: Record<string, unknown>;
  try {
    body = await context.request.json();
  } catch {
    return jsonError('Payload tidak valid.', 400);
  }

  const id = typeof body.id === 'string' ? body.id : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return jsonError('ID user tidak valid.', 400);
  }
  if (id === context.locals.user?.id) return jsonError('Akun admin yang sedang dipakai tidak bisa dihapus.', 400);

  const targetNim = await access.client.from('profiles').select('nim').eq('id', id).maybeSingle();
  if (targetNim.error) return jsonError('Pemeriksaan user gagal.', 500);
  if (isAdminNim(targetNim.data?.nim)) return jsonError('Akun admin tidak bisa dihapus dari panel.', 400);

  const { error } = await access.client.auth.admin.deleteUser(id);
  if (error) return jsonError('User gagal dihapus.', 500);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
