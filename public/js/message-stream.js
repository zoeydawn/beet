import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js'

document.body.addEventListener('htmx:sseClose', function (e) {
  console.log('in message stream')
  if (e.detail.type === 'message') {
    const el = e.target // the element that was connected
    const text = el.innerText

    // Save to localStorage
    localStorage.setItem(`${el.id}`, `${text.slice(0, 15)}...`)

    // Render Markdown
    el.innerHTML = marked.parse(text)
  }

  // if (e.type === 'error') {
  //   console.error('error', e)
  // }
})
