'use client'

import { useTheming } from '../lib/next-themes'

export default function Home() {
  const { state, updateState, options } = useTheming()

  return (
    <div>
      <pre>{JSON.stringify(state, null, 2)}</pre>
      {state && (
        <>
          <button onClick={() => updateState('mode', (prev) => (prev === 'dark' ? 'light' : 'dark'))}>mode</button>
          <button onClick={() => updateState('radius', (prev) => (prev === '1' ? '0.5' : '1'))}>radius</button>
        </>
      )}
      <pre>{JSON.stringify(options, null, 2)}</pre>
    </div>
  )
}
