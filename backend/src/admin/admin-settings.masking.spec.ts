import { maskValue, isMaskEcho } from './admin-settings.masking';

describe('settings masking', () => {
  it('keeps a short prefix and hides the rest', () => {
    expect(maskValue('sk-live-abcdefghijkl')).toBe('sk-l' + '•'.repeat(16));
  });

  it('pads a short value so its length is not leaked', () => {
    expect(maskValue('abc')).toBe('abc' + '•'.repeat(8));
  });
});

describe('isMaskEcho', () => {
  const stored = 'sk-live-abcdefghijkl';

  it('catches the exact preview the reader served', () => {
    expect(isMaskEcho(maskValue(stored), stored)).toBe(true);
  });

  it('catches the generic all-bullets placeholder even with nothing stored', () => {
    expect(isMaskEcho('••••••••', null)).toBe(true);
  });

  it('lets a real new value through', () => {
    expect(isMaskEcho('sk-live-somethingelse', stored)).toBe(false);
  });

  it('lets a value through that merely contains a bullet', () => {
    // GDPR_CONSENT_TEXT is display-safe prose and may legitimately use bullets.
    expect(isMaskEcho('We store: • your email • your firm', stored)).toBe(false);
  });

  it('treats clearing a setting as a real, deliberate write', () => {
    expect(isMaskEcho('', stored)).toBe(false);
  });
});
