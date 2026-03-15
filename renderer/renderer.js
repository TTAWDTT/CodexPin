(() => {
  // Minimal bootstrap script to verify wiring between HTML, CSS and JS.
  const sessionTimeEl = document.getElementById('session-time');
  const weeklyRemainingEl = document.getElementById('weekly-remaining');

  if (sessionTimeEl && weeklyRemainingEl) {
    sessionTimeEl.textContent = '0';
    weeklyRemainingEl.textContent = '5h00m';
  }
})();

