import { describe, it, expect } from 'vitest';
import { evaluateQuestion } from './evaluateQuestion';
import type { Character } from '@/core/data/characters';
import type { Question } from '@/core/data/questions';

describe('evaluateQuestion', () => {
  const sampleCharacter: Character = {
    id: 'c01',
    name: 'Luna',
    traits: {
      hair_color: 'blue',
      hair_style: 'long',
      skin_tone: 'light',
      gender: 'female',
      eye_color: 'green',
      has_glasses: false,
      has_hat: false,
      has_beard: false,
    } as any,
  } as any;

  it('evaluates boolean traits correctly', () => {
    const qHasEarrings: Question = {
      id: 'q1',
      text: 'Do they have earrings?',
      traitKey: 'has_earrings',
      traitValue: true,
      category: 'accessories',
    };
    const qHasGlasses: Question = {
      id: 'q2',
      text: 'Do they have glasses?',
      traitKey: 'has_glasses',
      traitValue: true,
      category: 'accessories',
    };

    expect(evaluateQuestion(qHasEarrings, sampleCharacter)).toBe(true);
    expect(evaluateQuestion(qHasGlasses, sampleCharacter)).toBe(false);
  });

  it('evaluates enum traits correctly', () => {
    const qBlueHair: Question = {
      id: 'q3',
      text: 'Do they have blue hair?',
      traitKey: 'hair_color',
      traitValue: 'blue',
      category: 'hair',
    };
    const qRedHair: Question = {
      id: 'q4',
      text: 'Do they have red hair?',
      traitKey: 'hair_color',
      traitValue: 'red',
      category: 'hair',
    };

    expect(evaluateQuestion(qBlueHair, sampleCharacter)).toBe(true);
    expect(evaluateQuestion(qRedHair, sampleCharacter)).toBe(false);
  });

  it('uses matchFn when provided', () => {
    const qCustom: Question = {
      id: 'q5',
      text: 'Is their name Luna?',
      traitKey: 'name',
      traitValue: 'Luna',
      category: 'other',
      matchFn: (char) => char.name === 'Luna',
    };

    expect(evaluateQuestion(qCustom, sampleCharacter)).toBe(true);
    
    const qCustomFalse: Question = {
      id: 'q6',
      text: 'Is their name Max?',
      traitKey: 'name',
      traitValue: 'Max',
      category: 'other',
      matchFn: (char) => char.name === 'Max',
    };
    expect(evaluateQuestion(qCustomFalse, sampleCharacter)).toBe(false);
  });
});
