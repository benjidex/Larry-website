const form = document.getElementById('booking-form');
const messageBox = document.getElementById('form-message');

async function submitBooking(payload) {
  const baseUrl = 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    const details = data?.details?.join ? data.details.join(', ') : (data?.error || 'Request failed');
    throw new Error(details);
  }
  return data;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = form.elements.name.value.trim();
  const email = form.elements.email.value.trim();
  const phone = form.elements.phone.value.trim();
  const date = form.elements.date.value;
  const service = form.elements.service.value;
  const message = form.elements.message?.value?.trim?.() || '';

  messageBox.classList.remove('visible');

  if (!name || !email || !phone || !date || !service || !message) {
    messageBox.textContent = 'Please fill in all fields before sending your request.';
    messageBox.classList.add('visible');
    return;
  }

  try {
    messageBox.textContent = 'Sending your request...';
    messageBox.classList.add('visible');

    await submitBooking({ name, email, phone, date, service, message });

    messageBox.textContent = `Thanks, ${name}! Your reservation request for ${service} on ${date} has been sent. We will contact you soon at ${email}.`;
    messageBox.classList.add('visible');
    form.reset();
  } catch (err) {
    messageBox.textContent = `Could not send request: ${err.message || 'Unknown error'}`;
    messageBox.classList.add('visible');
  }
});


const figures = Array.from(document.querySelectorAll('.gallery-figure'));
const filterButtons = Array.from(document.querySelectorAll('.filter-button'));
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxCaption = document.getElementById('lightbox-caption');
const btnClose = document.querySelector('.lightbox-close');
const btnPrev = document.querySelector('.lightbox-prev');
const btnNext = document.querySelector('.lightbox-next');
let currentIndex = 0;
let currentGroup = 'wedding';
let currentGroupFigures = figures;
let touchStartX = 0;

// Set wedding as default - hide all and show only wedding
figures.forEach((fig) => {
  fig.style.display = fig.dataset.group === 'wedding' ? '' : 'none';
});

// Set wedding button as active
filterButtons.forEach((button) => {
  button.classList.toggle('active', button.dataset.filter === 'wedding');
});

function getGroupFigures(group) {
  return group === 'all' ? figures : figures.filter((fig) => fig.dataset.group === group);
}

function setActiveFilter(group) {
  currentGroup = group;
  currentGroupFigures = getGroupFigures(group);
  filterButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === group);
  });
  figures.forEach((fig) => {
    fig.style.display = group === 'all' || fig.dataset.group === group ? '' : 'none';
  });
}

function openLightbox(index, group = 'all') {
  setActiveFilter(group);
  const groupItems = getGroupFigures(group);
  const fig = groupItems[index];
  const img = fig.querySelector('img');
  lightboxImage.src = img.src;
  lightboxImage.alt = img.alt || '';
  lightboxCaption.textContent = `${fig.dataset.group?.charAt(0).toUpperCase() + fig.dataset.group?.slice(1) || 'Featured'} — ${fig.querySelector('figcaption')?.textContent || ''}`;
  lightbox.setAttribute('aria-hidden', 'false');
  currentIndex = index;
}

function closeLightbox() {
  lightbox.setAttribute('aria-hidden', 'true');
  lightboxImage.src = '';
}

function showPrev() {
  const nextIndex = (currentIndex - 1 + currentGroupFigures.length) % currentGroupFigures.length;
  openLightbox(nextIndex, currentGroup);
}

function showNext() {
  const nextIndex = (currentIndex + 1) % currentGroupFigures.length;
  openLightbox(nextIndex, currentGroup);
}

figures.forEach((fig, i) => {
  fig.addEventListener('click', () => {
    const group = fig.dataset.group || 'all';
    const groupItems = getGroupFigures(group);
    const groupIndex = groupItems.indexOf(fig);
    openLightbox(groupIndex, group);
  });
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const group = button.dataset.filter;
    if (!group) return;
    setActiveFilter(group);
  });
});

btnClose.addEventListener('click', closeLightbox);
btnPrev.addEventListener('click', (e) => { e.stopPropagation(); showPrev(); });
btnNext.addEventListener('click', (e) => { e.stopPropagation(); showNext(); });

lightbox.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].clientX;
});

lightbox.addEventListener('touchend', (e) => {
  const touchEndX = e.changedTouches[0].clientX;
  const distance = touchEndX - touchStartX;
  if (Math.abs(distance) > 50) {
    if (distance < 0) {
      showNext();
    } else {
      showPrev();
    }
  }
});

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox || e.target === lightboxImage) closeLightbox();
});

document.addEventListener('keydown', (e) => {
  if (lightbox.getAttribute('aria-hidden') === 'false') {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
  }
});
