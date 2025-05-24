const products = document.querySelectorAll('.product');
const prevBtn = document.querySelector('.nav.prev');
const nextBtn = document.querySelector('.nav.next');
let current = 0;

function showSlide(index) {
  products.forEach(p => p.classList.remove('active'));
  products[index].classList.add('active');
}

prevBtn.addEventListener('click', () => {
  current = (current - 1 + products.length) % products.length;
  showSlide(current);
});

nextBtn.addEventListener('click', () => {
  current = (current + 1) % products.length;
  showSlide(current);
});

window.addEventListener('scroll', () => {
  const carousel = document.querySelector('.carousel');
  const position = carousel.getBoundingClientRect().top;
  const screenHeight = window.innerHeight;

  if (position < screenHeight - 100) {
    carousel.classList.add('show');
  } else {
    carousel.classList.remove('show');
  }
});
