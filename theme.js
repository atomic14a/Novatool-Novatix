document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  
  // Apply saved theme on load
  const savedTheme = localStorage.getItem('pdf-toolkit-theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    if (themeToggle) themeToggle.innerHTML = '<i class="ti ti-sun"></i>';
  } else {
    document.body.classList.remove('light-mode');
    if (themeToggle) themeToggle.innerHTML = '<i class="ti ti-moon"></i>';
  }

  // Theme switch listener
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      if (document.body.classList.contains('light-mode')) {
        document.body.classList.remove('light-mode');
        themeToggle.innerHTML = '<i class="ti ti-moon"></i>';
        localStorage.setItem('pdf-toolkit-theme', 'dark');
        showToast('Theme switched to Dark Mode', 'success');
      } else {
        document.body.classList.add('light-mode');
        themeToggle.innerHTML = '<i class="ti ti-sun"></i>';
        localStorage.setItem('pdf-toolkit-theme', 'light');
        showToast('Theme switched to Light Mode', 'success');
      }
    });
  }

  // Mobile Hamburger menu toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNavMenu = document.getElementById('mobile-nav-menu');
  if (mobileMenuBtn && mobileNavMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      const isVisible = mobileNavMenu.style.display === 'flex';
      mobileNavMenu.style.display = isVisible ? 'none' : 'flex';
    });
  }
});

// Toast notification helper accessible globally
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ti-info-circle';
  if (type === 'success') icon = 'ti-circle-check';
  if (type === 'danger') icon = 'ti-alert-circle';
  if (type === 'warning') icon = 'ti-alert-triangle';
  
  toast.innerHTML = `
    <i class="ti ${icon} toast-icon"></i>
    <span class="toast-msg">${message}</span>
    <span class="toast-close"><i class="ti ti-x"></i></span>
  `;
  
  container.appendChild(toast);
  
  toast.querySelector('.toast-close').addEventListener('click', () => {
    dismissToast(toast);
  });
  
  setTimeout(() => {
    dismissToast(toast);
  }, 4000);
}

function dismissToast(toast) {
  if (toast.parentNode) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    setTimeout(() => toast.remove(), 300);
  }
}
