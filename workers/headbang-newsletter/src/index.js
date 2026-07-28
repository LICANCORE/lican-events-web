const BREVO_CONTACTS_ENDPOINT = "https://api.brevo.com/v3/contacts";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;
const MAX_BODY_BYTES = 8_192;

function corsHeaders(origin, allowedOrigin) {
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin && origin === allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function jsonResponse(body, status, origin, allowedOrigin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin, allowedOrigin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isAllowedOrigin(origin, allowedOrigin) {
  return Boolean(origin && allowedOrigin && origin === allowedOrigin);
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export async function handleRequest(request, env, brevoFetch = fetch) {
  const origin = request.headers.get("Origin") ?? "";
  const allowedOrigin = String(env.ALLOWED_ORIGIN ?? "").replace(/\/+$/u, "");

  if (!isAllowedOrigin(origin, allowedOrigin)) {
    return jsonResponse({ success: false, error: "origin_not_allowed" }, 403, origin, allowedOrigin);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin, allowedOrigin),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "method_not_allowed" }, 405, origin, allowedOrigin);
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ success: false, error: "payload_too_large" }, 413, origin, allowedOrigin);
  }

  let payload;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ success: false, error: "payload_too_large" }, 413, origin, allowedOrigin);
    }
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ success: false, error: "invalid_json" }, 400, origin, allowedOrigin);
  }

  // Honeypot: bots receive a neutral success without reaching Brevo.
  if (String(payload.website ?? "").trim()) {
    return jsonResponse({ success: true }, 200, origin, allowedOrigin);
  }

  const email = normalizeEmail(payload.email);
  const consentAccepted =
    payload.newsletterConsent === true ||
    payload.privacyAccepted === true ||
    payload.rgpd === true;

  if (!EMAIL_PATTERN.test(email)) {
    return jsonResponse({ success: false, error: "invalid_email" }, 400, origin, allowedOrigin);
  }

  if (!consentAccepted) {
    return jsonResponse({ success: false, error: "consent_required" }, 400, origin, allowedOrigin);
  }

  const listId = Number.parseInt(String(env.BREVO_NEWSLETTER_LIST_ID ?? ""), 10);
  if (!env.BREVO_API_KEY || !Number.isSafeInteger(listId) || listId <= 0) {
    console.error("Missing or invalid Brevo Worker configuration.");
    return jsonResponse({ success: false, error: "service_unavailable" }, 503, origin, allowedOrigin);
  }

  let brevoResponse;
  try {
    brevoResponse = await brevoFetch(BREVO_CONTACTS_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        email,
        listIds: [listId],
        updateEnabled: true,
        emailBlacklisted: false,
      }),
    });
  } catch (error) {
    console.error("Brevo request failed.", error);
    return jsonResponse({ success: false, error: "upstream_unavailable" }, 502, origin, allowedOrigin);
  }

  if (!brevoResponse.ok) {
    const upstreamBody = await brevoResponse.text().catch(() => "");
    console.error("Brevo rejected the contact.", brevoResponse.status, upstreamBody);
    return jsonResponse({ success: false, error: "subscription_failed" }, 502, origin, allowedOrigin);
  }

  return jsonResponse({ success: true }, 200, origin, allowedOrigin);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
