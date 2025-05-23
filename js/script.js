document.addEventListener("DOMContentLoaded", () => {
    const menuButton = document.getElementById("mobile-menu-button");
    const mobileMenu = document.getElementById("mobile-menu");

    if (menuButton && mobileMenu) {
        menuButton.addEventListener("click", () => {
            mobileMenu.classList.toggle("hidden");
            // Toggle ARIA attribute for accessibility
            const isExpanded = menuButton.getAttribute("aria-expanded") === "true";
            menuButton.setAttribute("aria-expanded", !isExpanded);
        });
    }
});

// Enhance any <form data-formspree> with AJAX feedback
document.querySelectorAll('form[data-formspree]').forEach(form => {
  const status = form.querySelector('[data-status]');
  if (!status) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    status.textContent = 'Sending…';
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });
      status.textContent = res.ok ? "Thanks! We'll be in touch." : 'Error – try again';
      res.ok && form.reset();
    } catch {
      status.textContent = 'Network error';
    }
  });
});

