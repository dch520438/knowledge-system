import { NavLink } from 'react-router-dom'
import './Layout.css'

function Layout({ children }) {
  return (
    <div className="layout">
      <aside className="layout-sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">🧠</span>
          <span className="logo-text">知识工作台</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" className="nav-item" end>
            <span className="nav-icon">📚</span>
            <span className="nav-label">知识库</span>
          </NavLink>
          <NavLink to="/writing" className="nav-item">
            <span className="nav-icon">✍️</span>
            <span className="nav-label">写作助手</span>
          </NavLink>
          <NavLink to="/qa" className="nav-item">
            <span className="nav-icon">❓</span>
            <span className="nav-label">智能问答</span>
          </NavLink>
          <NavLink to="/settings" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">设置</span>
          </NavLink>
        </nav>
      </aside>
      <div className="layout-main">
        <header className="layout-header">
          <h1 className="header-title">智能知识工作台</h1>
        </header>
        <main className="layout-content">{children}</main>
      </div>
    </div>
  )
}

export default Layout
