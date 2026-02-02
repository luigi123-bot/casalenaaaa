'use client'

import { useState } from 'react'

export default function Counter() {
    const [count, setCount] = useState(0)

    return (
        <div>
            <span>Count: {count}</span>
            <button onClick={() => setCount(c => c + 1)}>Add</button>
        </div>
    )
}
