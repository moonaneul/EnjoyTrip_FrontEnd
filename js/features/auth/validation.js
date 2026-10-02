export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function validatePassword(password) {
  const value = String(password || '');
  if (!value) return '비밀번호를 입력해주세요.';
  if (value.length < 8) return '비밀번호는 8자 이상 입력해주세요.';
  return '';
}

export function validateSignup({ email, nickname, password, confirmPassword }) {
  const errors = {};
  if (!String(nickname || '').trim()) errors.nickname = '닉네임을 입력해주세요.';
  if (!isValidEmail(email)) errors.email = '올바른 이메일 형식을 입력해주세요.';
  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;
  if (password !== confirmPassword) errors.confirmPassword = '비밀번호가 일치하지 않습니다.';
  return errors;
}
