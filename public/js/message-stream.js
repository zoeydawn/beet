import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js'

// Buffer to keep the full message per element
const buffers = {}

document.body.addEventListener('htmx:sseMessage', function (e) {
  const el = e.target

  // Only handle assistant messages
  if (!el.classList.contains('assistant-message')) return

  const id = el.id

  // Initialize buffer if first chunk
  if (!buffers[id]) buffers[id] = ''

  // e.detail.data contains the new token from the server
  const chunk = e.detail.data

  // Append new chunk
  buffers[id] += chunk

  // format the buffer so that markdown can be parsed without issues
  const formattedBuffer = buffers[id].replace(/<br>/g, '\n')

  // Render the full buffer as Markdown
  el.innerHTML = marked.parse(formattedBuffer)
})

document.body.addEventListener('htmx:sseClose', function (e) {
  // clear buffers once message is closed
  if (e.detail.type === 'message') {
    buffers[e.target.id] = ''
  }
})
