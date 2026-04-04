import { NavLink } from 'react-router-dom'
import './Navbar.css'

function Navbar({ plano = 'starter' }) {
  const isPro = plano === 'pro' || plano === 'enterprise'

  return (
    <nav className="navbar">
      <NavLink to="/pedidos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">
          {isPro ? '📋' : '🔒'}
        </span>
        <span className="nav-label">Pedidos</span>
      </NavLink>

      <NavLink to="/clientes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">👥</span>
        <span className="nav-label">Clientes</span>
      </NavLink>

      {isPro && (
        <NavLink to="/produtos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">📦</span>
          <span className="nav-label">Produtos</span>
        </NavLink>
      )}

      <NavLink to="/planner" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">📅</span>
        <span className="nav-label">Planner</span>
      </NavLink>

      <NavLink to="/mais" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">···</span>
        <span className="nav-label">Mais</span>
      </NavLink>
    </nav>
  )
}

export default Navbar
