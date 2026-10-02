import { getCurrentUser } from '../core/authStorage.js';

const user = getCurrentUser();
const my = document.querySelector('.my-pill');
if (my) {
  my.textContent = user ? 'MY' : '로그인';
  if (my.tagName === 'A') my.href = user ? 'mypage.html' : 'login.html';
}

const loginLink = document.querySelector('.header-link[href="login.html"]');
if (loginLink && user) {
  loginLink.textContent = '저장한 틈';
  loginLink.href = 'saved.html';
}
