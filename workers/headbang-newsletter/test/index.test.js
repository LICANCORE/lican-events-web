import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest } from "../src/index.js";

const ORIGIN = "https://www.licanevents.com";
const ENV = {
  ALLOWED_ORIGIN: ORIGIN,
  BREVO_API_KEY: "test-secret",
  BREVO_NEWSLETTER_LIST_ID: "9",
};

function request(body, overrides = {}) {
  return new Request("https://worker.example/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      ...overrides.headers,
    },
    body: JSON.stringify(body),
    ...overrides,
  });
}

test("handles the CORS preflight for the production origin", async () => {
  const response = await handleRequest(
    new Request("https://worker.example/", {
      method: "OPTIONS",
      headers: { Origin: ORIGIN },
    }),
    ENV,
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.match(response.headers.get("Access-Control-Allow-Methods"), /POST/u);
});

test("rejects origins outside the allowlist", async () => {
  const response = await handleRequest(
    request(
      { email: "person@example.com", newsletterConsent: true },
      { headers: { Origin: "https://attacker.example" } },
    ),
    ENV,
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
});

test("validates email and consent before contacting Brevo", async () => {
  let calls = 0;
  const mockFetch = async () => {
    calls += 1;
    return new Response(null, { status: 201 });
  };

  const invalidEmail = await handleRequest(
    request({ email: "invalid", newsletterConsent: true }),
    ENV,
    mockFetch,
  );
  const missingConsent = await handleRequest(
    request({ email: "person@example.com", newsletterConsent: false }),
    ENV,
    mockFetch,
  );

  assert.equal(invalidEmail.status, 400);
  assert.equal(missingConsent.status, 400);
  assert.equal(calls, 0);
});

test("creates or updates the contact in the configured Brevo list", async () => {
  let brevoRequest;
  const mockFetch = async (url, options) => {
    brevoRequest = { url, options };
    return new Response(JSON.stringify({ id: 123 }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  const response = await handleRequest(
    request({
      email: " Person@Example.COM ",
      privacyAccepted: true,
      newsletterConsent: true,
      website: "",
    }),
    ENV,
    mockFetch,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(brevoRequest.url, "https://api.brevo.com/v3/contacts");
  assert.equal(brevoRequest.options.headers["api-key"], "test-secret");
  assert.deepEqual(JSON.parse(brevoRequest.options.body), {
    email: "person@example.com",
    listIds: [9],
    updateEnabled: true,
    emailBlacklisted: false,
  });
});

test("does not contact Brevo when the honeypot is filled", async () => {
  let called = false;
  const response = await handleRequest(
    request({
      email: "bot@example.com",
      newsletterConsent: true,
      website: "spam",
    }),
    ENV,
    async () => {
      called = true;
      return new Response(null, { status: 201 });
    },
  );

  assert.equal(response.status, 200);
  assert.equal(called, false);
});

test("does not expose Brevo errors to the browser", async () => {
  const originalError = console.error;
  console.error = () => {};

  try {
    const response = await handleRequest(
      request({ email: "person@example.com", newsletterConsent: true }),
      ENV,
      async () => new Response('{"message":"bad key"}', { status: 401 }),
    );

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      success: false,
      error: "subscription_failed",
    });
  } finally {
    console.error = originalError;
  }
});
