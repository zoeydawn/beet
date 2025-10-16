const drawer = document.getElementById('drawer')
const btn = document.getElementById('menu-open-btn')
const drawerContent = document.getElementById('drawer-content')
const sidebar = document.getElementById('sidebar')

// --- Function to fetch drawer content ---
function loadDrawerContent() {
  // Always trigger the HTMX GET request when the drawer opens
  // This ensures fresh chat history is fetched every time.
  if (typeof htmx !== 'undefined') {
    htmx.ajax('GET', '/drawer-content', {
      target: '#drawer-content-wrapper',
      swap: 'innerHTML',
      // We don't use a success handler here as the swap itself is the primary action.
    })
  }
}

// --- Function to toggle the drawer state ---
function toggleDrawer(e) {
  e.stopPropagation()
  drawer.classList.toggle('open')

  if (drawer.classList.contains('open')) {
    // On open, load the content every time for fresh data.
    loadDrawerContent()
  }
}

// --- Event Handlers ---

// Open Button (The primary trigger)
if (btn) {
  btn.addEventListener('click', toggleDrawer)
}

// Sidebar Click
if (sidebar) {
  sidebar.addEventListener('click', (e) => {
    // if (e.target === sidebar) {
    toggleDrawer(e)
    // }
  })
}

// Close drawer if click happens outside
document.addEventListener('click', (e) => {
  if (
    drawer.classList.contains('open') &&
    !drawer.contains(e.target) &&
    e.target !== btn
  ) {
    drawer.classList.remove('open')
  }
})

// Close drawer when an internal link is clicked (to load a chat)
drawer.addEventListener('click', (e) => {
  if (
    e.target.tagName === 'A' &&
    e.target.classList.contains('internal-link')
  ) {
    // Wait a moment for HTMX to start the swap before closing
    setTimeout(() => {
      drawer.classList.remove('open')
    }, 100)
  }
})
