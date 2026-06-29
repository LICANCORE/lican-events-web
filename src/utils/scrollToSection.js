const desktopOffsets = {
  eventos: 110,
  servicios: 28,
  artistas: 28,
  galeria: 8,
  contacto: 28,
};

const mobileOffsets = {
  eventos: 72,
  servicios: 12,
  artistas: 12,
  galeria: 4,
  contacto: 12,
};

export default function scrollToSection(hash, behavior = 'smooth') {
  const id = decodeURIComponent(hash.replace(/^#/, ''));
  const target = document.getElementById(id);
  if (!target) return false;

  const headerHeight = document.querySelector('.topbar')?.offsetHeight || 96;
  const offsets = window.matchMedia('(max-width: 768px)').matches ? mobileOffsets : desktopOffsets;
  const extraOffset = offsets[id] || 0;
  const top = target.getBoundingClientRect().top + window.scrollY - headerHeight + extraOffset;

  window.scrollTo({ top: Math.max(0, top), left: 0, behavior });
  return true;
}
