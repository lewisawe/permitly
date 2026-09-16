// The mock "Springfield City Permits" portal HTML, served from a Convex HTTP
// action so it has a public convex.site URL that Firecrawl can reach without a
// separate static deploy. Styled per govtdesign.md (Drizzle "rainwater terminal
// on graph paper": monochrome + Electric Cobalt accent, Inter/JetBrains Mono,
// 1px Pebble borders, 8px radius, no shadows). Clearly labeled DEMO. See SPEC 7.
export const FOOD_HANDLER_PORTAL = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<title>Springfield City Permits — DEMO</title>
<style>
  :root {
    --ink:#222222; --graphite:#444444; --steel:#4b5563; --fog:#969faf;
    --paper:#ffffff; --cloud:#f6f6f7; --chalk:#f0f0f0; --pebble:#e5e7eb;
    --cobalt:#3e7ff0; --signal:#006be6;
  }
  * { box-sizing: border-box; }
  body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; margin: 0; background: var(--cloud); color: var(--ink); font-size: 14px; line-height: 1.42; }
  .demo-banner { background: var(--paper); color: var(--graphite); text-align: center; padding: 8px 12px; font-size: 12px; border-bottom: 1px solid var(--pebble); }
  .gov-header { background: var(--paper); border-bottom: 1px solid var(--pebble); padding: 16px 24px; display: flex; align-items: center; gap: 10px; }
  .mark { width: 22px; height: 22px; border-radius: 5px; background: var(--cobalt); display: inline-block; }
  .gov-header h1 { margin: 0; font-size: 18px; font-weight: 700; }
  .gov-header p { margin: 2px 0 0; font-size: 12px; color: var(--steel); font-family: "JetBrains Mono", ui-monospace, monospace; }
  .wrap { max-width: 620px; margin: 40px auto; padding: 0 16px; }
  .card { background: var(--paper); border: 1px solid var(--pebble); border-radius: 8px; padding: 24px; }
  h2 { margin: 0 0 4px; font-size: 20px; font-weight: 600; }
  .sub { color: var(--graphite); margin: 0 0 20px; }
  label { display: block; margin: 16px 0 6px; font-weight: 500; font-size: 14px; color: var(--ink); }
  input[type="text"], select { width: 100%; padding: 10px 12px; border: 1px solid var(--pebble); border-radius: 8px; font-size: 14px; font-family: inherit; color: var(--ink); background: var(--paper); }
  input[type="text"]:focus, select:focus { outline: none; border-color: var(--cobalt); }
  input::placeholder { color: var(--fog); }
  .check-row { margin-top: 16px; display: flex; align-items: flex-start; gap: 8px; }
  .check-row input { margin-top: 3px; }
  .check-row label { margin: 0; font-weight: 400; font-size: 14px; color: var(--graphite); }
  button { margin-top: 20px; background: var(--ink); color: var(--paper); border: none; padding: 10px 18px; font-size: 14px; font-weight: 600; border-radius: 8px; cursor: pointer; font-family: inherit; }
  button:hover { background: var(--slate,#282b3b); }
  .confirmation { margin-top: 20px; padding: 16px; background: var(--cloud); border: 1px solid var(--pebble); border-radius: 8px; display: none; }
  .confirmation.show { display: block; }
  .conf-no { font-family: "JetBrains Mono", ui-monospace, monospace; font-weight: 500; color: var(--cobalt); }
  .muted { color: var(--steel); font-size: 12px; }
  .badge { display:inline-block; font-family:"JetBrains Mono",ui-monospace,monospace; font-size:10px; text-transform:uppercase; color:var(--steel); background:var(--chalk); border-radius:2px; padding:2px 6px; }
</style>
</head>
<body>
<div class="demo-banner">DEMO PORTAL — not a real government agency. For Permitly demonstration only.</div>
<div class="gov-header"><span class="mark"></span><div><h1>Springfield City Permits</h1><p>office of business licensing · renewals</p></div></div>
<div class="wrap"><div class="card">
  <span class="badge">Form FH-1 · renewal</span>
  <h2 style="margin-top:10px">Food Handler Permit — Renewal</h2>
  <p class="sub">Complete all fields to renew your establishment's food handler permit.</p>
  <form id="renewal-form" onsubmit="return submitForm(event)">
    <label for="legalName">Business legal name</label>
    <input type="text" id="legalName" name="legalName" required />
    <label for="address">Business address</label>
    <input type="text" id="address" name="address" required />
    <label for="contactName">Contact name</label>
    <input type="text" id="contactName" name="contactName" required />
    <label for="priorPermitNo">Prior permit number</label>
    <input type="text" id="priorPermitNo" name="priorPermitNo" required />
    <label for="renewalTerm">Renewal term</label>
    <select id="renewalTerm" name="renewalTerm"><option value="1-year">1 year</option><option value="2-year">2 years</option></select>
    <div class="check-row"><input type="checkbox" id="attest" name="attest" required />
      <label for="attest">I attest that the information provided is accurate and the establishment complies with the Springfield Food Safety Code.</label></div>
    <button type="submit" id="submit-btn">Continue to review</button>
  </form>
  <div class="confirmation" id="confirmation">
    <div>Renewal submitted successfully.</div>
    <div class="conf-no">Confirmation number: <span id="conf-no"></span></div>
    <div class="muted" id="conf-detail"></div>
  </div>
</div></div>
<script>
  function submitForm(e) {
    e.preventDefault();
    // Multi-step wizard: forward entered values to the review page for a final
    // confirm (a real portal rarely submits in one click).
    var f = document.getElementById("renewal-form");
    var q = new URLSearchParams({
      legalName: f.legalName.value,
      address: f.address.value,
      contactName: f.contactName.value,
      priorPermitNo: f.priorPermitNo.value,
      renewalTerm: f.renewalTerm.value,
    });
    window.location.href = "/demo-portal/review?" + q.toString();
    return false;
  }
</script>
</body>
</html>`;

// Inspection booking page for permits that require an on-site inspection.
// Firecrawl /interact picks a slot and confirms. Styled per govtdesign.md.
export const BOOKING_PORTAL = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<title>Springfield Fire Dept — Inspection Booking (DEMO)</title>
<style>
  :root {
    --ink:#222222; --graphite:#444444; --steel:#4b5563; --fog:#969faf;
    --paper:#ffffff; --cloud:#f6f6f7; --chalk:#f0f0f0; --pebble:#e5e7eb; --cobalt:#3e7ff0;
  }
  * { box-sizing: border-box; }
  body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; margin: 0; background: var(--cloud); color: var(--ink); font-size: 14px; line-height: 1.42; }
  .demo-banner { background: var(--paper); color: var(--graphite); text-align: center; padding: 8px 12px; font-size: 12px; border-bottom: 1px solid var(--pebble); }
  .gov-header { background: var(--paper); border-bottom: 1px solid var(--pebble); padding: 16px 24px; display: flex; align-items: center; gap: 10px; }
  .mark { width: 22px; height: 22px; border-radius: 5px; background: var(--cobalt); display: inline-block; }
  .gov-header h1 { margin: 0; font-size: 18px; font-weight: 700; }
  .gov-header p { margin: 2px 0 0; font-size: 12px; color: var(--steel); font-family: "JetBrains Mono", ui-monospace, monospace; }
  .wrap { max-width: 620px; margin: 40px auto; padding: 0 16px; }
  .card { background: var(--paper); border: 1px solid var(--pebble); border-radius: 8px; padding: 24px; }
  h2 { margin: 0 0 4px; font-size: 20px; font-weight: 600; }
  .sub { color: var(--graphite); margin: 0 0 16px; }
  .slots { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
  .slot { border: 1px solid var(--pebble); border-radius: 8px; padding: 12px; cursor: pointer; font-size: 14px; background: var(--paper); text-align: left; font-family: "JetBrains Mono", ui-monospace, monospace; color: var(--ink); }
  .slot:hover { border-color: var(--cobalt); background: var(--cloud); }
  .slot.selected { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  button.confirm { margin-top: 20px; background: var(--ink); color: var(--paper); border: none; padding: 10px 18px; font-size: 14px; font-weight: 600; border-radius: 8px; cursor: pointer; font-family: inherit; }
  button.confirm:disabled { opacity: 0.4; cursor: default; }
  .confirmation { margin-top: 20px; padding: 16px; background: var(--cloud); border: 1px solid var(--pebble); border-radius: 8px; display: none; }
  .confirmation.show { display: block; }
  .conf-no { font-family: "JetBrains Mono", ui-monospace, monospace; font-weight: 500; color: var(--cobalt); }
  .muted { color: var(--steel); font-size: 12px; }
  .badge { display:inline-block; font-family:"JetBrains Mono",ui-monospace,monospace; font-size:10px; text-transform:uppercase; color:var(--steel); background:var(--chalk); border-radius:2px; padding:2px 6px; }
</style>
</head>
<body>
<div class="demo-banner">DEMO PORTAL — not a real government agency. For Permitly demonstration only.</div>
<div class="gov-header"><span class="mark"></span><div><h1>Springfield Fire Department</h1><p>fire safety inspection · booking</p></div></div>
<div class="wrap"><div class="card">
  <span class="badge">Inspection · scheduling</span>
  <h2 style="margin-top:10px">Book your inspection slot</h2>
  <p class="sub">Select an available appointment for your fire safety inspection.</p>
  <div class="slots" id="slots">
    <button type="button" class="slot" data-slot="Mon Oct 6, 9:00 AM">Mon Oct 6 · 9:00 AM</button>
    <button type="button" class="slot" data-slot="Mon Oct 6, 1:00 PM">Mon Oct 6 · 1:00 PM</button>
    <button type="button" class="slot" data-slot="Tue Oct 7, 10:00 AM">Tue Oct 7 · 10:00 AM</button>
    <button type="button" class="slot" data-slot="Tue Oct 7, 2:00 PM">Tue Oct 7 · 2:00 PM</button>
    <button type="button" class="slot" data-slot="Wed Oct 8, 11:00 AM">Wed Oct 8 · 11:00 AM</button>
    <button type="button" class="slot" data-slot="Wed Oct 8, 3:00 PM">Wed Oct 8 · 3:00 PM</button>
  </div>
  <button class="confirm" id="confirm-btn" disabled onclick="confirmSlot()">Confirm appointment</button>
  <div class="confirmation" id="confirmation">
    <div>Inspection booked.</div>
    <div class="conf-no">Booking reference: <span id="ref"></span></div>
    <div class="muted" id="slot-detail"></div>
  </div>
</div></div>
<script>
  var selected = null;
  document.querySelectorAll(".slot").forEach(function (el) {
    el.addEventListener("click", function () {
      document.querySelectorAll(".slot").forEach(function (s) { s.classList.remove("selected"); });
      el.classList.add("selected");
      selected = el.getAttribute("data-slot");
      document.getElementById("confirm-btn").disabled = false;
    });
  });
  function confirmSlot() {
    if (!selected) return;
    var ref = "INSP-2026-" + Math.floor(1000 + Math.random() * 8999);
    document.getElementById("ref").textContent = ref;
    document.title = "Booked " + ref;
    document.getElementById("slot-detail").textContent = "Inspection scheduled for " + selected + ".";
    document.getElementById("confirmation").classList.add("show");
    var b = document.getElementById("confirm-btn"); b.disabled = true; b.textContent = "Confirmed";
  }
</script>
</body>
</html>`;


// --- Multi-page realistic portal (login -> dashboard -> form -> review) ---
// These prove the agent can log in and NAVIGATE, not just fill one known form.
// Styled per govtdesign.md (Drizzle). Demo credentials are shown on the login
// page so the flow is honestly reproducible. Pages link with plain <a>/<form>
// so a browser agent can traverse them by understanding the page.

const PORTAL_HEAD = `<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>
  :root { --ink:#222; --graphite:#444; --steel:#4b5563; --fog:#969faf; --paper:#fff; --cloud:#f6f6f7; --chalk:#f0f0f0; --pebble:#e5e7eb; --cobalt:#3e7ff0; }
  * { box-sizing: border-box; }
  body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; margin: 0; background: var(--cloud); color: var(--ink); font-size: 14px; line-height: 1.42; }
  .demo-banner { background: var(--paper); color: var(--graphite); text-align: center; padding: 8px 12px; font-size: 12px; border-bottom: 1px solid var(--pebble); }
  .gov-header { background: var(--paper); border-bottom: 1px solid var(--pebble); padding: 16px 24px; display: flex; align-items: center; gap: 10px; }
  .mark { width: 22px; height: 22px; border-radius: 5px; background: var(--cobalt); display: inline-block; }
  .gov-header h1 { margin: 0; font-size: 18px; font-weight: 700; }
  .gov-header p { margin: 2px 0 0; font-size: 12px; color: var(--steel); font-family: "JetBrains Mono", ui-monospace, monospace; }
  .wrap { max-width: 640px; margin: 40px auto; padding: 0 16px; }
  .card { background: var(--paper); border: 1px solid var(--pebble); border-radius: 8px; padding: 24px; }
  h2 { margin: 0 0 4px; font-size: 20px; font-weight: 600; }
  .sub { color: var(--graphite); margin: 0 0 20px; }
  label { display: block; margin: 16px 0 6px; font-weight: 500; font-size: 14px; }
  input[type="text"], input[type="password"], select { width: 100%; padding: 10px 12px; border: 1px solid var(--pebble); border-radius: 8px; font-size: 14px; font-family: inherit; color: var(--ink); background: var(--paper); }
  input:focus, select:focus { outline: none; border-color: var(--cobalt); }
  button, .btn { margin-top: 20px; background: var(--ink); color: var(--paper); border: none; padding: 10px 18px; font-size: 14px; font-weight: 600; border-radius: 8px; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-block; }
  .hint { margin-top: 14px; font-size: 12px; color: var(--steel); font-family: "JetBrains Mono", ui-monospace, monospace; }
  .badge { display:inline-block; font-family:"JetBrains Mono",ui-monospace,monospace; font-size:10px; text-transform:uppercase; color:var(--steel); background:var(--chalk); border-radius:2px; padding:2px 6px; }
  table.permits { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.permits th, table.permits td { text-align: left; padding: 12px 10px; border-bottom: 1px solid var(--pebble); font-size: 14px; }
  table.permits th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--steel); }
  .renew-link { color: var(--cobalt); font-weight: 600; text-decoration: none; }
  .renew-link:hover { text-decoration: underline; }
  .review-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--pebble); }
  .review-row .k { color: var(--steel); }
  .review-row .v { font-weight: 500; font-family: "JetBrains Mono", ui-monospace, monospace; }
</style>`;

const PORTAL_BANNER = `<div class="demo-banner">DEMO PORTAL — not a real government agency. For Permitly demonstration only.</div>
<div class="gov-header"><span class="mark"></span><div><h1>Springfield City Permits</h1><p>office of business licensing · self-service portal</p></div></div>`;

// 1) Login page. Agent signs in with demo credentials, then lands on the dashboard.
export const LOGIN_PORTAL = `<!doctype html><html lang="en"><head>${PORTAL_HEAD}<title>Sign in — Springfield City Permits (DEMO)</title></head>
<body>${PORTAL_BANNER}
<div class="wrap"><div class="card">
  <span class="badge">Secure sign-in</span>
  <h2 style="margin-top:10px">Sign in to your account</h2>
  <p class="sub">Access your business permits and renewals.</p>
  <form action="/demo-portal/dashboard" method="get">
    <label for="username">Username</label>
    <input type="text" id="username" name="username" autocomplete="username" required />
    <label for="password">Password</label>
    <input type="password" id="password" name="password" autocomplete="current-password" required />
    <button type="submit" id="signin-btn">Sign in</button>
  </form>
  <p class="hint">Demo credentials — username: demo · password: demo</p>
</div></div>
</body></html>`;

// 2) Dashboard. Lists the business's permits; agent must find the right one and
// click its Renew link to reach the form (navigation, not just form-fill).
export const DASHBOARD_PORTAL = `<!doctype html><html lang="en"><head>${PORTAL_HEAD}<title>Dashboard — Springfield City Permits (DEMO)</title></head>
<body>${PORTAL_BANNER}
<div class="wrap"><div class="card">
  <span class="badge">My permits</span>
  <h2 style="margin-top:10px">Your permits &amp; licenses</h2>
  <p class="sub">Select a permit to begin its renewal.</p>
  <table class="permits">
    <thead><tr><th>Permit</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td>Food Handler Permit</td><td>Renewal due</td><td><a class="renew-link" href="/demo-portal/food-handler">Renew</a></td></tr>
      <tr><td>Business License</td><td>Active</td><td><a class="renew-link" href="/demo-portal/food-handler">Renew</a></td></tr>
      <tr><td>Sign Permit</td><td>Expired</td><td><a class="renew-link" href="/demo-portal/food-handler">Renew</a></td></tr>
    </tbody>
  </table>
</div></div>
</body></html>`;

// 3) Review page. Shows entered values and a final Confirm & submit button, so
// the flow is a real multi-step wizard. Reads values from the query string the
// form forwards, and generates the confirmation on confirm.
export const REVIEW_PORTAL = `<!doctype html><html lang="en"><head>${PORTAL_HEAD}<title>Review &amp; confirm — Springfield City Permits (DEMO)</title></head>
<body>${PORTAL_BANNER}
<div class="wrap"><div class="card">
  <span class="badge">Step 2 of 2 · review</span>
  <h2 style="margin-top:10px">Review your renewal</h2>
  <p class="sub">Confirm the details below are correct, then submit.</p>
  <div id="review"></div>
  <button type="button" id="confirm-btn" onclick="confirmSubmit()">Confirm &amp; submit</button>
  <div class="confirmation" id="confirmation" style="margin-top:20px;padding:16px;background:var(--cloud);border:1px solid var(--pebble);border-radius:8px;display:none;">
    <div>Renewal submitted successfully.</div>
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;color:var(--cobalt);">Confirmation number: <span id="conf-no"></span></div>
  </div>
</div></div>
<script>
  var q = new URLSearchParams(location.search);
  var fields = [["Business legal name","legalName"],["Business address","address"],["Contact name","contactName"],["Prior permit number","priorPermitNo"],["Renewal term","renewalTerm"]];
  var html = fields.map(function(f){ return '<div class="review-row"><span class="k">'+f[0]+'</span><span class="v">'+(q.get(f[1])||'—')+'</span></div>'; }).join("");
  document.getElementById("review").innerHTML = html;
  function confirmSubmit(){
    var n = "FH-2026-" + Math.floor(100000 + Math.random()*899999);
    document.getElementById("conf-no").textContent = n;
    document.title = "Renewed " + n;
    document.getElementById("confirmation").style.display = "block";
    var b = document.getElementById("confirm-btn"); b.disabled = true; b.textContent = "Submitted"; b.style.opacity = "0.5";
  }
</script>
</body></html>`;
