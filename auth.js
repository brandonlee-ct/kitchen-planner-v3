// ── auth.js — Supabase auth scaffold ─────────────────────
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dswnkbokytqqjxpziyql.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzd25rYm9reXRxcWp4cHppeXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NjM3MDUsImV4cCI6MjA5NjIzOTcwNX0.qPJrarJJT0b6Axh-Btd9dlKQZ8K-961MvHuEaFml40c';

let _client = null;
let _user   = null;
let _role   = null;

export function initAuth() {
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  _client.auth.onAuthStateChange((_event, session) => {
    _user = session?.user ?? null;
    updateAuthUI();
    loadUserRole();
  });

  _client.auth.getSession().then(({ data }) => {
    _user = data.session?.user ?? null;
    updateAuthUI();
    loadUserRole();
  });
}

export async function signInWithGoogle() {
  if (!_client) return;
  const { error } = await _client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) console.error('Sign in error:', error.message);
}

export async function signOut() {
  if (!_client) return;
  const { error } = await _client.auth.signOut();
  if (error) console.error('Sign out error:', error.message);
}

export function getUser() {
  return _user;
}

/**
 * Current user's shared profiles.role (e.g. 'hq_admin'), or null when signed
 * out or not yet loaded. READ-ONLY — the planner never writes roles, and
 * tolerates role values it doesn't recognise. For role-aware UI gating only
 * (e.g. Auto-Design rollout); data security is enforced by RLS, never by this
 * client-side value.
 * @returns {string|null}
 */
export function getUserRole() {
  return _role;
}

/**
 * Fetch the signed-in user's role from the shared profiles table once, then
 * re-run role-aware UI hooks. Never throws; unknown/missing role -> null.
 */
async function loadUserRole() {
  if (!_client || !_user) {
    _role = null;
    window.refreshAutoDesignFlag?.();
    return;
  }
  try {
    const { data, error } = await _client
      .from('profiles')
      .select('role')
      .eq('id', _user.id)
      .single();
    _role = error ? null : (data?.role ?? null);
  } catch (e) {
    _role = null;
  }
  window.refreshAutoDesignFlag?.();
}

function updateAuthUI() {
  const btnAuth     = document.getElementById('btn-auth');
  const authStatus  = document.getElementById('auth-status');
  const btnSignin   = document.getElementById('btn-google-signin');
  const btnSignout  = document.getElementById('btn-auth-signout');
  const btnSave     = document.getElementById('btn-save-project');
  const btnProjects = document.getElementById('btn-my-projects');

  if (!btnAuth) return;

  if (_user) {
    const name = _user.user_metadata?.full_name || _user.email || 'Signed in';
    btnAuth.title = name;
    btnAuth.textContent = '👤 ' + name;
    btnAuth.classList.add('signed-in');    
    if (authStatus)  authStatus.textContent  = '✅ Signed in as ' + name;
    if (btnSignin)   btnSignin.style.display  = 'none';
    if (btnSignout)  btnSignout.style.display = 'block';
    if (btnSave)     btnSave.style.display    = 'block';
    if (btnProjects) btnProjects.style.display = 'block';
  } else {
    btnAuth.title = 'Sign in';
    btnAuth.textContent = '👤 Sign In';
    btnAuth.classList.remove('signed-in');
    if (authStatus)  authStatus.textContent  = 'Sign in to save your projects';
    if (btnSignin)   btnSignin.style.display  = 'block';
    if (btnSignout)  btnSignout.style.display = 'none';
    if (btnSave)     btnSave.style.display    = 'none';
    if (btnProjects) btnProjects.style.display = 'none';
  }
}

// ── Thumbnail storage ─────────────────────────────────────

/**
 * Upload a thumbnail data URL to the public `thumbnails` bucket.
 * Stored at `${user.id}/${uuid}.png`; bucket RLS scopes writes to owner.
 * @param {string} dataUrl — base64 PNG data URL from canvas.toDataURL()
 * @returns {Promise<string|null>} public URL, or null on any failure (caller falls back)
 */
