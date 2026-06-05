// Fonction Netlify — crée une session de paiement Stripe Checkout.
// La clé SECRÈTE Stripe n'est PAS dans ce fichier : elle est lue depuis
// la variable d'environnement Netlify "STRIPE_SECRET_KEY".
// Aucune dépendance à installer : on appelle directement l'API Stripe.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Clé Stripe manquante côté serveur (STRIPE_SECRET_KEY).' }) };
  }

  let data = {};
  try { data = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Requête invalide.' }) };
  }

  const cents = Math.round(Number(data.amount) * 100);
  if (!cents || cents < 50) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Montant invalide.' }) };
  }

  const ref = (data.ref || '').toString().slice(0, 40);
  const label = (data.label || ('Acompte réservation ' + ref)).toString().slice(0, 250);
  const origin = event.headers.origin || ('https://' + (event.headers.host || 'allo-sono.fr'));

  const p = new URLSearchParams();
  p.append('mode', 'payment');
  p.append('success_url', origin + '/?paye=' + encodeURIComponent(ref));
  p.append('cancel_url', origin + '/?annule=' + encodeURIComponent(ref));
  if (data.email) p.append('customer_email', String(data.email));
  p.append('client_reference_id', ref);
  p.append('line_items[0][quantity]', '1');
  p.append('line_items[0][price_data][currency]', 'eur');
  p.append('line_items[0][price_data][unit_amount]', String(cents));
  p.append('line_items[0][price_data][product_data][name]', label);

  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + secret,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: p.toString()
    });
    const json = await r.json();
    if (!r.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: (json.error && json.error.message) || 'Erreur Stripe' }) };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: json.url })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
};
