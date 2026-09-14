// The mock "Springfield City Permits" portal HTML, served from a Convex HTTP
// action so it has a public convex.site URL that Firecrawl can reach without a
// separate static deploy. Clearly labeled DEMO. See SPEC section 7.
export const FOOD_HANDLER_PORTAL = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Springfield City Permits — DEMO</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; margin: 0; background: #eef1f4; color: #1a2733; }
  .demo-banner { background: #b45309; color: #fff; text-align: center; padding: 8px 12px; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; }
  .gov-header { background: #14395c; color: #fff; padding: 18px 24px; }
  .gov-header h1 { margin: 0; font-size: 22px; }
  .gov-header p { margin: 4px 0 0; font-size: 13px; opacity: 0.85; }
  .wrap { max-width: 640px; margin: 24px auto; padding: 0 16px; }
  .card { background: #fff; border: 1px solid #c7d0d9; border-radius: 4px; padding: 24px; }
  h2 { margin-top: 0; font-size: 18px; border-bottom: 2px solid #14395c; padding-bottom: 8px; }
  label { display: block; margin: 16px 0 4px; font-weight: bold; font-size: 14px; }
  input[type="text"], select { width: 100%; padding: 8px 10px; border: 1px solid #9aa8b5; border-radius: 3px; font-size: 15px; font-family: inherit; }
  .check-row { margin-top: 16px; display: flex; align-items: flex-start; gap: 8px; }
  .check-row input { margin-top: 3px; }
  .check-row label { margin: 0; font-weight: normal; font-size: 14px; }
  button { margin-top: 20px; background: #14395c; color: #fff; border: none; padding: 12px 22px; font-size: 15px; border-radius: 3px; cursor: pointer; font-family: Arial, sans-serif; }
  button:hover { background: #0f2c47; }
  .confirmation { margin-top: 20px; padding: 16px; background: #dcfce7; border: 1px solid #16a34a; border-radius: 3px; display: none; }
  .confirmation.show { display: block; }
  .conf-no { font-family: "Courier New", monospace; font-weight: bold; font-size: 18px; }
  .muted { color: #5b6b7a; font-size: 13px; }
</style>
</head>
<body>
<div class="demo-banner">DEMO PORTAL — not a real government agency. For Permitly demonstration only.</div>
<div class="gov-header"><h1>Springfield City Permits</h1><p>Office of Business Licensing · Renewals Portal</p></div>
<div class="wrap"><div class="card">
  <h2>Food Handler Permit — Renewal</h2>
  <p class="muted">Complete all fields to renew your establishment's food handler permit.</p>
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
    <button type="submit" id="submit-btn">Submit renewal</button>
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
    var term = document.getElementById("renewalTerm").value;
    var n = "FH-2026-" + Math.floor(100000 + Math.random() * 899999);
    document.getElementById("conf-no").textContent = n;
    document.title = "Renewed " + n;
    document.getElementById("conf-detail").textContent = "Food Handler Permit renewed (" + term + "). Keep this number for your records.";
    document.getElementById("confirmation").classList.add("show");
    var b = document.getElementById("submit-btn"); b.disabled = true; b.textContent = "Submitted";
    return false;
  }
</script>
</body>
</html>`;

// Inspection booking page for permits that require an on-site inspection.
// Firecrawl /interact picks a slot and confirms. DEMO-labeled.
export const BOOKING_PORTAL = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Springfield Fire Dept — Inspection Booking (DEMO)</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; margin: 0; background: #eef1f4; color: #1a2733; }
  .demo-banner { background: #b45309; color: #fff; text-align: center; padding: 8px 12px; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; }
  .gov-header { background: #7a2e1e; color: #fff; padding: 18px 24px; }
  .gov-header h1 { margin: 0; font-size: 22px; }
  .gov-header p { margin: 4px 0 0; font-size: 13px; opacity: 0.85; }
  .wrap { max-width: 640px; margin: 24px auto; padding: 0 16px; }
  .card { background: #fff; border: 1px solid #c7d0d9; border-radius: 4px; padding: 24px; }
  h2 { margin-top: 0; font-size: 18px; border-bottom: 2px solid #7a2e1e; padding-bottom: 8px; }
  .slots { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
  .slot { border: 1px solid #9aa8b5; border-radius: 4px; padding: 12px; cursor: pointer; font-size: 14px; background: #fff; text-align: left; }
  .slot:hover { border-color: #7a2e1e; }
  .slot.selected { background: #7a2e1e; color: #fff; border-color: #7a2e1e; }
  button.confirm { margin-top: 20px; background: #7a2e1e; color: #fff; border: none; padding: 12px 22px; font-size: 15px; border-radius: 3px; cursor: pointer; font-family: Arial, sans-serif; }
  button.confirm:disabled { opacity: 0.5; cursor: default; }
  .confirmation { margin-top: 20px; padding: 16px; background: #dcfce7; border: 1px solid #16a34a; border-radius: 3px; display: none; }
  .confirmation.show { display: block; }
  .conf-no { font-family: "Courier New", monospace; font-weight: bold; }
  .muted { color: #5b6b7a; font-size: 13px; }
</style>
</head>
<body>
<div class="demo-banner">DEMO PORTAL — not a real government agency. For Permitly demonstration only.</div>
<div class="gov-header"><h1>Springfield Fire Department</h1><p>Fire Safety Inspection · Appointment Booking</p></div>
<div class="wrap"><div class="card">
  <h2>Book your inspection slot</h2>
  <p class="muted">Select an available appointment for your fire safety inspection.</p>
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
