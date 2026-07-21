const request = require('supertest');
const app = require('../src/app');

describe('GET /', () => {
  test('returns status ok', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /price', () => {
  test('returns formatted price with discount applied', async () => {
    const res = await request(app).get('/price?amount=100&discount=10');
    expect(res.statusCode).toBe(200);
    expect(res.body.original).toBe('$100.00');
    expect(res.body.finalPrice).toBe('$90.00');
  });

  test('returns 400 when amount is missing', async () => {
    const res = await request(app).get('/price');
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /signup', () => {
  test('signs up with a valid email', async () => {
    const res = await request(app).post('/signup').send({ email: 'test@example.com' });
    expect(res.statusCode).toBe(201);
  });

  test('rejects an invalid email', async () => {
    const res = await request(app).post('/signup').send({ email: 'not-an-email' });
    expect(res.statusCode).toBe(400);
  });
});
