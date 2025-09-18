const drawer = document.getElementById('drawer')
const btn = document.getElementById('menu-btn')

btn.addEventListener('click', () => {
  drawer.classList.toggle('open')
})