export async function uploadThumbnail(dataUrl) {
  if (!_user || !_client) return null;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${_user.id}/${crypto.randomUUID()}.png`;
    const { error } = await _client.storage
      .from('thumbnails')
      .upload(path, blob, { upsert: true, contentType: 'image/png' });
    if (error) {
      console.warn('[auth] thumbnail upload failed:', error.message);
      return null;
    }
    return _client.storage.from('thumbnails').getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.warn('[auth] thumbnail upload error:', e?.message || e);
    return null;
  }
}

// ── Project helpers ───────────────────────────────────────

/**
 * Generate a short, human-friendly, collision-resistant project code.
 * Shared join key between the planner and the Trade app (jobs.project_code).
 * e.g. 'BBK-3F9A2C'. Stable for a project's life; persisted on the row.
 * @returns {string}
 */
export function newProjectCode() {
  const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return 'BBK-' + hex;
}

/** Six-digit PO for Trade job display (cart attribute → order note_attributes.display_po). */
export function newDisplayPo() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Insert a new project row, stamping a fresh project_code.
 * @param {string} name
 * @param {object} sceneJson   — plain JS object (will be stored as jsonb)
 * @param {string} thumbnail   — base64 data URL or null
 * @returns {{ id: string|null, project_code: string|null, error: string|null }}
 */
export async function saveProject(name, sceneJson, thumbnail) {
  if (!_user) return { id: null, project_code: null, error: 'Not signed in' };
  const projectCode = newProjectCode();
  const { data, error } = await _client
    .from('projects')
    .insert({
      user_id:      _user.id,
      name,
      scene_json:   sceneJson,
      thumbnail:    thumbnail ?? null,
      project_code: projectCode,
    })
    .select('id, project_code')
    .single();
  if (error) return { id: null, project_code: null, error: error.message };
  return { id: data.id, project_code: data.project_code, error: null };
}

/**
 * Ensure a project row has a project_code, backfilling legacy rows.
 * No-op (returns the existing code) if one is already set.
 * @param {string} id
 * @returns {{ project_code: string|null, error: string|null }}
 */
export async function ensureProjectCode(id) {
  if (!_user) return { project_code: null, error: 'Not signed in' };
  const { data, error } = await _client
    .from('projects')
    .select('project_code')
    .eq('id', id)
    .eq('user_id', _user.id)
    .single();
  if (error) return { project_code: null, error: error.message };
  if (data.project_code) return { project_code: data.project_code, error: null };

  const projectCode = newProjectCode();
  const { error: upErr } = await _client
    .from('projects')
    .update({ project_code: projectCode })
    .eq('id', id)
    .eq('user_id', _user.id);
  if (upErr) return { project_code: null, error: upErr.message };
  return { project_code: projectCode, error: null };
}

/**
 * Update an existing project row by id.
 * @param {string} id
 * @param {string} name
 * @param {object} sceneJson
 * @param {string} thumbnail
 * @returns {{ error: string|null }}
 */
export async function updateProject(id, name, sceneJson, thumbnail) {
  if (!_user) return { error: 'Not signed in' };
  const { error } = await _client
    .from('projects')
    .update({
      name,
      scene_json: sceneJson,
      thumbnail:  thumbnail ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', _user.id);   // RLS belt-and-braces
  return { error: error ? error.message : null };
}

/**
 * List all projects for the signed-in user, newest first.
 * @returns {{ data: Array|null, error: string|null }}
 */
export async function listProjects() {
  if (!_user) return { data: null, error: 'Not signed in' };
  const { data, error } = await _client
    .from('projects')
    .select('id, name, thumbnail, updated_at, is_public, share_slug, project_code')
    .eq('user_id', _user.id)
    .order('updated_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

/**
 * Load a single project row (including scene_json).
 * @param {string} id
 * @returns {{ data: object|null, error: string|null }}
 */
export async function loadProject(id) {
  if (!_user) return { data: null, error: 'Not signed in' };
  const { data, error } = await _client
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', _user.id)
    .single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

/**
 * Delete a project row by id.
 * @param {string} id
 * @returns {{ error: string|null }}
 */
export async function deleteProject(id) {
  if (!_user) return { error: 'Not signed in' };
  const { error } = await _client
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', _user.id);
  return { error: error ? error.message : null };
}

/**
 * Mark a project public and assign a share slug.
 * @param {string} id
 * @param {string} slug — unique short string for the share URL
 * @returns {{ error: string|null }}
 */
export async function setProjectPublic(id, slug) {
  if (!_user) return { error: 'Not signed in' };
  const { error } = await _client
    .from('projects')
    .update({ is_public: true, share_slug: slug })
    .eq('id', id)
    .eq('user_id', _user.id);
  return { error: error ? error.message : null };
}

/**
 * Load a public project by share slug — no auth required.
 * @param {string} slug
 * @returns {{ data: object|null, error: string|null }}
 */
export async function loadPublicProject(slug) {
  const { data, error } = await _client
    .from('projects')
    .select('id, name, scene_json')
    .eq('share_slug', slug)
    .eq('is_public', true)
    .single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}
