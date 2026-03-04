import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Login from './Login';

describe('Login', () => {
  it('renders title and Connect Gmail button', () => {
    render(<Login onConnect={() => {}} />);
    expect(screen.getByRole('heading', { name: /inbox concierge/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect gmail/i })).toBeInTheDocument();
  });
});
