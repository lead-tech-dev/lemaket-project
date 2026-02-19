import { screen, fireEvent, waitFor } from '@testing-library/react';
import { ImagesManager } from './ImagesManager';
import { uploadMedia } from '../../utils/media';
import { renderWithProviders } from '../../test/test-utils'

vi.mock('../../utils/media', () => ({
  uploadMedia: vi.fn(),
}));

describe('ImagesManager', () => {
  const mockOnChange = vi.fn();
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('allows uploading an image file', async () => {
    vi.mocked(uploadMedia).mockResolvedValue({
      url: 'https://example.com/new-image.jpg',
      key: 'new-image.jpg',
      originalName: 'new-image.jpg',
    });

    renderWithProviders(<ImagesManager value={[]} onChange={mockOnChange} />);

    const fileInput = screen.getByLabelText(/Ajouter des photos/i);
    const file = new File(['(⌐□_□)'], 'chucknorris.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadMedia).toHaveBeenCalled();
    });
  });
});
