const slides = [...document.querySelectorAll('.slide')];
const counter = document.querySelector('#counter');
let activeIndex = 0;

function setSlide(index) {
  activeIndex = Math.max(0, Math.min(slides.length - 1, index));
  slides[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
  counter.textContent = `${activeIndex + 1} / ${slides.length}`;
}

document.querySelector('#previous').addEventListener('click', () => setSlide(activeIndex - 1));
document.querySelector('#next').addEventListener('click', () => setSlide(activeIndex + 1));
document.querySelector('#print').addEventListener('click', () => window.print());
document.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' || event.key === 'PageDown') setSlide(activeIndex + 1);
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') setSlide(activeIndex - 1);
});
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      activeIndex = slides.indexOf(entry.target);
      counter.textContent = `${activeIndex + 1} / ${slides.length}`;
    }
  }
}, { threshold: 0.55 });
slides.forEach(slide => observer.observe(slide));

const liveState = document.querySelector('#live-state');
fetch('/api/status', { cache: 'no-store', signal: AbortSignal.timeout(6000) })
  .then(async response => {
    const status = await response.json();
    liveState.textContent = response.ok && status.ready ? `LIVE · Compact ${status.compiler} ready` : 'LIVE STATUS · COMPILER NOT READY';
  })
  .catch(() => { liveState.textContent = 'LIVE STATUS · CHECK THE DEMO LINK'; });
