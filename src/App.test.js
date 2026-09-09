import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => jest.restoreAllMocks());

test.each([200, 500])('login handles a non-JSON HTTP %s response without advancing', async (status) => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: status === 200,
    status,
    json: async () => { throw new SyntaxError('Unexpected token'); },
  });
  try {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Enter Student ID'), {
      target: { value: 'test-student' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(`invalid server response (HTTP ${status})`);
    expect(screen.queryByRole('heading', { name: 'Select Your Stream' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
  } finally {
    global.fetch = originalFetch;
  }
});

test('renders the Course Compass login', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Course Compass' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
});

test('cached sessions load the database plan before showing the dashboard', async () => {
  const originalFetch = global.fetch;
  localStorage.setItem('courseCompassUser', JSON.stringify({ user: {
    studentId: 'cached-student', stream: 'ENG101 + MAT110', currentSemester: 1,
  } }));
  let resolve;
  global.fetch = jest.fn(() => new Promise((done) => { resolve = done; }));
  try {
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your saved plan');
    expect(screen.queryByText('Welcome, cached-student')).not.toBeInTheDocument();
    resolve({ ok: true, json: async () => ({ user: {
      studentId: 'cached-student', stream: 'ENG101 + MAT110', currentSemester: 4,
    } }) });
    expect(await screen.findByText('Welcome, cached-student')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete Semester 4' })).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('a failed session refresh preserves cached data and offers retry without showing a default plan', async () => {
  const originalFetch = global.fetch;
  const saved = JSON.stringify({ user: { studentId: 'cached-student', stream: 'ENG101 + MAT110' } });
  localStorage.setItem('courseCompassUser', saved);
  global.fetch = jest.fn().mockRejectedValue(new Error('Service unavailable'));
  try {
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
    expect(screen.queryByText('Course Planner')).not.toBeInTheDocument();
    expect(localStorage.getItem('courseCompassUser')).toBe(saved);
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  } finally {
    global.fetch = originalFetch;
  }
});

test('malformed cached data reports a recovery error instead of crashing', async () => {
  localStorage.setItem('courseCompassUser', 'broken-json');
  render(<App />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Return to login' }));
  expect(screen.getByRole('heading', { name: 'Course Compass' })).toBeInTheDocument();
});

test('first login uses the same-origin serverless API and opens stream selection', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
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
