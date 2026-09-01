import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './data/mockData.js' // Seeds localStorage with mock stations, user, bookings on first load
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
