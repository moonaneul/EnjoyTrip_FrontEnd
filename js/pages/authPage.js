import {
  AuthStorageError,
  createUser,
  login,
  logout,
  getCurrentUser,
  updateCurrentUser,
  deleteCurrentUser,
  resetPasswordDemo,
} from '../core/authStorage.js';
import { getUserPreference, hasCompletedPreference, deleteUserPreference } from '../features/preferences/preferenceStorage.js';
import { preferenceSummary } from '../features/preferences/preferenceScoring.js';
import { deleteTripsByOwner } from '../core/tripStorage.js';
import { isValidEmail, validatePassword, validateSignup } from '../features/auth/validation.js';

const page = document.body.dataset.authPage;

function toast(message) {
  const element = document.querySelector('#auth-toast');
  if (!element) return;
  element.querySelector('.toast-body').textContent = message;
  if (globalThis.bootstrap?.Toast) bootstrap.Toast.getOrCreateInstance(element, { delay: 1800 }).show();
}

function closeModal(selector) {
  const element = document.querySelector(selector);
  if (element && globalThis.bootstrap?.Modal) bootstrap.Modal.getOrCreateInstance(element).hide();
}

function storageMessage(error) {
  if (error instanceof AuthStorageError) return error.message;
  console.error(error);
  return '처리 중 오류가 발생했습니다.';
}

function clearFieldErrors(form) {
  form.querySelectorAll('[aria-invalid="true"]').forEach((input) => input.removeAttribute('aria-invalid'));
  form.querySelectorAll('.field-error').forEach((element) => { element.textContent = ''; });
}

function showFieldErrors(form, errors) {
  Object.entries(errors).forEach(([name, message]) => {
    const input = form.querySelector(`[name="${name}"]`);
    const error = form.querySelector(`[data-error-for="${name}"]`);
    if (input) input.setAttribute('aria-invalid', 'true');
    if (error) error.textContent = message;
  });
}

function initSignup() {
  const form = document.querySelector('#signup-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);

    const values = {
      nickname: form.nickname.value,
      email: form.email.value,
      password: form.password.value,
      confirmPassword: form.confirmPassword.value,
    };
    const errors = validateSignup(values);
    if (Object.keys(errors).length) {
      showFieldErrors(form, errors);
      return;
    }

    try {
      await createUser(values);
      await login({ email:values.email, password:values.password });
      toast('회원가입이 완료됐어요. 여행 취향을 설정할게요.');
      setTimeout(() => { location.href = 'onboarding.html?first=1'; }, 450);
    } catch (error) {
      if (error instanceof AuthStorageError && error.code === 'DUPLICATE_EMAIL') {
        showFieldErrors(form, { email: error.message });
        return;
      }
      toast(storageMessage(error));
    }
  });
}

function initLogin() {
  const form = document.querySelector('#login-form');
  const message = document.querySelector('#login-message');
  const params = new URLSearchParams(location.search);
  if (params.get('joined') === '1') toast('가입한 이메일로 로그인해주세요.');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    const email = document.querySelector('#login-email').value;
    const password = document.querySelector('#login-password').value;

    if (!isValidEmail(email)) { message.textContent = '올바른 이메일을 입력해주세요.'; return; }
    if (!password) { message.textContent = '비밀번호를 입력해주세요.'; return; }

    try {
      const user = await login({ email, password });
      toast('로그인했어요.');
      const next = new URLSearchParams(location.search).get('next');
      const destination = !hasCompletedPreference(user.id)
        ? 'onboarding.html?first=1'
        : (next === 'mypage' ? 'mypage.html' : 'index.html');
      setTimeout(() => { location.href = destination; }, 350);
    } catch (error) {
      message.textContent = storageMessage(error);
    }
  });

  const resetForm = document.querySelector('#reset-form');
  const resetMessage = document.querySelector('#reset-message');
  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    resetMessage.textContent = '';
    const email = document.querySelector('#reset-email').value;
    const newPassword = document.querySelector('#reset-password').value;
    const confirm = document.querySelector('#reset-confirm').value;
    if (!isValidEmail(email)) { resetMessage.textContent = '올바른 이메일을 입력해주세요.'; return; }
    const passwordError = validatePassword(newPassword);
    if (passwordError) { resetMessage.textContent = passwordError; return; }
    if (newPassword !== confirm) { resetMessage.textContent = '새 비밀번호가 일치하지 않습니다.'; return; }

    try {
      await resetPasswordDemo({ email, newPassword });
      closeModal('#resetModal');
      resetForm.reset();
      toast('Demo 비밀번호를 변경했어요.');
    } catch (error) {
      resetMessage.textContent = storageMessage(error);
    }
  });
}

