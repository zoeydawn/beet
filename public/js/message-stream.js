import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js'
const generatingSpinner = document.getElementById('generating-response-spinner')

function renderMarkdown(element, content) {
  // Format the buffer so that markdown can be parsed without issues
  const formattedBuffer = content.replace(/<br>/g, '\n')

  // Render the full buffer as Markdown
  element.innerHTML = marked.parse(formattedBuffer)
}

// Buffer to keep the full message per element
const buffers = {}
const tokenCounts = {}
const BATCH_SIZE = 50

document.body.addEventListener('htmx:sseMessage', function (e) {
  const el = e.target

  // Only handle assistant messages
  if (!el.classList.contains('assistant-message')) return

  const id = el.id

  // Initialize buffer and token count if first chunk
  if (!buffers[id]) {
    buffers[id] = ''
    tokenCounts[id] = 0
  }

  // e.detail.data contains the new token from the server
  const chunk = e.detail.data

  // Append new chunk
  buffers[id] += chunk
  tokenCounts[id]++

  // Only render every BATCH_SIZE tokens
  if (tokenCounts[id] % BATCH_SIZE === 0) {
    renderMarkdown(el, buffers[id])
  }
})

document.body.addEventListener('htmx:beforeRequest', (e) => {
  // show "generating response" spinner
  if (e.target.matches('[hx-post="/initial-ask"], [hx-post^="/new-ask/"]')) {
    if (generatingSpinner) {
      generatingSpinner.classList.add('visible')
    }
  }
})

document.body.addEventListener('htmx:sseClose', function (e) {
  if (e.detail.type === 'message') {
    // hide "generating response" spinner
    if (generatingSpinner) {
      generatingSpinner.classList.remove('visible')
    }

    // Final render when stream closes (to catch any remaining tokens)
    const id = e.target.id
    if (buffers[id]) {
      renderMarkdown(e.target, buffers[id])
      // Clear buffers
      buffers[id] = ''
      tokenCounts[id] = 0
    }
  }
})
