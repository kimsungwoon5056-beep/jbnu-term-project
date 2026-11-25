import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { readInvite } from './lib/invite'
import { applyMotion } from './lib/motion'

applyMotion()
readInvite()

// 개발 서버에서 ?gallery로 열면 캐릭터 견본 화면을 보여 준다. 배포 빌드에서는 이 분기가 빠진다.
const showGallery = import.meta.env.DEV && new URLSearchParams(window.location.search).has('gallery')
const CharacterGallery = showGallery ? lazy(() => import('./character/CharacterGallery')) : null

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {CharacterGallery ? (
      <Suspense fallback={null}>
        <CharacterGallery />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
