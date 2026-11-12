import { getHelpCards, getWrittenGuides, GUIDES } from '@/components/ayuda/guide-registry';

/**
 * ZIG-I40: once both guide batches are merged (part 1, ZIG-I40-3, and part 2,
 * ZIG-I40-4), all sixteen guides are written and every one has its card.
 * Expected to fail on a branch that has only one of the two batches.
 */
describe('help centre complete (ZIG-I40-3 + ZIG-I40-4)', () => {
  it('has sixteen written guides and a card for each', () => {
    expect(GUIDES).toHaveLength(16);
    expect(getWrittenGuides()).toHaveLength(16);
    expect(getHelpCards(GUIDES, false)).toHaveLength(16);
  });
});
