
// TEUM v2 — UI-only prototype interactions

document.querySelectorAll('[data-segment]').forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.segment;
    document.querySelectorAll(`[data-segment="${key}"]`).forEach((b) => b.classList.remove('active'));
    button.classList.add('active');
  });
});

document.querySelectorAll('[data-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    const active = button.classList.toggle('active');
    button.setAttribute('aria-pressed', String(active));
  });
});

document.querySelectorAll('[data-mood]').forEach((button) => {
  button.addEventListener('click', () => button.classList.toggle('active'));
});

document.querySelectorAll('[data-carousel]').forEach((carousel) => {
  const indicator = carousel.parentElement.querySelector('[data-indicator]');
  if (!indicator) return;

  const cards = [...carousel.querySelectorAll('.postcard')];
  const dots = [...indicator.querySelectorAll('.dot')];

  const update = () => {
    if (window.innerWidth > 767 || cards.length === 0) return;

    const containerLeft = carousel.getBoundingClientRect().left;
    let closest = 0;
    let distance = Infinity;

    cards.forEach((card, index) => {
      const d = Math.abs(card.getBoundingClientRect().left - containerLeft - 20);
      if (d < distance) {
        distance = d;
        closest = index;
      }
    });

    dots.forEach((dot, index) => dot.classList.toggle('active', index === closest));
  };

  carousel.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
});

document.querySelectorAll('.category').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.category').forEach((b) => b.removeAttribute('aria-current'));
    button.setAttribute('aria-current', 'true');
  });
});