function renderProfile(user) {
  document.querySelector('#profile-name').textContent = user.nickname || '틈 여행자';
  document.querySelector('#profile-email').textContent = user.email;
  document.querySelector('#profile-avatar').textContent = (user.nickname || user.email || 'T').trim().charAt(0).toUpperCase();
  document.querySelector('#profile-nickname').value = user.nickname || '';
  document.querySelector('#profile-email-input').value = user.email;
}

function renderPreferenceSummary(user) {
  const root = document.querySelector('#preference-summary');
  if (!root || !user) return;
  const preference = getUserPreference(user.id);
  if (!preference?.completed) {
    root.innerHTML = '<p>아직 여행 취향을 설정하지 않았어요.</p><a class="preference-edit-link" href="onboarding.html">취향 설정하기 →</a>';
    return;
  }
  const categories = preference.preferenceMode === 'neutral' ? ['기본 취향'] : preferenceSummary(preference);
  const pace = preference.pace < .35 ? '느긋하게' : preference.pace > .7 ? '꽉 채우기' : '균형 있게';
  root.innerHTML = `<p class="preference-tags">${categories.map((item)=>`<span>${item}</span>`).join('')}</p><p>${pace} · ${preference.travelTolerance === 'low' ? '가까운 곳 위주' : preference.travelTolerance === 'high' ? '좋은 곳이면 이동 OK' : '적당한 이동'}</p><a class="preference-edit-link" href="onboarding.html?edit=1">여행 취향 수정하기 →</a>`;
}

function syncMypageAuthState() {
  const content = document.querySelector('#mypage-content');
  const required = document.querySelector('#auth-required');
  const logoutButton = document.querySelector('#header-logout');
  const currentUser = getCurrentUser();
  const authenticated = Boolean(currentUser);

  required.hidden = authenticated;
  content.hidden = !authenticated;
  if (logoutButton) logoutButton.hidden = !authenticated;

  if (currentUser) { renderProfile(currentUser); renderPreferenceSummary(currentUser); }
  return currentUser;
}

function initMypage() {
  let user = syncMypageAuthState();

  document.querySelector('#header-logout').addEventListener('click', () => {
    logout();
    syncMypageAuthState();
    location.replace('login.html');
  });

  // 뒤로/앞으로 이동 시 브라우저 BFCache가 이전 DOM을 복원할 수 있으므로
  // pageshow마다 현재 세션을 다시 확인해 회원정보 노출 여부를 동기화한다.
  window.addEventListener('pageshow', () => {
    user = syncMypageAuthState();
  });

  const profileForm = document.querySelector('#profile-form');
  const profileMessage = document.querySelector('#profile-message');
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    profileMessage.textContent = '';
    user = getCurrentUser();
    if (!user) { syncMypageAuthState(); profileMessage.textContent = '로그인이 필요합니다.'; return; }
    const nickname = document.querySelector('#profile-nickname').value.trim();
    const email = document.querySelector('#profile-email-input').value.trim();
    if (!nickname) { profileMessage.textContent = '닉네임을 입력해주세요.'; return; }
    if (!isValidEmail(email)) { profileMessage.textContent = '올바른 이메일을 입력해주세요.'; return; }
    try {
      user = await updateCurrentUser({ nickname, email });
      renderProfile(user);
      toast('회원정보를 수정했어요.');
    } catch (error) {
      profileMessage.textContent = storageMessage(error);
    }
  });

  const passwordForm = document.querySelector('#mypage-password-form');
  const passwordMessage = document.querySelector('#mypage-password-message');
  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    passwordMessage.textContent = '';
    user = getCurrentUser();
    if (!user) { syncMypageAuthState(); passwordMessage.textContent = '로그인이 필요합니다.'; return; }
    const newPassword = document.querySelector('#mypage-password').value;
    const confirm = document.querySelector('#mypage-password-confirm').value;
    const passwordError = validatePassword(newPassword);
    if (passwordError) { passwordMessage.textContent = passwordError; return; }
    if (newPassword !== confirm) { passwordMessage.textContent = '새 비밀번호가 일치하지 않습니다.'; return; }
    try {
      await resetPasswordDemo({ email: user.email, newPassword });
      passwordForm.reset();
      closeModal('#passwordModal');
      toast('비밀번호를 변경했어요.');
    } catch (error) {
      passwordMessage.textContent = storageMessage(error);
    }
  });

  document.querySelector('#confirm-delete').addEventListener('click', () => {
    user = getCurrentUser();
    if (!user) { syncMypageAuthState(); toast('로그인이 필요합니다.'); return; }
    try {
      const deletingUser = getCurrentUser();
      if (deletingUser) {
        deleteUserPreference(deletingUser.id);
        deleteTripsByOwner(deletingUser.id);
      }
      deleteCurrentUser();
      closeModal('#deleteModal');
      location.href = 'signup.html';
    } catch (error) {
      toast(storageMessage(error));
    }
  });
}

if (page === 'signup') initSignup();
if (page === 'login') initLogin();
if (page === 'mypage') initMypage();
