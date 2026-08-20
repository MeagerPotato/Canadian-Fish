/**
 * Router shell — Home, Room (lobby/table), placeholder pages, 404.
 */
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.tsx'
import Room from './pages/Room.tsx'
import Practice from './pages/Practice.tsx'
import PracticeDrill from './pages/PracticeDrill.tsx'
import { Learn, NotFound, Strategy } from './pages/Placeholder.tsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/r/:code" element={<Room />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/strategy" element={<Strategy />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/practice/:drillId" element={<PracticeDrill />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
