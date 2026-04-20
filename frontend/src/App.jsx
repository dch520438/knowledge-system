import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import KnowledgeBase from './components/KnowledgeBase'
import Writing from './components/Writing'
import QA from './components/QA'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<KnowledgeBase />} />
        <Route path="/writing" element={<Writing />} />
        <Route path="/qa" element={<QA />} />
      </Routes>
    </Layout>
  )
}

export default App
