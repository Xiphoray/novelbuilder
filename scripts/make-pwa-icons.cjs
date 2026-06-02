// scripts/make-pwa-icons.cjs
// 用法：node scripts/make-pwa-icons.cjs
// 一次性把 5 个 PWA 图标 SVG 写到 public/icons/
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const grad = (id) => `
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7e14ff"/>
      <stop offset="100%" stop-color="#1677ff"/>
    </linearGradient>
  </defs>`;

const files = {
  'icon-192.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">${grad('b')}<rect width="192" height="192" rx="36" fill="url(#b)"/><path d="M40 60h44v72H40z" fill="#fff" opacity=".95"/><path d="M108 60h44v72h-44z" fill="#fff" opacity=".85"/><path d="M86 70l-22 38h18l-12 24 32-42h-18z" fill="#ffc53d"/></svg>`,

  'icon-512.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${grad('b')}<rect width="512" height="512" rx="96" fill="url(#b)"/><path d="M107 160h117v192H107z" fill="#fff" opacity=".95"/><path d="M288 160h117v192H288z" fill="#fff" opacity=".85"/><path d="M229 187l-58 100h48l-32 64 86-112h-48z" fill="#ffc53d"/></svg>`,

  'icon-maskable.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${grad('b')}<rect width="512" height="512" fill="#fff"/><circle cx="256" cy="256" r="205" fill="url(#b)"/><path d="M165 215h80v130h-80z" fill="#fff" opacity=".95"/><path d="M267 215h80v130h-80z" fill="#fff" opacity=".85"/><path d="M238 232l-40 70h34l-22 44 60-78h-34z" fill="#ffc53d"/></svg>`,

  'shortcut-create.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">${grad('b')}<rect width="96" height="96" rx="20" fill="url(#b)"/><path d="M48 20a28 28 0 1 0 0 56 28 28 0 0 0 0-56zm0 50a22 22 0 1 1 0-44 22 22 0 0 1 0 44z" fill="#fff"/><path d="M46 32h4v14h14v4H50v14h-4V50H32v-4h14z" fill="#fff"/></svg>`,

  'shortcut-history.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">${grad('b')}<rect width="96" height="96" rx="20" fill="url(#b)"/><circle cx="48" cy="48" r="26" fill="none" stroke="#fff" stroke-width="5"/><path d="M48 32v16l10 6" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M20 30l-4 4 4 4M76 30l4 4-4 4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`,
};

for (const [name, content] of Object.entries(files)) {
  const filePath = path.join(outDir, name);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('wrote', filePath, content.length, 'bytes');
}
