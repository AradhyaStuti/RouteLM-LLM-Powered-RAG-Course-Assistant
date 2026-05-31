import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import InputArea from '../components/InputArea.jsx';

describe('InputArea', () => {
  it('renders textarea and send button', () => {
    render(<InputArea onSend={() => {}} disabled={false} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByLabelText(/send message/i)).toBeInTheDocument();
  });

  it('send button is disabled when input is empty', () => {
    render(<InputArea onSend={() => {}} disabled={false} />);
    expect(screen.getByLabelText(/send message/i)).toBeDisabled();
  });

  it('calls onSend with trimmed text and clears input', async () => {
    const onSend = vi.fn();
    render(<InputArea onSend={onSend} disabled={false} />);
    const textarea = screen.getByRole('textbox');

    await userEvent.type(textarea, '  Hello world  ');
    await userEvent.keyboard('{Enter}');

    expect(onSend).toHaveBeenCalledWith('Hello world');
    expect(textarea.value).toBe('');
  });
});

import WelcomeScreen from '../components/WelcomeScreen.jsx';

describe('WelcomeScreen', () => {
  it('renders RouteLM heading', () => {
    render(<WelcomeScreen onSuggestionClick={() => {}} />);
    expect(screen.getByText('RouteLM')).toBeInTheDocument();
  });

  it('renders subject cards', () => {
    render(<WelcomeScreen onSuggestionClick={() => {}} />);
    // The sliding subject browser should expose every indexed corpus by name.
    expect(screen.getByText('ML Specialization')).toBeInTheDocument();
    expect(screen.getByText('Data Structures')).toBeInTheDocument();
    expect(screen.getByText('Cyber Security')).toBeInTheDocument();
  });
});

import ErrorBoundary from '../components/ErrorBoundary.jsx';

function ThrowError() {
  throw new Error('Test crash');
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });
});

import SourceCard from '../components/SourceCard.jsx';

describe('SourceCard', () => {
  it('renders nothing when sources is empty', () => {
    const { container } = render(<SourceCard sources={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
