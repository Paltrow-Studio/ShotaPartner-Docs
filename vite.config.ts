import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages 项目站点地址：https://paltrow-studio.github.io/ShotaPartner-Docs/
// 因此资源必须带 /ShotaPartner-Docs/ 前缀（本仓库是项目站点，挂在组织域名下的子路径）。
// 如果以后迁到自定义域名或改成用户站点，把这里改成 '/' 即可。
const base = '/ShotaPartner-Docs/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
  },
  server: {
    port: 5173,
  },
})
