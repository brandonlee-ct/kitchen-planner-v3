// ── auth.js — Supabase auth scaffold ─────────────────────
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = '[dswnkbokytqqjxpziyql.supabase.co](https://dswnkbokytqqjxpziyql.supabase.co)';
const SUPABASE_ANON_KEY = 'sb_publishable_d2K57XUYcz1-rnPewZnvQQ_xBp71fqE';

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

  if (!btnAuth) return;

  if (_user) {
    const name = _user.user_metadata?.full_name || _user.email || 'Signed in';
    btnAuth.title       = name;
    btnAuth.style.color = '#ff9500';
    if (authStatus) authStatus.textContent  = '✅ Signed in as ' + name;
    if (btnSignin)  btnSignin.style.display  = 'none';
    if (btnSignout) btnSignout.style.display = 'block';
  } else {
    btnAuth.title       = 'Sign in';
    btnAuth.style.color = '';
    if (authStatus) authStatus.textContent  = 'Sign in to save your projects';
    if (btnSignin)  btnSignin.style.display  = 'block';
    if (btnSignout) btnSignout.style.display = 'none';
  }
}
