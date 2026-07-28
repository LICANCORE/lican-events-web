# Headbang Dealers newsletter Worker

Cloudflare Worker used by the newsletter gate at:

`https://www.licanevents.com/headbangdealers_the_game/`

The production Worker must keep these bindings:

- `ALLOWED_ORIGIN` (text): `https://www.licanevents.com`
- `BREVO_NEWSLETTER_LIST_ID` (text): `9`
- `BREVO_API_KEY` (secret)

Deploy from this directory:

```sh
npx wrangler deploy
```

The Worker validates the request origin, email and consent, then creates or
updates the Brevo contact and adds it to the configured list.
