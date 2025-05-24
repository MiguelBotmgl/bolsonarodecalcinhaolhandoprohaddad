const moneyRain = document.createElement('div');
moneyRain.classList.add('money-rain');
document.body.appendChild(moneyRain);

const emojis = ['💸', '💰', '🤑', '💵', '🚗', '🚀'];
const count = 30;

for (let i = 0; i < count; i++) {
  const span = document.createElement('span');
  span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
  span.style.left = `${Math.random() * 100}vw`;
  span.style.animationDuration = `${Math.random() * 3 + 2}s`; // 2-5 seconds
  span.style.animationDelay = `${Math.random() * 2}s`;
  moneyRain.appendChild(span);
}