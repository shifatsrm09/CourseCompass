import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test('renders the Course Compass login', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Course Compass' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
});

test('first login uses the same-origin serverless API and opens stream selection', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    json: async () => ({ firstLogin: true, user: null }),
  });

  try {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Enter Student ID'), {
      target: { value: 'test-student' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByRole('heading', { name: 'Select Your Stream' })).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ studentId: 'test-student' }),
    }));
  } finally {
    global.fetch = originalFetch;
  }
});
