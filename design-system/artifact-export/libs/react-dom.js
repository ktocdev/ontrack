import ReactDOM from 'react-dom'
import { createRoot, hydrateRoot } from 'react-dom/client'
window.ReactDOM = Object.assign({}, ReactDOM, { createRoot, hydrateRoot })
