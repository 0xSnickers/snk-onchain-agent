import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog';

describe('Dialog', () => {
  it('opens dialog content from trigger', async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>打开</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>演示弹窗</DialogTitle>
          <DialogDescription>这是一段弹窗说明。</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole('button', { name: '打开' }));

    expect(screen.getByRole('dialog', { name: '演示弹窗' })).toBeInTheDocument();
  });
});
