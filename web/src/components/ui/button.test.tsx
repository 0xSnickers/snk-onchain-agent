import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders button text', () => {
    render(<Button>保存</Button>);

    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
  });
});
