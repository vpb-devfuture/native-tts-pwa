# Voxa Web — Native Voice Studio

Bản này đã được chuyển từ Chrome Extension sang web app để deploy lên Vercel.

## Điểm đã chuyển đổi

- `chrome.tts` → Web Speech API: `speechSynthesis` + `SpeechSynthesisUtterance`
- `chrome.storage.sync` → `localStorage`
- `popup.html` → `index.html`
- `popup.js` → `src/main.js`
- `popup.css` → `src/styles.css`
- Bỏ `manifest.json`, `background.js`, context menu và extension shortcuts vì web app không dùng được Chrome Extension API.

## Chạy local

```bash
npm install
npm run dev
```

Mở URL mà Vite hiển thị, thường là:

```text
http://localhost:5173
```

## Build local

```bash
npm run build
npm run preview
```

## Deploy lên Vercel

### Cách 1: Deploy bằng GitHub

1. Push folder này lên GitHub.
2. Vào Vercel → Add New Project → Import Git Repository.
3. Framework Preset: Vite.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Deploy.

### Cách 2: Deploy bằng Vercel CLI

```bash
npm install -g vercel
vercel login
vercel
vercel --prod
```

## Lưu ý sau khi chuyển sang web

- Web app chỉ đọc text người dùng nhập/paste trong trang web.
- Không còn chức năng right-click “Read selected text” trên mọi website.
- Không còn shortcut global `Ctrl+Shift+S` / `Ctrl+Shift+X` của extension.
- Giọng đọc phụ thuộc browser/hệ điều hành. Chrome thường có nhiều English voices hơn.
- Một số browser có thể yêu cầu thao tác click của người dùng trước khi phát âm thanh.
