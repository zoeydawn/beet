const drawer = document.getElementById('drawer')
const btn = document.getElementById('menu-open-btn')

btn.addEventListener('click', (e) => {
  e.stopPropagation() // prevent click bubbling
  drawer.classList.toggle('open')

  if (drawer.classList.contains('open')) {
    // console.log('open')
    htmx.trigger(drawer, 'revealed') // load chats when drawer opens
  }
})

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

// close drawer when link is clicked
drawer.addEventListener('click', (e) => {
  if (
    e.target.tagName === 'A' &&
    e.target.classList.contains('internal-link')
  ) {
    drawer.classList.remove('open')
  }
})
