import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import monkey from 'vite-plugin-monkey';
import tailwindcss from '@tailwindcss/vite';
import path from "path";


export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src")
    }
  },
  plugins: [
    solidPlugin(),
    tailwindcss(),
    monkey({
      entry: 'src/index.tsx',
      server: {
        open: false,
      },
      userscript: {
        match: ['https://cenele.com/*'],
        icon: "https://www.google.com/s2/favicons?sz=64&domain=cenele.com",
        namespace: "darkless/cenele",
        author: "Darkless",
        version: "1.0.0",
        updateURL:
          "https://github.com/StarlessNight13/cenele-reader/releases/latest/download/cenele.user.js",
        downloadURL:
          "https://github.com/StarlessNight13/cenele-reader/releases/latest/download/cenele.user.js",
      },
    }),
  ],
});
