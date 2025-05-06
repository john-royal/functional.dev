import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

const useCount  = () => {
  const [value, setValue] = useState<number | null>(null)

  useEffect(() => {
    const fetchCount = async () => {
      const res = await fetch('/counter')
      const count = await res.text()
      setValue(Number(count))
    }
    fetchCount()
  }, [])

  const increment = async () => {
    const res = await fetch('/counter', { method: 'POST' })
    const count = await res.text()
    setValue(Number(count))
  }

  return {value, increment}
}

function App() {
  const {value, increment} = useCount()

  return (  
    <>
      <div>
        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button type="button" onClick={increment}>
          count is {value}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
