// ── auth.js — Supabase auth scaffold ─────────────────────
const SUPABASE_URL   = '[your-project.supabase.co](https://your-project.supabase.co)';
const SUPABASE_ANON  = 'your-anon-key';

let _client = null;
let _user   = null;

export function initAuth() {
  if (typeof supabase === 'undefined') {
    console.warn('Supabase SDK not loaded');
    return;
  }
  _client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  _client.auth.onAuthStateChange((_event, session) => {
    _user = session?.user ?? null;
    updateAuthUI();
  });

  _client.auth.getSession().then(({ data }) => {
    _user = data.session?.user ?? null;
    updateAuthUI();
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
