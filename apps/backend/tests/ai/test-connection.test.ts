import { GET as testConnection } from '@/app/api/ai/test-connection/route';

// Mock the AI client BEFORE the tests run
jest.mock('@/lib/ai/ai-client', () => ({
  aiClient: {
    testConnection: jest.fn()
  }
}));

// Import the mocked client
import { aiClient } from '@/lib/ai/ai-client';
const mockAiClient = aiClient as jest.Mocked<typeof aiClient>;

describe('AI Test Connection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return successful connection', async () => {
    // Mock successful connection
    mockAiClient.testConnection.mockResolvedValue(true);

    const response = await testConnection();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe('connected');
  });

  it('should handle connection failure', async () => {
    // Mock failed connection
    mockAiClient.testConnection.mockResolvedValue(false);

    const response = await testConnection();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.success).toBe(false);
    expect(data.status).toBe('disconnected');
  });

  it('should handle connection error', async () => {
    // Mock connection error
    mockAiClient.testConnection.mockRejectedValue(new Error('Network error'));

    const response = await testConnection();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.status).toBe('error');
  });
});
