// ── auth.js — Supabase auth scaffold ─────────────────────
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dswnkbokytqqjxpziyql.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzd25rYm9reXRxcWp4cHppeXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NjM3MDUsImV4cCI6MjA5NjIzOTcwNX0.qPJrarJJT0b6Axh-Btd9dlKQZ8K-961MvHuEaFml40c';

let _client = null;
let _user   = null;

export function initAuth() {
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('[auth] Supabase client initialised, listening for session…');

  _client.auth.onAuthStateChange((_event, session) => {
    _user = session?.user ?? null;
    console.log('[auth] state change:', _event, _user?.email || 'no user');
    updateAuthUI();
  });

  _client.auth.getSession().then(({ data }) => {
    _user = data.session?.user ?? null;
    updateAuthUI();
  });
}

export async function signInWithGoogle() {
  if (!_client) return;
  console.log('[auth] starting Google OAuth, redirect:', window.location.origin);
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

function updateAuthUI() {
  const btnAuth     = document.getElementById('btn-auth');
  const authStatus  = document.getElementById('auth-status');
  const btnSignin   = document.getElementById('btn-google-signin');
  const btnSignout  = document.getElementById('btn-auth-signout');
  const btnSave     = document.getElementById('btn-save-project');
  const btnProjects = document.getElementById('btn-my-projects');

  if (!btnAuth) return;
  console.log('[auth ui]', { user: !!_user, classes: btnAuth.className });  

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

// ── Project helpers ───────────────────────────────────────

/**
 * Upload a PNG data URL to the `thumbnails` Storage bucket and return
 * the public URL.  Returns null on any error so callers can fall back to
 * the data URL — saving must never break due to a storage hiccup.
 * @param {string} dataUrl  — e.g. "data:image/png;base64,…"
 * @returns {Promise<string|null>}
 */
export async function uploadThumbnail(dataUrl) {
  if (!_client || !_user) return null;
  try {
    // Convert base64 data URL → Uint8Array
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;
    const binary  = atob(base64);
    const bytes   = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const path = `${_user.id}/${crypto.randomUUID()}.png`;
    const { error } = await _client.storage
      .from('thumbnails')
      .upload(path, bytes, { upsert: true, contentType: 'image/png' });
    if (error) {
      console.warn('[auth] thumbnail upload failed:', error.message);
      return null;
    }
    return _client.storage.from('thumbnails').getPublicUrl(path).data.publicUrl;
  } catch (err) {
    console.warn('[auth] thumbnail upload exception:', err);
    return null;
  }
}

/**
 * Insert a new project row.
 * @param {string} name
 * @param {object} sceneJson   — plain JS object (will be stored as jsonb)
 * @param {string} thumbnail   — base64 data URL or public Storage URL or null
 * @returns {{ id: string|null, error: string|null }}
 */
export async function saveProject(name, sceneJson, thumbnail) {
  if (!_user) return { id: null, error: 'Not signed in' };
  const { data, error } = await _client
    .from('projects')
    .insert({
      user_id:    _user.id,
      name,
      scene_json: sceneJson,
      thumbnail:  thumbnail ?? null,
    })
    .select('id')
    .single();
  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

/**
 * Update an existing project row by id.
 * @param {string} id
 * @param {string} name
 * @param {object} sceneJson
 * @param {string} thumbnail  — base64 data URL or public Storage URL or null
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
    .select('id, name, thumbnail, updated_at')
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
