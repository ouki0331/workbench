export function estimateBand(correct: number) {
  if (!Number.isInteger(correct) || correct < 0 || correct > 8)
    throw Error('Assessment score must be an integer from 0 to 8');
  return [3, 3.5, 4, 5, 5.5, 6, 6.5, 7, 8][correct];
}
