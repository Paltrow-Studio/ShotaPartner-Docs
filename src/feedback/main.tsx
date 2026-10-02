import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FeedbackPage } from './FeedbackPage'
import '../index.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root 容器不存在')

createRoot(container).render(
  <StrictMode>
    <FeedbackPage />
  </StrictMode>,
)