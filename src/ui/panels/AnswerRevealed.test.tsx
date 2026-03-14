import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnswerRevealed } from './AnswerRevealed';
import * as selectors from '@/core/store/selectors';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock selectors
vi.mock('@/core/store/selectors', () => ({
  useCurrentQuestion: vi.fn(),
  useCpuQuestion: vi.fn(),
  useOpponentQuestion: vi.fn(),
  useGameMode: vi.fn(),
  useGameActions: vi.fn(),
}));

// Mock sfx
vi.mock('@/shared/audio/sfx', () => ({
  sfx: {
    answerYes: vi.fn(),
    answerNo: vi.fn(),
  },
}));

describe('AnswerRevealed', () => {
  const mockAdvancePhase = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (selectors.useGameActions as any).mockReturnValue({
      advancePhase: mockAdvancePhase,
    });
  });

  it('renders nothing when no questions are present', () => {
    (selectors.useCurrentQuestion as any).mockReturnValue(null);
    (selectors.useCpuQuestion as any).mockReturnValue(null);
    (selectors.useOpponentQuestion as any).mockReturnValue(null);
    
    const { container } = render(<AnswerRevealed />);
    expect(container.firstChild).toBeNull();
  });

  it('renders player question and answer', () => {
    (selectors.useCurrentQuestion as any).mockReturnValue({
      questionText: 'Is your character blue?',
      answer: true,
    });
    (selectors.useCpuQuestion as any).mockReturnValue(null);
    (selectors.useOpponentQuestion as any).mockReturnValue(null);
    (selectors.useGameMode as any).mockReturnValue('free');

    render(<AnswerRevealed />);
    
    expect(screen.getByText('Is your character blue?')).toBeInTheDocument();
    expect(screen.getByText('YES')).toBeInTheDocument();
  });

  it('renders CPU question in free mode', () => {
    (selectors.useCurrentQuestion as any).mockReturnValue({
      questionText: 'Player question',
      answer: true,
    });
    (selectors.useCpuQuestion as any).mockReturnValue({
      questionText: 'CPU question',
      answer: false,
    });
    (selectors.useOpponentQuestion as any).mockReturnValue(null);
    (selectors.useGameMode as any).mockReturnValue('free');

    render(<AnswerRevealed />);
    
    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('CPU question')).toBeInTheDocument();
    expect(screen.getAllByText('NO')).toHaveLength(1);
  });

  it('auto-advances after 2 seconds', () => {
    (selectors.useCurrentQuestion as any).mockReturnValue({
      questionText: '?',
      answer: true,
    });
    (selectors.useGameMode as any).mockReturnValue('free');

    render(<AnswerRevealed />);
    
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockAdvancePhase).toHaveBeenCalled();
  });
});
