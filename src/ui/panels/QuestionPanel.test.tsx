import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestionPanel } from './QuestionPanel';
import * as selectors from '@/core/store/selectors';

// Mock framer-motion (it can be problematic in JSDOM)
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock selectors
vi.mock('@/core/store/selectors', () => ({
  useGameActions: vi.fn(),
  useQuestionHistory: vi.fn(() => []),
  useActivePlayer: vi.fn(() => 'player1'),
  usePhase: vi.fn(() => 'QUESTION_SELECT'),
  useGameCharacters: vi.fn(() => []),
  usePlayerState: vi.fn(() => ({ eliminatedCharacterIds: [] })),
  useGameMode: vi.fn(() => 'free'),
  useOnlinePlayerNum: vi.fn(() => null),
  useEliminatedIds: vi.fn(() => []),
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock sub-components to keep the test focused on QuestionPanel logic
vi.mock('./question/Pills', () => ({
  WaitingPill: () => <div data-testid="waiting-pill">Waiting...</div>,
  RiskItPill: ({ onClick }: any) => <button onClick={onClick}>Risk It</button>,
  AskPill: ({ onClick }: any) => <button onClick={onClick}>Ask</button>,
}));

vi.mock('./question/FreeModeBody', () => ({
  FreeModeBody: ({ onAsk }: any) => (
    <div data-testid="free-mode-body">
      <button onClick={() => onAsk({ id: 'q1' })}>Ask Q1</button>
    </div>
  ),
}));

vi.mock('./question/NFTModeBody', () => ({
  NFTModeBody: () => <div data-testid="nft-mode-body" />,
}));

describe('QuestionPanel', () => {
  const mockAskQuestion = vi.fn();
  const mockStartGuess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (selectors.useGameActions as any).mockReturnValue({
      askQuestion: mockAskQuestion,
      startGuess: mockStartGuess,
    });
  });

  it('renders the expanded panel by default in free mode', () => {
    (selectors.useGameMode as any).mockReturnValue('free');
    render(<QuestionPanel />);
    
    expect(screen.getByText('game.ask_question')).toBeInTheDocument();
    expect(screen.getByTestId('free-mode-body')).toBeInTheDocument();
  });

  it('handles minimizing and expanding', () => {
    render(<QuestionPanel />);
    
    // Minimize
    const hideButton = screen.getByText('Hide');
    fireEvent.click(hideButton);
    
    expect(screen.queryByText('game.ask_question')).not.toBeInTheDocument();
    expect(screen.getByText('Ask')).toBeInTheDocument();
    
    // Expand
    fireEvent.click(screen.getByText('Ask'));
    expect(screen.getByText('game.ask_question')).toBeInTheDocument();
  });

  it('triggers askQuestion when a question is selected in FreeModeBody', () => {
    render(<QuestionPanel />);
    
    const askButton = screen.getByText('Ask Q1');
    fireEvent.click(askButton);
    
    expect(mockAskQuestion).toHaveBeenCalledWith('q1');
  });

  it('triggers startGuess when Risk It is clicked', () => {
    render(<QuestionPanel />);
    
    // There are several Risk It buttons/pills. Let's find one.
    // Since we mocked 't' to return the key, we search for the key or something related.
    const riskButtons = screen.getAllByText(/risk_it/i);
    fireEvent.click(riskButtons[0]);
    
    expect(mockStartGuess).toHaveBeenCalled();
  });

  it('renders NFTModeBody in online mode', () => {
    (selectors.useGameMode as any).mockReturnValue('online');
    render(<QuestionPanel />);
    
    expect(screen.getByTestId('nft-mode-body')).toBeInTheDocument();
  });
});
