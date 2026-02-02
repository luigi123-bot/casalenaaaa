import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Counter from './Counter'

describe('Counter component', () => {
    it('increments the counter when clicking the button', () => {
        render(<Counter />)

        const text = screen.getByText(/count:/i)
        const button = screen.getByRole('button', { name: /add/i })

        expect(text).toHaveTextContent('Count: 0')

        fireEvent.click(button)

        expect(text).toHaveTextContent('Count: 1')
    })
})
