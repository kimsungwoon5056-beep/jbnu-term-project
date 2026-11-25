import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // 잘 바뀌지 않는 라이브러리를 따로 묶어, 앱만 고쳤을 때 다시 받지 않게 한다.
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            // 실시간 대결 연결은 대결 화면을 열 때만 받는다.
            { name: 'realtime', test: /node_modules[\\/](@firebase[\\/]database|firebase[\\/]database)/, priority: 2 },
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase|idb)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
})
