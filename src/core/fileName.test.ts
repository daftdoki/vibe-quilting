import { describe, expect, it } from 'vitest';
import { pngFileName, quiltFileBase } from './fileName';

describe('quiltFileBase', () => {
  it('turns illegal characters into spaces and collapses them', () => {
    expect(quiltFileBase('Ginger\'s "Happy" Quilt / v2')).toBe("Ginger's Happy Quilt v2");
    expect(quiltFileBase('a\\b:c*d?e<f>g|h')).toBe('a b c d e f g h');
  });

  it('keeps letters, digits, accents, hyphens, underscores, apostrophes and inner dots', () => {
    expect(quiltFileBase("Zoë's Crème-Brûlée_Quilt No. 2")).toBe("Zoë's Crème-Brûlée_Quilt No. 2");
    expect(quiltFileBase('Grandma’s quilt')).toBe('Grandma’s quilt');
  });

  it('drops control characters', () => {
    expect(quiltFileBase('Tab\there\u0000and\u007fthere')).toBe('Tab here and there');
  });

  it('trims spaces and dots from the ends', () => {
    expect(quiltFileBase('  ...My quilt...  ')).toBe('My quilt');
    expect(quiltFileBase('.hidden')).toBe('hidden');
  });

  it('caps the length at 60 characters, then trims again', () => {
    const long = `${'a'.repeat(59)} bcdef`;
    expect(quiltFileBase(long)).toBe('a'.repeat(59));
    expect(Array.from(quiltFileBase('é'.repeat(80)) ?? '')).toHaveLength(60);
  });

  it('returns null when nothing usable is left', () => {
    expect(quiltFileBase('')).toBeNull();
    expect(quiltFileBase('   ')).toBeNull();
    expect(quiltFileBase('/// ... ???')).toBeNull();
    expect(quiltFileBase('CON')).toBeNull();
    expect(quiltFileBase('lpt1')).toBeNull();
  });
});

describe('pngFileName', () => {
  it('uses the name, or the project and size when there is none', () => {
    expect(pngFileName('Ginger\'s "Happy" Quilt / v2', 'stacks-happy-place', 'queen')).toBe("Ginger's Happy Quilt v2.png");
    expect(pngFileName('', 'stacks-happy-place', 'queen')).toBe('stacks-happy-place-queen.png');
    expect(pngFileName('***', 'stacks-happy-place', 'queen')).toBe('stacks-happy-place-queen.png');
  });
});
