export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let noteId = url.pathname.slice(1);

    // 如果没有笔记ID，生成一个并重定向
    if (!noteId) {
      noteId = generateNoteId();
      return Response.redirect(`${url.origin}/${noteId}`);
    }

    // 验证笔记ID格式
    if (!noteId.match(/^[a-zA-Z0-9_-]{1,64}$/)) {
      return new Response('Invalid note ID', { status: 400 });
    }

    // 处理原始文本请求
    const isRaw = url.searchParams.has('raw') || 
      request.headers.get('user-agent')?.startsWith('curl') ||
      request.headers.get('user-agent')?.startsWith('Wget');

    if (request.method === 'POST') {
      const text = await request.text();
      if (text.length === 0) {
        await env.NOTES.delete(noteId);
      } else {
        await env.NOTES.put(noteId, text);
      }
      return new Response('OK');
    }

    const noteContent = await env.NOTES.get(noteId);

    if (isRaw) {
      if (!noteContent) {
        return new Response('Not Found', { status: 404 });
      }
      return new Response(noteContent, {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return new Response(template(noteId, noteContent || ''), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}; 


// 生成随机笔记ID
function generateNoteId(length = 5) {
  const chars = '234579abcdefghjkmnpqrstwxyz';
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(x => chars[x % chars.length])
    .join('');
}

// HTML 模板
const template = (noteId, content = '') => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${noteId}</title>
  <style>
    body {
      margin: 0;
      background: #ebeef1;
    }
    .container {
      position: absolute;
      top: 20px;
      right: 20px;
      bottom: 20px;
      left: 20px;
    }
    #content {
      margin: 0;
      padding: 20px;
      overflow-y: auto;
      resize: none;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      border: 1px solid #ddd;
      outline: none;
    }
    #printable {
      display: none;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background: #333b4d;
      }
      #content {
        background: #24262b;
        color: #fff;
        border-color: #495265;
      }
    }
    @media print {
      .container {
        display: none;
      }
      #printable {
        display: block;
        white-space: pre-wrap;
        word-break: break-word;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <textarea id="content">${content}</textarea>
  </div>
  <pre id="printable"></pre>
  <script>
    function uploadContent() {
      if (content !== textarea.value) {
        const temp = textarea.value;
        fetch(window.location.href, {
          method: 'POST',
          body: temp
        }).finally(() => {
          content = temp;
          setTimeout(uploadContent, 1000);
        });

        printable.textContent = temp;
      } else {
        setTimeout(uploadContent, 1000);
      }
    }

    const textarea = document.getElementById('content');
    const printable = document.getElementById('printable');
    let content = textarea.value;

    printable.textContent = content;
    textarea.focus();
    uploadContent();
  </script>
</body>
</html>`;
