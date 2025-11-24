import { expect } from 'chai';
import ValidateAccountScreenPage from '../../src/pages/validate-account-screen.page';

describe('Validate Account Screen', () => {
  const page = new ValidateAccountScreenPage();

  it('should validate Validate Account Screen', async () => {
    // TODO: replace with real steps
    await page.open();
    const isVisible = await page.isVisible('some-element-xpath');
    expect(isVisible).to.equal(true);
  });
});
