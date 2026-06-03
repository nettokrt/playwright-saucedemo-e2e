import { test, expect } from '@playwright/test';

// SauceDemo has no backend API, so API coverage is demonstrated against
// restful-booker (https://restful-booker.herokuapp.com) — a public practice API
// with token auth + full CRUD. Uses Playwright's built-in `request` fixture
// (APIRequestContext); baseURL comes from the "api" project in playwright.config.ts.


//to do: add negative tests for auth (invalid credentials, expired token, etc.)
//to do: add tests for edge cases (invalid data, missing fields, etc.) and error handling (server errors, network issues, etc.)
//to do: add tests for performance (response times, load testing, etc.)
//to do: add fixtures

const AUTH = { username: 'admin', password: 'password123' };

const BOOKING = {
  firstname: 'Jim',
  lastname: 'Brown',
  totalprice: 111,
  depositpaid: true,
  bookingdates: { checkin: '2018-01-01', checkout: '2019-01-01' },
  additionalneeds: 'Breakfast',
};

const UPDATED = { ...BOOKING, firstname: 'James', lastname: 'Smith', totalprice: 222 };

test('TC-A01: GET /ping returns 201 (health check)', async ({ request }) => {
  const res = await request.get('/ping');
  expect(res.status()).toBe(201);
});

test('TC-A02: POST /auth returns a token', async ({ request }) => {
  const res = await request.post('/auth', { data: AUTH });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(typeof body.token).toBe('string');
  expect(body.token.length).toBeGreaterThan(0);
});

test('TC-A09: PUT without auth token is rejected (403)', async ({ request }) => {
  const res = await request.put('/booking/1', { data: UPDATED });
  expect(res.status()).toBe(403);
});

test.describe.serial('Booking lifecycle', () => {
  let token: string;
  let bookingId: number;

  test.beforeAll(async ({ request }) => {
    const res = await request.post('/auth', { data: AUTH });
    token = (await res.json()).token;
  });

  test('TC-A03: POST /booking creates a booking', async ({ request }) => {
    const res = await request.post('/booking', { data: BOOKING });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.bookingid).toEqual(expect.any(Number));
    expect(body.booking).toMatchObject(BOOKING);
    bookingId = body.bookingid;
  });

  test('TC-A04: GET /booking/:id returns the created booking', async ({ request }) => {
    const res = await request.get(`/booking/${bookingId}`);
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toMatchObject(BOOKING);
  });

  test('TC-A05: GET /booking lists the new booking id', async ({ request }) => {
    const res = await request.get('/booking');
    expect(res.ok()).toBeTruthy();
    const ids = (await res.json()).map((b: { bookingid: number }) => b.bookingid);
    expect(ids).toContain(bookingId);
  });

  test('TC-A06: PUT /booking/:id fully updates the booking (auth)', async ({ request }) => {
    const res = await request.put(`/booking/${bookingId}`, {
      headers: { Cookie: `token=${token}` },
      data: UPDATED,
    });
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toMatchObject(UPDATED);
  });

  test('TC-A07: PATCH /booking/:id partially updates the booking (auth)', async ({ request }) => {
    const res = await request.patch(`/booking/${bookingId}`, {
      headers: { Cookie: `token=${token}` },
      data: { firstname: 'Patched' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.firstname).toBe('Patched');
    expect(body.lastname).toBe(UPDATED.lastname); // untouched fields persist
  });

  test('TC-A08: DELETE /booking/:id removes the booking (auth)', async ({ request }) => {
    const del = await request.delete(`/booking/${bookingId}`, {
      headers: { Cookie: `token=${token}` },
    });
    expect(del.status()).toBe(201);

    const get = await request.get(`/booking/${bookingId}`);
    expect(get.status()).toBe(404);
  });
});
