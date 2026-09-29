try {
  const theme = localStorage.getItem('roundcraft_theme')
  if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme
} catch {
  // Storage can be unavailable (private mode, blocked site data); fall back to the system theme.
}
