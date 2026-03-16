const request = require('supertest');
const app = require('../backend/src/app');

jest.mock('../backend/src/models/studentModel', () => ({
  create: jest.fn().mockResolvedValue({ studentId: 'STU001', name: 'Alice', class: '5A', feeAmount: 200, feePaid: false }),
  find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
  findOne: jest.fn().mockResolvedValue({ studentId: 'STU001', name: 'Alice', class: '5A', feeAmount: 200, feePaid: false }),
  findOneAndUpdate: jest.fn().mockResolvedValue({}),
}));

jest.mock('../backend/src/models/paymentModel', () => ({
  find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(true),
  Schema: class {
    constructor() { this.index = jest.fn(); }
  },
  model: jest.fn().mockReturnValue({}),
}));

jest.mock('../backend/src/services/stellarService', () => ({
  syncPayments: jest.fn().mockResolvedValue(),
  verifyTransaction: jest.fn().mockResolvedValue({
    hash: 'abc123', memo: 'STU001', amount: 200, date: new Date().toISOString(),
  }),
}));

describe('Payment API', () => {
  test('GET /api/payments/instructions/:studentId returns wallet info', async () => {
    const res = await request(app).get('/api/payments/instructions/STU001');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('memo', 'STU001');
  });

  test('POST /api/payments/verify returns transaction details', async () => {
    const res = await request(app).post('/api/payments/verify').send({ txHash: 'abc123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hash', 'abc123');
  });

  test('POST /api/payments/sync returns success message', async () => {
    const res = await request(app).post('/api/payments/sync');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Sync complete');
  });

  test('GET /api/students/:studentId returns student', async () => {
    const res = await request(app).get('/api/students/STU001');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('studentId', 'STU001');
  });
});
