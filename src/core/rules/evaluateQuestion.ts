import { Character } from '@/core/data/characters';
import { Question } from '@/core/data/questions';

export function evaluateQuestion(question: Question, character: Character): boolean {
  const traitValue = character.traits[question.traitKey];
  return traitValue === question.traitValue;
}
