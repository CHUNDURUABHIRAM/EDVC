import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting E2E Audit...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.createBrowserContext();
  await context.overridePermissions('http://localhost:5173', ['geolocation']);
  const page = await context.newPage();
  await page.setGeolocation({ latitude: 16.54078, longitude: 81.52322 });
  const errors = [];

  page.on('console', msg => {
    const text = msg.text();
    console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${text}`);
    if (msg.type() === 'error' && !text.includes('favicon.ico')) {
      errors.push(`Console Error: ${text}`);
    }
  });

  page.on('pageerror', error => {
    errors.push(`Page Error: ${error.message}`);
  });

  try {
    // 1. User Registration Flow
    console.log('Testing Registration...');
    await page.goto('http://localhost:5173/auth', { waitUntil: 'domcontentloaded' });
    
    // Clear localStorage to ensure fresh session
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    console.log('Clicking Register tab...');
    await page.waitForSelector('.auth-tabs', { timeout: 5000 });
    await page.click('button.tab-btn:nth-child(2)');
    
    console.log('Filling form...');
    const uniqueEmail = `audit_${Date.now()}@example.com`;
    await page.type('input[name="name"]', 'Audit User');
    await page.type('input[name="phone"]', '1234567890');
    await page.type('input[name="evModel"]', 'Test EV');
    await page.type('input[name="email"]', uniqueEmail);
    await page.type('input[name="password"]', 'password123');
    
    console.log('Submitting form...');
    await page.click('button[type="submit"]');

    console.log('Waiting for navigation to dashboard...');
    await page.waitForSelector('.main-content', { timeout: 15000 });
    console.log('Registration and Login successful.');

    // 2. Smart Recommendations
    console.log('Testing Smart Recommendations...');
    await page.waitForFunction(() => document.querySelectorAll('.station-card').length === 3, { timeout: 15000 });
    const stationCards = await page.$$('.station-card');
    if (stationCards.length !== 3) {
      throw new Error(`Smart Recommendations should show exactly 3 stations, found ${stationCards.length}`);
    }
    console.log('Smart Recommendations verified.');

    // 2.5 Geolocation Denial Test
    console.log('Testing Geolocation Denial...');
    
    // Revoke geolocation permissions in the main context
    await context.clearPermissionOverrides();
    await context.overridePermissions('http://localhost:5173', []);
    
    // Navigate away and back to Dashboard to trigger the geolocation request again
    await page.goto('http://localhost:5173/finder', { waitUntil: 'domcontentloaded' });
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded' });
    
    await page.waitForSelector('.empty-rec h3', { timeout: 15000 });
    const emptyText = await page.evaluate(() => document.querySelector('.empty-rec').innerText);
    if (!emptyText.includes('Location Access Denied')) {
      throw new Error('Dashboard did not show Location Access Denied state.');
    }
    
    // Re-enable geolocation for the rest of the tests
    await context.overridePermissions('http://localhost:5173', ['geolocation']);
    await page.setGeolocation({ latitude: 16.54078, longitude: 81.52322 });
    
    console.log('Geolocation Denial verified.');
    console.log('Smart Recommendations verified.');

    // 3. Find Chargers
    console.log('Testing Find Chargers...');
    await page.goto('http://localhost:5173/finder', { waitUntil: 'domcontentloaded' });
    
    // Switch to List View
    await page.waitForSelector('.toggle-btn', { timeout: 5000 });
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.toggle-btn'));
      const listBtn = btns.find(b => b.innerText.includes('List'));
      if(listBtn) listBtn.click();
    });

    await page.waitForFunction(
      () => document.querySelectorAll('.list-card').length > 3,
      { timeout: 15000 }
    );
    const listCards = await page.$$('.list-card');
    console.log(`Find Chargers verified (${listCards.length} stations found).`);

    // 4. Booking Flow
    console.log('Testing Booking Flow...');
    
    await page.waitForSelector('.btn-primary', { timeout: 5000 });
    // Click an available station from the list
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.list-card'));
      const availableCard = cards.find(c => {
        const badge = c.querySelector('.status-badge');
        return badge && (badge.innerText.includes('AVAILABLE') || badge.innerText.includes('LIMITED'));
      });
      if (availableCard) {
        availableCard.click();
      } else if (cards[0]) {
        cards[0].click();
      }
    });
    
    // Wait for Station Details to load, then click Book Slot
    await page.waitForSelector('.btn-primary', { timeout: 5000 });
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.btn-primary'));
      const bookBtn = btns.find(b => b.innerText.includes('Book Slot'));
      if (bookBtn) bookBtn.click();
    });
    
    // Proceed with booking
    await page.waitForSelector('.charger-option', { timeout: 5000 });
    const chargers = await page.$$('.charger-option');
    // Select first available charger
    let selected = false;
    for (const c of chargers) {
      const isDimmed = await (await c.getProperty('className')).jsonValue();
      if (!isDimmed.includes('dimmed')) {
        await c.click();
        selected = true;
        break;
      }
    }
    if (!selected) throw new Error('No available chargers found for booking test');

    // Fill date/time
    await page.type('input[type="time"]', '23:55');
    await page.click('button.btn-primary'); // Continue to Payment

    await page.waitForSelector('.payment-step', { timeout: 5000 });
    await page.click('.payment-step button.btn-primary'); // Pay

    await page.waitForSelector('.success-step', { timeout: 5000 });
    console.log('Booking Flow verified.');

    // 5. Admin Flow
    console.log('Testing Admin Flow...');
    
    // Log out organic user first
    await page.click('.menu-item.logout');
    await page.waitForSelector('.auth-tabs', { timeout: 5000 });

    await page.goto('http://localhost:5173/admin/login', { waitUntil: 'domcontentloaded' });
    
    // Use the admin credentials
    /* eslint-disable no-undef */
const adminEmail = process.env.ADMIN_TEST_EMAIL || 'admin@chargespot.demo';
    const adminPassword = process.env.ADMIN_TEST_PASSWORD || 'password';
    await page.type('input[type="email"]', adminEmail);
    await page.type('input[type="password"]', adminPassword);
    await page.click('button[type="submit"]');

    await page.waitForSelector('.admin-layout', { timeout: 5000 });
    
    console.log('Testing Admin Stations Tab...');
    await page.click('button.admin-tab:nth-child(2)'); // Stations tab
    await page.waitForSelector('.admin-table', { timeout: 5000 });
    console.log('Admin Stations Tab verified.');
    
    // Check Bookings
    console.log('Testing Admin Bookings...');
    await page.click('button.admin-tab:nth-child(3)'); // Bookings tab
    await page.waitForSelector('.admin-table', { timeout: 5000 });
    let bookingsText = await page.evaluate(() => document.querySelector('.admin-table').innerText);
    if (!bookingsText.includes('Audit User')) {
      throw new Error('Admin Bookings table does not show the organic user name.');
    }
    if (!bookingsText.includes('PENDING')) {
      throw new Error('Booking is not in PENDING state.');
    }

    // Admin accepts booking
    console.log('Admin accepting booking...');
    await page.evaluate(() => {
      const acceptBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'Accept');
      if (acceptBtn) acceptBtn.click();
    });
    await page.waitForFunction(() => {
      return document.querySelector('.admin-table').innerText.includes('CONFIRMED');
    }, { timeout: 5000 });
    console.log('Admin booking acceptance verified.');

    // Check System Users
    console.log('Testing System Users...');
    await page.click('button.admin-tab:nth-child(4)'); // Users tab
    await page.waitForSelector('.admin-table', { timeout: 5000 });
    const usersText = await page.evaluate(() => document.querySelector('.admin-table').innerText);
    if (!usersText.includes('Audit User')) {
      throw new Error('Admin System Users table does not show the organic user name.');
    }
    if (usersText.includes('Arjun Kumar')) {
      throw new Error('Admin System Users table contains fake user "Arjun Kumar".');
    }

    console.log('All E2E tests passed successfully!');

  } catch (err) {
    console.error('E2E Test Failed:', err.message);
    const url = await page.url();
    console.error('Current URL:', url);
  } finally {
    if (errors.length > 0) {
      console.error('Captured Errors during run:', errors);
    }
    await browser.close();
  }
})();
