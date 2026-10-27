import { mockStore } from '../mocks/store';

export const mockApi = {
  store: mockStore,
  resetToDefaults: () => {
    localStorage.removeItem('niyantran_mock_store');
    window.location.reload();
  },
};

export default mockApi;
